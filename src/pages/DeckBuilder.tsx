import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ZoomOverlay } from '../components/CardZoom';
import type { DraftState, PlayerKey } from '../lib/types';

const BASIC_LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

interface CardData {
  name: string;
  cmc: number;
  type_line: string;
}

type CardGroup = 'Creatures' | 'Instants' | 'Sorceries' | 'Enchantments' | 'Artifacts' | 'Lands' | 'Other';
const GROUP_ORDER: CardGroup[] = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Lands', 'Other'];
const GROUP_COLORS: Record<CardGroup, string> = {
  Creatures: 'text-green-400', Instants: 'text-blue-400', Sorceries: 'text-red-400',
  Enchantments: 'text-purple-400', Artifacts: 'text-gray-300', Lands: 'text-yellow-400', Other: 'text-gray-400',
};

function getGroup(typeLine: string): CardGroup {
  if (/Land/i.test(typeLine)) return 'Lands';
  if (/Creature/i.test(typeLine)) return 'Creatures';
  if (/Instant/i.test(typeLine)) return 'Instants';
  if (/Sorcery/i.test(typeLine)) return 'Sorceries';
  if (/Enchantment/i.test(typeLine)) return 'Enchantments';
  if (/Artifact/i.test(typeLine)) return 'Artifacts';
  return 'Other';
}

async function fetchCardData(names: string[]): Promise<Map<string, CardData>> {
  const result = new Map<string, CardData>();
  for (let i = 0; i < names.length; i += 75) {
    const batch = names.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch.map(name => ({ name })) }),
      });
      const json = await res.json();
      for (const card of json.data ?? []) {
        result.set(card.name, { name: card.name, cmc: card.cmc ?? 0, type_line: card.type_line ?? '' });
      }
    } catch { /* ignore */ }
  }
  return result;
}

function CardImg({ name, className = '' }: { name: string; className?: string }) {
  const [err, setErr] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  if (err) return (
    <div className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center p-1 ${className}`}>
      <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
    </div>
  );
  return <img src={src} alt={name} draggable={false} className={`rounded-lg object-cover ${className}`} onError={() => setErr(true)} />;
}

// A card in the pool — tap to add, long-press to zoom
function PoolCard({ name, inDeck, onAdd, onRemove }: { name: string; inDeck: boolean; onAdd: () => void; onRemove: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didZoom = useRef(false);

  function startPress() {
    didZoom.current = false;
    timer.current = setTimeout(() => { didZoom.current = true; setZoomed(true); }, 500);
  }
  function endPress() { if (timer.current) clearTimeout(timer.current); }
  function handleClick() { if (didZoom.current) return; inDeck ? onRemove() : onAdd(); }

  return (
    <>
      <div className="relative flex-shrink-0 cursor-pointer select-none"
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
        onTouchStart={startPress} onTouchEnd={endPress} onClick={handleClick}>
        <CardImg name={name} className={`w-16 h-24 transition-opacity ${inDeck ? 'opacity-100' : 'opacity-40'}`} />
        {inDeck && (
          <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs font-bold pointer-events-none">✓</div>
        )}
      </div>
      {zoomed && <ZoomOverlay name={name} onClose={() => setZoomed(false)} />}
    </>
  );
}

export default function DeckBuilder() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // deck = list of card names (picks can appear once; lands can appear multiple times)
  const [deck, setDeck] = useState<string[]>([]);
  const [lands, setLands] = useState<Record<string, number>>({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 });
  const [target, setTarget] = useState<40 | 60>(60);
  const [cardData, setCardData] = useState<Map<string, CardData>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);
  const [tab, setTab] = useState<'pool' | 'deck'>('pool');
  const playerKey = useRef<PlayerKey | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    const { data } = await supabase.from('draft_sessions').select('state').eq('room_code', roomCode).single();
    if (data) {
      const s = data.state as DraftState;
      setState(s);
      const myKey = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
      const picks = myKey ? s.players[myKey]?.picks ?? [] : [];
      if (picks.length > 0) {
        setDataLoading(true);
        const map = await fetchCardData(picks);
        setCardData(map);
        setDataLoading(false);
      }
    }
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;
    const channel = supabase.channel(`deckbuild_${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_sessions', filter: `room_code=eq.${roomCode}` },
        payload => setState(payload.new.state as DraftState)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomCode, loadState]);

  useEffect(() => {
    const myKey = playerKey.current;
    if (!state || !myKey) return;
    if (state.deckBuilds?.[myKey] && state.deckBuilds?.[myKey === 'player1' ? 'player2' : 'player1']) {
      navigate(`/game/${roomCode}`);
    }
  }, [state, roomCode, navigate]);

  const myKey = playerKey.current;
  const myPicks = myKey ? (state?.players[myKey]?.picks ?? []) : [];
  const iAmReady = myKey ? !!(state?.deckBuilds?.[myKey]) : false;
  const opponentReady = myKey ? !!(state?.deckBuilds?.[myKey === 'player1' ? 'player2' : 'player1']) : false;

  const totalLands = Object.values(lands).reduce((a, b) => a + b, 0);
  const deckSize = deck.length + totalLands;

  // Build grouped deck view
  const deckGroups = (() => {
    const groups: Partial<Record<CardGroup, { name: string; cmc: number }[]>> = {};
    for (const name of deck) {
      const data = cardData.get(name);
      const group = data ? getGroup(data.type_line) : 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group]!.push({ name, cmc: data?.cmc ?? 0 });
    }
    for (const land of BASIC_LANDS) {
      const count = lands[land];
      if (count > 0) {
        if (!groups['Lands']) groups['Lands'] = [];
        for (let i = 0; i < count; i++) groups['Lands']!.push({ name: land, cmc: 0 });
      }
    }
    for (const g of Object.values(groups)) g?.sort((a, b) => a.cmc - b.cmc);
    return groups;
  })();

  function addCard(name: string) {
    if (!deck.includes(name)) setDeck(prev => [...prev, name]);
  }
  function removeCard(name: string) {
    setDeck(prev => { const i = prev.indexOf(name); if (i === -1) return prev; return [...prev.slice(0, i), ...prev.slice(i + 1)]; });
  }
  function adjustLand(name: string, delta: number) {
    setLands(prev => ({ ...prev, [name]: Math.max(0, (prev[name] ?? 0) + delta) }));
  }

  async function saveDeck() {
    if (!roomCode || !myKey || !state) return;
    setSaving(true);
    const fullDeck = [
      ...deck,
      ...BASIC_LANDS.flatMap(land => Array(lands[land]).fill(land)),
    ];
    const updated: DraftState = { ...state, deckBuilds: { ...state.deckBuilds, [myKey]: fullDeck } };
    await supabase.from('draft_sessions').update({ state: updated }).eq('room_code', roomCode);
    setState(updated);
    setSaving(false);
  }

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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <span className="text-yellow-400 font-bold text-sm">Build Your Deck</span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {([40, 60] as const).map(n => (
              <button key={n} onClick={() => setTarget(n)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${target === n ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                {n}
              </button>
            ))}
          </div>
          <span className={`text-sm font-bold ${deckSize === target ? 'text-green-400' : deckSize > target ? 'text-red-400' : 'text-gray-300'}`}>
            {deckSize}/{target}
          </span>
        </div>
      </div>

      {/* Tab bar (mobile) */}
      <div className="flex border-b border-gray-800 shrink-0 sm:hidden">
        <button onClick={() => setTab('pool')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'pool' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>
          Card Pool ({myPicks.length})
        </button>
        <button onClick={() => setTab('deck')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'deck' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>
          My Deck ({deckSize})
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Card pool */}
        <div className={`flex flex-col overflow-hidden sm:flex sm:w-1/2 sm:border-r sm:border-gray-800 ${tab === 'pool' ? 'flex w-full' : 'hidden'}`}>
          <div className="px-3 py-2 shrink-0">
            <p className="text-xs text-gray-500">Tap to add · Long-press to zoom{dataLoading && <span className="ml-1 text-gray-600">· loading…</span>}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-wrap gap-2">
              {myPicks.map((card, i) => (
                <PoolCard key={i} name={card} inDeck={deck.includes(card)}
                  onAdd={() => { addCard(card); setTab('deck'); }}
                  onRemove={() => removeCard(card)} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Deck */}
        <div className={`flex flex-col overflow-hidden sm:flex sm:w-1/2 ${tab === 'deck' ? 'flex w-full' : 'hidden'}`}>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">

            {/* Basic lands */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2">Basic Lands ({totalLands})</p>
              <div className="grid grid-cols-5 gap-1.5">
                {BASIC_LANDS.map(land => (
                  <div key={land} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400">{land.slice(0, 3)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustLand(land, -1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded text-white font-bold text-sm flex items-center justify-center">−</button>
                      <span className="text-white font-bold text-sm w-5 text-center">{lands[land]}</span>
                      <button onClick={() => adjustLand(land, 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded text-white font-bold text-sm flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped deck */}
            {deckSize === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">← Tap cards from the pool to add them</p>
            ) : (
              GROUP_ORDER.map(group => {
                const cards = deckGroups[group];
                if (!cards || cards.length === 0) return null;
                return (
                  <div key={group}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${GROUP_COLORS[group]}`}>
                      {group} <span className="text-gray-600 font-normal normal-case">({cards.length})</span>
                    </p>
                    <div className="space-y-0.5">
                      {cards.map((card, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-lg px-3 py-1.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-500 text-xs w-4 text-center shrink-0">{card.cmc > 0 ? card.cmc : '—'}</span>
                            <span className="text-white text-sm truncate">{card.name}</span>
                          </div>
                          {!BASIC_LANDS.includes(card.name) && (
                            <button onClick={() => removeCard(card.name)}
                              className="text-gray-600 hover:text-red-400 active:text-red-300 text-lg leading-none shrink-0 w-6 h-6 flex items-center justify-center">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Submit button */}
          <div className="p-3 border-t border-gray-800 shrink-0">
            {iAmReady ? (
              <div className="text-center space-y-0.5">
                <p className="text-green-400 font-semibold text-sm">✓ Deck submitted ({state.deckBuilds?.[myKey]?.length ?? 0} cards)</p>
                <p className="text-gray-500 text-xs">{opponentReady ? 'Both ready — loading game…' : 'Waiting for opponent…'}</p>
              </div>
            ) : (
              <button onClick={saveDeck} disabled={saving || deckSize === 0}
                className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 disabled:opacity-40 text-black font-bold py-3 rounded-xl text-sm transition-colors">
                {saving ? 'Saving…' : `Submit Deck (${deckSize} cards)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
