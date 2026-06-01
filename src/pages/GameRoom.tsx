import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { GameState, PlayerKey, BattlefieldCard, GameStep } from '../lib/gameTypes';
import type { DraftState } from '../lib/types';
import {
  initGame, drawOpeningHand, mulligan, keepHand,
  drawCard, playCard, discardCard, tapToggle, addCounter,
  moveToGraveyard, returnToHand, exileCard, graveToHand,
  createToken, adjustLife, adjustPoison, nextStep, endTurn, concede,
} from '../lib/gameLogic';

const STEP_LABELS: Record<GameStep, string> = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw',
  main1: 'Main 1', combat: 'Combat', main2: 'Main 2', end: 'End',
};

function CardImage({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  if (err) return (
    <div className={`bg-gray-800 border border-gray-600 rounded flex items-center justify-center p-1 ${className}`} style={style}>
      <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
    </div>
  );
  return <img src={src} alt={name} className={`rounded object-cover ${className}`} style={style} onError={() => setErr(true)} />;
}

function CardBack({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-blue-950 border border-blue-700 rounded flex items-center justify-center ${className}`} style={style}>
      <span className="text-2xl">🂠</span>
    </div>
  );
}

interface CardMenuProps {
  card: BattlefieldCard;
  onTap: () => void;
  onCounter: (d: number) => void;
  onToGrave: () => void;
  onToHand: () => void;
  onExile: () => void;
  onClose: () => void;
}

function CardMenu({ card, onTap, onCounter, onToGrave, onToHand, onExile, onClose }: CardMenuProps) {
  return (
    <div className="absolute z-50 top-0 left-full ml-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 min-w-36 space-y-1">
      <button onClick={onTap} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700">
        {card.tapped ? '↺ Untap' : '↷ Tap'}
      </button>
      <div className="flex gap-1">
        <button onClick={() => onCounter(1)} className="flex-1 text-xs px-2 py-1.5 rounded hover:bg-gray-700 bg-gray-750">+1/+1 ▲</button>
        <button onClick={() => onCounter(-1)} className="flex-1 text-xs px-2 py-1.5 rounded hover:bg-gray-700 bg-gray-750">-1/-1 ▼</button>
      </div>
      <button onClick={onToHand} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700">↩ To Hand</button>
      <button onClick={onToGrave} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700 text-red-400">💀 To Graveyard</button>
      <button onClick={onExile} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700 text-purple-400">✦ Exile</button>
      <button onClick={onClose} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700 text-gray-500">✕ Cancel</button>
    </div>
  );
}

interface BattlefieldProps {
  cards: BattlefieldCard[];
  isMe: boolean;
  onAction: (uid: string, action: string) => void;
}

function Battlefield({ cards, isMe, onAction }: BattlefieldProps) {
  const [menuUid, setMenuUid] = useState<string | null>(null);

  function handleClick(card: BattlefieldCard) {
    if (!isMe) return;
    if (menuUid === card.uid) { setMenuUid(null); return; }
    // Quick tap/untap on single click if no menu
    setMenuUid(card.uid);
  }

  return (
    <div className="min-h-28 flex flex-wrap gap-2 p-2 relative" onClick={e => { if (e.target === e.currentTarget) setMenuUid(null); }}>
      {cards.length === 0 && (
        <div className="w-full flex items-center justify-center text-gray-700 text-sm italic">
          {isMe ? 'Your battlefield — play cards here' : 'Opponent\'s battlefield'}
        </div>
      )}
      {cards.map(card => (
        <div key={card.uid} className={`relative flex-shrink-0 cursor-pointer transition-transform ${card.tapped ? 'rotate-90 mt-3 mr-3' : ''}`}
          onClick={() => handleClick(card)}
        >
          <CardImage name={card.name} className="w-16 h-24 md:w-20 md:h-28" />
          {card.counters !== 0 && (
            <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded ${card.counters > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
              {card.counters > 0 ? '+' : ''}{card.counters}
            </span>
          )}
          {card.isToken && (
            <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black/70 rounded-b text-yellow-300">token</span>
          )}
          {menuUid === card.uid && isMe && (
            <CardMenu
              card={card}
              onTap={() => { onAction(card.uid, 'tap'); setMenuUid(null); }}
              onCounter={d => { onAction(card.uid, `counter:${d}`); }}
              onToGrave={() => { onAction(card.uid, 'grave'); setMenuUid(null); }}
              onToHand={() => { onAction(card.uid, 'hand'); setMenuUid(null); }}
              onExile={() => { onAction(card.uid, 'exile'); setMenuUid(null); }}
              onClose={() => setMenuUid(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface HandProps {
  cards: string[];
  onPlay: (idx: number) => void;
  onDiscard: (idx: number) => void;
}

function Hand({ cards, onPlay, onDiscard }: HandProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {cards.length === 0 && <span className="text-gray-600 text-sm italic">No cards in hand</span>}
      {cards.map((card, i) => (
        <div key={`${card}-${i}`} className="relative flex-shrink-0" onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}>
          <CardImage name={card} className={`w-16 h-24 md:w-20 md:h-28 cursor-pointer transition-transform hover:-translate-y-2 ${selectedIdx === i ? '-translate-y-3 ring-2 ring-yellow-400' : ''}`} />
          {selectedIdx === i && (
            <div className="absolute z-50 top-0 left-full ml-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 min-w-28 space-y-1">
              <button onClick={() => { onPlay(i); setSelectedIdx(null); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-green-700 text-green-300">▶ Play</button>
              <button onClick={() => { onDiscard(i); setSelectedIdx(null); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-red-900 text-red-400">💀 Discard</button>
              <button onClick={() => setSelectedIdx(null)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-700 text-gray-500">✕ Cancel</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ZoneModalProps {
  title: string;
  cards: string[];
  onReturnToHand?: (idx: number) => void;
  onClose: () => void;
}

function ZoneModal({ title, cards, onReturnToHand, onClose }: ZoneModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-3">
          <h2 className="font-bold text-white">{title} ({cards.length})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cards.length === 0 && <p className="text-gray-500 text-sm">Empty</p>}
          {cards.map((card, i) => (
            <div key={i} className="relative group flex-shrink-0">
              <CardImage name={card} className="w-20 h-28" />
              {onReturnToHand && (
                <button onClick={() => { onReturnToHand(i); onClose(); }}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white rounded transition-opacity">
                  ↩ Hand
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LifeCounterProps {
  life: number;
  poison: number;
  name: string;
  isMe: boolean;
  onLife: (d: number) => void;
  onPoison: (d: number) => void;
}

function LifeCounter({ life, poison, name, isMe, onLife, onPoison }: LifeCounterProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  function submit() {
    const n = parseInt(val);
    if (!isNaN(n)) onLife(n - life);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 hidden sm:block">{name}</span>
      {isMe && (
        <button onClick={() => onLife(-1)} className="w-7 h-7 bg-red-900 hover:bg-red-700 rounded text-white text-lg font-bold leading-none">−</button>
      )}
      {editing ? (
        <input autoFocus className="w-16 bg-gray-800 border border-yellow-500 rounded text-center text-white text-xl font-bold"
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={submit} onKeyDown={e => e.key === 'Enter' && submit()} />
      ) : (
        <span className={`text-2xl font-bold cursor-pointer ${life <= 5 ? 'text-red-400' : 'text-white'}`}
          onClick={() => { if (isMe) { setVal(String(life)); setEditing(true); } }}>
          {life}
        </span>
      )}
      {isMe && (
        <button onClick={() => onLife(1)} className="w-7 h-7 bg-green-900 hover:bg-green-700 rounded text-white text-lg font-bold leading-none">+</button>
      )}
      {poison > 0 && (
        <span className="text-xs text-purple-400">☠ {poison}</span>
      )}
      {isMe && (
        <button onClick={() => onPoison(1)} className="text-xs text-purple-400 hover:text-purple-300 px-1">+☠</button>
      )}
    </div>
  );
}

export default function GameRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [zoneView, setZoneView] = useState<{ player: PlayerKey; zone: 'graveyard' | 'exile' } | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const playerKey = useRef<PlayerKey | null>(null);
  const playerName = useRef('');

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
    playerName.current = localStorage.getItem(`draft_name_${roomCode}`) || '';
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    // Check if game session exists
    const { data: game } = await supabase
      .from('game_sessions')
      .select('state')
      .eq('room_code', roomCode)
      .single();

    if (game) {
      setState(game.state as GameState);
      setLoading(false);
      return;
    }

    // No game yet — init from draft if host
    if (playerKey.current !== 'player1') {
      // Wait for host to create game
      setState(null);
      setLoading(false);
      return;
    }

    const { data: draft } = await supabase
      .from('draft_sessions')
      .select('state')
      .eq('room_code', roomCode)
      .single();

    if (!draft) { setError('Draft not found'); setLoading(false); return; }
    const draftState = draft.state as DraftState;
    const gameState = initGame(draftState.players.player1.picks, draftState.players.player2.picks);

    const { error: err } = await supabase
      .from('game_sessions')
      .insert({ room_code: roomCode, state: gameState });

    if (err) { setError(err.message); setLoading(false); return; }
    setState(gameState);
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;

    const channel = supabase
      .channel(`game_${roomCode}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `room_code=eq.${roomCode}` },
        payload => {
          const row = payload.new as { state: GameState };
          if (row?.state) setState(row.state);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode, loadState]);

  async function push(newState: GameState) {
    if (!roomCode) return;
    setActing(true);
    try {
      const { error: err } = await supabase
        .from('game_sessions')
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

  const me = playerKey.current;
  const opp: PlayerKey = me === 'player1' ? 'player2' : 'player1';

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate(`/draft/${roomCode}`)} className="text-yellow-400 underline">← Back to draft</button>
      </div>
    </div>
  );

  if (!state) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center text-gray-400">
        <p className="mb-2">Waiting for host to start the game…</p>
        <button onClick={loadState} className="text-yellow-400 underline text-sm">Check again</button>
      </div>
    </div>
  );

  if (!me) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <p className="text-gray-400">Unknown player. <button onClick={() => navigate('/')} className="text-yellow-400 underline">Go home</button></p>
    </div>
  );

  const myState = state.players[me];
  const oppState = state.players[opp];
  const isMyTurn = state.activePlayer === me;
  const p1name = localStorage.getItem(`draft_name_${roomCode}`) || me;

  // Setup phase helpers
  const inSetup = state.phase === 'setup';
  const needsHand = inSetup && myState.hand.length === 0;
  const needsKeep = inSetup && myState.hand.length > 0 && !myState.ready;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/draft/${roomCode}`)} className="text-gray-500 hover:text-gray-300 text-xs">← Draft</button>
          <span className="font-mono text-yellow-300 text-xs bg-gray-800 px-2 py-0.5 rounded">{roomCode}</span>
        </div>
        {!inSetup && state.phase !== 'ended' && (
          <div className="flex items-center gap-2">
            {Object.entries(STEP_LABELS).map(([step, label]) => (
              <span key={step} className={`text-xs px-2 py-0.5 rounded ${state.step === step ? 'bg-yellow-600 text-black font-bold' : 'text-gray-600'}`}>
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs hidden sm:block">T{state.turn}</span>
          <button onClick={() => setShowLog(v => !v)} className="text-gray-500 hover:text-gray-300 text-xs">Log</button>
        </div>
      </div>

      {/* Log overlay */}
      {showLog && (
        <div className="absolute top-10 right-2 z-40 bg-gray-900 border border-gray-700 rounded-xl p-3 max-w-xs max-h-64 overflow-y-auto shadow-xl">
          {state.log.slice().reverse().map((msg, i) => (
            <p key={i} className="text-xs text-gray-400 py-0.5 border-b border-gray-800">{msg}</p>
          ))}
        </div>
      )}

      {/* Ended banner */}
      {state.phase === 'ended' && (
        <div className="bg-yellow-900 border-b border-yellow-700 p-3 text-center text-yellow-300 font-bold">
          {state.winner === me ? '🏆 You Win!' : `${state.winner} wins!`}
        </div>
      )}

      {/* SETUP PHASE */}
      {inSetup && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <h2 className="text-xl font-bold text-yellow-400">Opening Hand</h2>
          {needsHand && (
            <button onClick={() => push(drawOpeningHand(state, me))}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl">
              Draw 7 Cards
            </button>
          )}
          {myState.hand.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 justify-center">
                {myState.hand.map((card, i) => (
                  <CardImage key={i} name={card} className="w-20 h-28" />
                ))}
              </div>
              <div className="text-sm text-gray-400">
                Hand of {myState.hand.length} · Library: {myState.library.length}
              </div>
            </>
          )}
          {needsKeep && (
            <div className="flex gap-3">
              <button onClick={() => push(keepHand(state, me))}
                className="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2 rounded-lg">
                Keep
              </button>
              <button onClick={() => push(mulligan(state, me))}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-5 py-2 rounded-lg">
                Mulligan to {Math.max(myState.hand.length - 1, 1)}
              </button>
            </div>
          )}
          {myState.ready && !oppState.ready && (
            <p className="text-gray-400 text-sm">Waiting for opponent to keep…</p>
          )}
          {oppState.ready && myState.ready && (
            <p className="text-green-400 text-sm">Both players ready!</p>
          )}
        </div>
      )}

      {/* PLAYING PHASE */}
      {state.phase === 'playing' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Opponent area */}
          <div className="border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-between px-3 py-1.5">
              <LifeCounter
                life={oppState.life}
                poison={oppState.poison}
                name={opp === 'player1' ? (localStorage.getItem(`draft_name_${roomCode}`) || opp) : (localStorage.getItem(`draft_name_${roomCode}`) || opp)}
                isMe={false}
                onLife={() => {}}
                onPoison={() => {}}
              />
              <div className="flex gap-3 text-xs text-gray-500">
                <span>Hand: {oppState.hand.length}</span>
                <span>Library: {oppState.library.length}</span>
                <button onClick={() => setZoneView({ player: opp, zone: 'graveyard' })}
                  className="hover:text-gray-300">GY: {oppState.graveyard.length}</button>
                <button onClick={() => setZoneView({ player: opp, zone: 'exile' })}
                  className="hover:text-gray-300">Ex: {oppState.exile.length}</button>
              </div>
            </div>
            {/* Opponent hand (backs) */}
            <div className="flex gap-1 px-3 pb-1 flex-wrap">
              {oppState.hand.map((_, i) => (
                <CardBack key={i} className="w-10 h-14" />
              ))}
            </div>
            {/* Opponent battlefield */}
            <Battlefield cards={oppState.battlefield} isMe={false} onAction={() => {}} />
          </div>

          {/* Middle controls */}
          <div className="bg-gray-950 border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              {isMyTurn && (
                <>
                  <button onClick={() => push(nextStep(state))} disabled={acting}
                    className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    Next Phase →
                  </button>
                  <button onClick={() => push(endTurn(state))} disabled={acting}
                    className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    End Turn
                  </button>
                </>
              )}
              {!isMyTurn && (
                <span className="text-gray-500 text-sm">Opponent's turn — {STEP_LABELS[state.step]}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => push(drawCard(state, me))} disabled={acting}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg">
                Draw
              </button>
              <button onClick={() => setShowTokenInput(v => !v)}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg">
                + Token
              </button>
              <button onClick={() => { if (window.confirm('Concede?')) push(concede(state, me)); }}
                className="bg-red-900 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">
                Concede
              </button>
            </div>
          </div>

          {/* Token input */}
          {showTokenInput && (
            <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex gap-2">
              <input
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                placeholder="Token name (e.g. 1/1 Goblin)"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tokenInput.trim()) {
                    push(createToken(state, me, tokenInput.trim()));
                    setTokenInput('');
                    setShowTokenInput(false);
                  }
                }}
              />
              <button onClick={() => {
                if (tokenInput.trim()) {
                  push(createToken(state, me, tokenInput.trim()));
                  setTokenInput('');
                  setShowTokenInput(false);
                }
              }} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded">
                Create
              </button>
            </div>
          )}

          {/* My battlefield */}
          <div className="bg-green-950/20 border-b border-gray-800 overflow-y-auto" style={{ minHeight: '120px' }}>
            <Battlefield
              cards={myState.battlefield}
              isMe={true}
              onAction={(uid, action) => {
                if (action === 'tap') push(tapToggle(state, me, uid));
                else if (action.startsWith('counter:')) push(addCounter(state, me, uid, parseInt(action.split(':')[1])));
                else if (action === 'grave') push(moveToGraveyard(state, me, uid));
                else if (action === 'hand') push(returnToHand(state, me, uid));
                else if (action === 'exile') push(exileCard(state, me, uid));
              }}
            />
          </div>

          {/* My info bar */}
          <div className="bg-gray-900 px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
            <LifeCounter
              life={myState.life}
              poison={myState.poison}
              name={p1name}
              isMe={true}
              onLife={d => push(adjustLife(state, me, d))}
              onPoison={d => push(adjustPoison(state, me, d))}
            />
            <div className="flex gap-3 text-xs text-gray-500">
              <span>Library: {myState.library.length}</span>
              <button onClick={() => setZoneView({ player: me, zone: 'graveyard' })}
                className="hover:text-gray-300">GY: {myState.graveyard.length}</button>
              <button onClick={() => setZoneView({ player: me, zone: 'exile' })}
                className="hover:text-gray-300">Ex: {myState.exile.length}</button>
            </div>
          </div>

          {/* My hand */}
          <div className="bg-gray-900/80 overflow-x-auto">
            <Hand
              cards={myState.hand}
              onPlay={idx => push(playCard(state, me, idx))}
              onDiscard={idx => push(discardCard(state, me, idx))}
            />
          </div>
        </div>
      )}

      {/* Zone modal */}
      {zoneView && (
        <ZoneModal
          title={`${zoneView.player}'s ${zoneView.zone}`}
          cards={state.players[zoneView.player][zoneView.zone]}
          onReturnToHand={zoneView.player === me && zoneView.zone === 'graveyard'
            ? (idx) => push(graveToHand(state, me, idx))
            : undefined}
          onClose={() => setZoneView(null)}
        />
      )}
    </div>
  );
}
