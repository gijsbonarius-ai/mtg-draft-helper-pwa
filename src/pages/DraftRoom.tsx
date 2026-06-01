import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { joinDraft, takePile, passPile } from '../lib/winstonDraft';
import type { DraftState, PlayerKey } from '../lib/types';

function CardImage({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const [errored, setErrored] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  if (errored) {
    return (
      <div className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center ${className}`} style={style}>
        <span className="text-gray-400 text-xs text-center p-2">{name}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className={`rounded-lg object-cover ${className}`}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}

function CardBack({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-blue-950 border-2 border-blue-800 rounded-lg flex items-center justify-center ${className}`} style={style}>
      <div className="text-4xl">🂠</div>
    </div>
  );
}

interface PileProps {
  cards: string[];
  index: number;
  isCurrentPlayerTurn: boolean;
  onTake: () => void;
  onPass: () => void;
  currentPileIndex: number;
}

function Pile({ cards, index, isCurrentPlayerTurn, onTake, onPass, currentPileIndex }: PileProps) {
  const isViewing = isCurrentPlayerTurn && index === currentPileIndex;
  const isPassed = isCurrentPlayerTurn && index < currentPileIndex;

  return (
    <div className={`flex flex-col items-center gap-2 rounded-xl p-3 border-2 transition-all ${
      isViewing ? 'border-yellow-400 bg-yellow-400/10' :
      isPassed ? 'border-gray-600 opacity-50' :
      'border-gray-700'
    }`}>
      <div className="text-xs text-gray-400 font-medium">Pile {index + 1}</div>
      <div className="relative w-28 h-40">
        {cards.length === 0 ? (
          <div className="w-28 h-40 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-gray-600 text-xs">Empty</span>
          </div>
        ) : isViewing ? (
          <>
            {cards.slice(0, 3).map((_, i) => (
              <div
                key={i}
                className="absolute bg-blue-950 border border-blue-800 rounded-lg w-28 h-40"
                style={{ top: i * 3, left: i * 3, zIndex: i }}
              />
            ))}
            <CardImage name={cards[0]} className="absolute w-28 h-40" style={{ zIndex: cards.length }} />
          </>
        ) : (
          <>
            {cards.slice(0, 3).map((_, i) => (
              <CardBack
                key={i}
                className="absolute w-28 h-40"
                style={{ top: i * 3, left: i * 3, zIndex: i }}
              />
            ))}
          </>
        )}
      </div>
      <div className="text-xs text-gray-500">{cards.length} card{cards.length !== 1 ? 's' : ''}</div>
      {isViewing && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={onTake}
            className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            Take
          </button>
          <button
            onClick={onPass}
            className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            Pass
          </button>
        </div>
      )}
    </div>
  );
}

function PileDetail({ cards }: { cards: string[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Cards in this pile ({cards.length})</h3>
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
        {cards.map((card, i) => (
          <CardImage key={i} name={card} className="w-24 h-36 flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}

function PicksList({ cards, name }: { cards: string[]; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800 transition-colors"
      >
        <span className="text-sm font-medium text-white">{name}'s picks ({cards.length})</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-3 border-t border-gray-700 flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
          {cards.length === 0 ? (
            <p className="text-gray-600 text-sm">No picks yet</p>
          ) : (
            cards.map((card, i) => (
              <CardImage key={i} name={card} className="w-16 h-24 flex-shrink-0" />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DraftRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const playerKey = useRef<PlayerKey | null>(null);
  const playerName = useRef('');

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
    playerName.current = localStorage.getItem(`draft_name_${roomCode}`) || '';
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    const { data, error: err } = await supabase
      .from('draft_sessions')
      .select('state')
      .eq('room_code', roomCode)
      .single();
    if (err || !data) { setError('Room not found'); setLoading(false); return; }

    const s: DraftState = data.state;

    // If we're player2 and haven't joined yet, join now
    if (playerKey.current === 'player2' && !s.players.player2.name && playerName.current) {
      const updated = joinDraft(s, playerName.current);
      await supabase
        .from('draft_sessions')
        .update({ state: updated })
        .eq('room_code', roomCode);
      setState(updated);
    } else {
      setState(s);
    }
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;

    const channel = supabase
      .channel(`draft_${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'draft_sessions', filter: `room_code=eq.${roomCode}` },
        payload => {
          setState(payload.new.state as DraftState);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode, loadState]);

  async function updateState(newState: DraftState) {
    if (!roomCode) return;
    setActing(true);
    try {
      const { error: err } = await supabase
        .from('draft_sessions')
        .update({ state: newState })
        .eq('room_code', roomCode);
      if (err) throw err;
      setState(newState);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActing(false);
    }
  }

  function handleTake() {
    if (!state || acting) return;
    updateState(takePile(state));
  }

  function handlePass() {
    if (!state || acting) return;
    updateState(passPile(state));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => navigate('/')} className="text-yellow-400 underline">← Back to home</button>
        </div>
      </div>
    );
  }

  const myKey = playerKey.current;
  const isMyTurn = myKey === state.currentPlayer;
  const isWaiting = state.phase === 'waiting';
  const isDone = state.phase === 'done';
  const currentPileName = `Pile ${state.currentPileIndex + 1}`;
  const currentPileCards = state.piles[state.currentPileIndex] || [];

  const p1 = state.players.player1;
  const p2 = state.players.player2;
  const activePlayerName = state.players[state.currentPlayer].name || state.currentPlayer;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-yellow-400 font-bold text-sm">Cuby & The Wizards</span>
          <span className="text-gray-500 text-sm ml-2">Winston Draft</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs">Room:</span>
          <span className="font-mono font-bold text-yellow-300 tracking-widest bg-gray-800 px-2 py-0.5 rounded text-sm">
            {roomCode}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* Status banner */}
        {isWaiting ? (
          <div className="bg-blue-950 border border-blue-700 rounded-xl p-4 text-center">
            <p className="text-blue-300 font-medium">Waiting for your opponent to join…</p>
            <p className="text-blue-400 text-sm mt-1">
              Share the room code <span className="font-mono font-bold text-yellow-300">{roomCode}</span>
            </p>
          </div>
        ) : isDone ? (
          <div className="bg-green-950 border border-green-700 rounded-xl p-4 text-center space-y-3">
            <p className="text-green-300 font-bold text-lg">Draft Complete!</p>
            <p className="text-green-400 text-sm">
              {p1.name}: {p1.picks.length} cards · {p2.name}: {p2.picks.length} cards
            </p>
            <button
              onClick={() => navigate(`/game/${roomCode}`)}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg"
            >
              ▶ Play with Drafted Decks
            </button>
          </div>
        ) : (
          <div className={`rounded-xl p-3 text-center text-sm font-medium border ${
            isMyTurn
              ? 'bg-yellow-950 border-yellow-700 text-yellow-300'
              : 'bg-gray-900 border-gray-700 text-gray-400'
          }`}>
            {isMyTurn
              ? `Your turn — looking at ${currentPileName}`
              : `Waiting for ${activePlayerName}…`}
          </div>
        )}

        {/* Scoreboard */}
        {!isWaiting && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-gray-900 rounded-lg p-2 border border-gray-700">
              <div className="text-gray-400 text-xs">{p1.name || 'Player 1'}</div>
              <div className="text-white font-bold">{p1.picks.length}</div>
              <div className="text-gray-600 text-xs">picks</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2 border border-gray-700">
              <div className="text-gray-400 text-xs">Main Deck</div>
              <div className="text-yellow-400 font-bold">{state.deck.length}</div>
              <div className="text-gray-600 text-xs">remaining</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2 border border-gray-700">
              <div className="text-gray-400 text-xs">{p2.name || 'Player 2'}</div>
              <div className="text-white font-bold">{p2.picks.length}</div>
              <div className="text-gray-600 text-xs">picks</div>
            </div>
          </div>
        )}

        {/* Piles */}
        {!isWaiting && !isDone && (
          <div className="flex gap-3 justify-center flex-wrap">
            {state.piles.map((cards, idx) => (
              <Pile
                key={idx}
                cards={cards}
                index={idx}

                isCurrentPlayerTurn={isMyTurn}
                currentPileIndex={state.currentPileIndex}
                onTake={handleTake}
                onPass={handlePass}
              />
            ))}
          </div>
        )}

        {/* Current pile detail (only for active player) */}
        {!isWaiting && !isDone && isMyTurn && currentPileCards.length > 0 && (
          <PileDetail cards={currentPileCards} />
        )}

        {/* Pick lists */}
        {!isWaiting && (
          <div className="space-y-2">
            {myKey === 'player1' ? (
              <>
                <PicksList cards={p1.picks} name={p1.name || 'You'} />
                <PicksList cards={p2.picks} name={p2.name || 'Opponent'} />
              </>
            ) : (
              <>
                <PicksList cards={p2.picks} name={p2.name || 'You'} />
                <PicksList cards={p1.picks} name={p1.name || 'Opponent'} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
