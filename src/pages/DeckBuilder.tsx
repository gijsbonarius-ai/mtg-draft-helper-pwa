import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ZoomableCard } from '../components/CardZoom';
import type { DraftState, PlayerKey } from '../lib/types';

const BASIC_LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

export default function DeckBuilder() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lands, setLands] = useState<Record<string, number>>({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 });
  const [target, setTarget] = useState<40 | 60>(60);
  const playerKey = useRef<PlayerKey | null>(null);
  const playerName = useRef('');

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
    playerName.current = localStorage.getItem(`draft_name_${roomCode}`) || '';
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    const { data } = await supabase
      .from('draft_sessions').select('state').eq('room_code', roomCode).single();
    if (data) setState(data.state as DraftState);
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;
    const channel = supabase
      .channel(`deckbuild_${roomCode}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'draft_sessions', filter: `room_code=eq.${roomCode}` },
        payload => setState(payload.new.state as DraftState)
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomCode, loadState]);

  const myKey = playerKey.current;
  const myPicks = myKey ? (state?.players[myKey]?.picks ?? []) : [];
  const totalLands = Object.values(lands).reduce((a, b) => a + b, 0);
  const deckSize = selected.size + totalLands;
  const opponentReady = myKey
    ? !!(state?.deckBuilds?.[myKey === 'player1' ? 'player2' : 'player1'])
    : false;
  const iAmReady = myKey ? !!(state?.deckBuilds?.[myKey]) : false;

  function toggle(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function adjustLand(name: string, delta: number) {
    setLands(prev => ({ ...prev, [name]: Math.max(0, (prev[name] ?? 0) + delta) }));
  }

  async function saveDeck() {
    if (!roomCode || !myKey || !state) return;
    setSaving(true);
    const deck: string[] = [
      ...myPicks.filter((_, i) => selected.has(i)),
      ...BASIC_LANDS.flatMap(land => Array(lands[land]).fill(land)),
    ];
    const updated: DraftState = {
      ...state,
      deckBuilds: { ...state.deckBuilds, [myKey]: deck },
    };
    await supabase.from('draft_sessions').update({ state: updated }).eq('room_code', roomCode);
    setState(updated);
    setSaving(false);
  }

  useEffect(() => {
    if (!state || !myKey) return;
    const myDeck = state.deckBuilds?.[myKey];
    const oppKey: PlayerKey = myKey === 'player1' ? 'player2' : 'player1';
    const oppDeck = state.deckBuilds?.[oppKey];
    if (myDeck && oppDeck) {
      navigate(`/game/${roomCode}`);
    }
  }, [state, myKey, roomCode, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" />
    </div>
  );

  if (!state || !myKey) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <p className="text-red-400">Could not load draft. <button onClick={() => navigate('/')} className="text-yellow-400 underline">Go home</button></p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-yellow-400 font-bold text-sm">Build Your Deck</span>
          <span className="text-gray-500 text-xs ml-2">Room: {roomCode}</span>
        </div>
        <span className={`text-sm font-bold ${deckSize === target ? 'text-green-400' : deckSize > target ? 'text-red-400' : 'text-gray-400'}`}>
          {deckSize} / {target}
        </span>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-5">

        {/* Target size */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-2">Deck size target</p>
          <div className="flex gap-2">
            {([40, 60] as const).map(n => (
              <button key={n} onClick={() => setTarget(n)}
                className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${target === n ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                {n} cards
              </button>
            ))}
          </div>
        </div>

        {/* Basic lands */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-3">Basic Lands ({totalLands} total)</p>
          <div className="grid grid-cols-5 gap-2">
            {BASIC_LANDS.map(land => (
              <div key={land} className="flex flex-col items-center gap-1">
                <ZoomableCard name={land} className="w-14 h-20 sm:w-16 sm:h-24 flex-shrink-0" />
                <span className="text-xs text-gray-400">{land.slice(0, 3)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => adjustLand(land, -1)}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded text-white font-bold flex items-center justify-center text-sm">−</button>
                  <span className="text-white font-bold text-sm w-5 text-center">{lands[land]}</span>
                  <button onClick={() => adjustLand(land, 1)}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded text-white font-bold flex items-center justify-center text-sm">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drafted cards */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">
            Your picks — {selected.size} of {myPicks.length} selected
          </p>
          <p className="text-xs text-gray-600 mb-3">Tap a card to include / exclude it from your deck</p>
          <div className="flex flex-wrap gap-2">
            {myPicks.map((card, i) => (
              <div key={i} className="relative flex-shrink-0 cursor-pointer" onClick={() => toggle(i)}>
                <ZoomableCard
                  name={card}
                  className={`w-16 h-24 sm:w-20 sm:h-28 transition-opacity ${selected.has(i) ? 'opacity-100' : 'opacity-35'}`}
                />
                {selected.has(i) && (
                  <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs font-bold pointer-events-none">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 space-y-2">
        {iAmReady ? (
          <div className="text-center space-y-1">
            <p className="text-green-400 font-semibold text-sm">✓ Deck submitted ({(state.deckBuilds?.[myKey]?.length ?? 0)} cards)</p>
            {opponentReady
              ? <p className="text-yellow-400 text-sm">Both ready — loading game…</p>
              : <p className="text-gray-400 text-sm">Waiting for opponent to finish building…</p>
            }
          </div>
        ) : (
          <button
            onClick={saveDeck}
            disabled={saving || deckSize === 0}
            className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 disabled:opacity-40 text-black font-bold py-4 rounded-xl text-base transition-colors"
          >
            {saving ? 'Saving…' : `Submit Deck (${deckSize} cards)`}
          </button>
        )}
      </div>
    </div>
  );
}
