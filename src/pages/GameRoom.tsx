import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Chat from '../components/Chat';
import { ZoomOverlay } from '../components/CardZoom';
import type { GameState, PlayerKey, BattlefieldCard, GameStep } from '../lib/gameTypes';
import type { DraftState } from '../lib/types';
import {
  initGame, drawOpeningHand, mulligan, keepHand,
  drawCard, playCard, discardCard, tapToggle, addCounter,
  moveToGraveyard, returnToHand, exileCard, graveToHand,
  createToken, adjustLife, adjustPoison, nextStep, endTurn, concede, toggleLandRow,
} from '../lib/gameLogic';

const STEP_LABELS: Record<GameStep, string> = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw',
  main1: 'Main 1', combat: 'Combat', main2: 'Main 2', end: 'End',
};

// ── Card image ──────────────────────────────────────────────────────────────

function CardImage({ name, className = '' }: { name: string; className?: string }) {
  const [err, setErr] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() { timer.current = setTimeout(() => setZoomed(true), 400); }
  function endPress() { if (timer.current) clearTimeout(timer.current); }

  return (
    <>
      {err ? (
        <div className={`bg-gray-800 border border-gray-600 rounded flex items-center justify-center p-1 ${className}`}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          onTouchStart={startPress} onTouchEnd={endPress}>
          <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
        </div>
      ) : (
        <img src={src} alt={name} className={`rounded object-cover ${className}`} onError={() => setErr(true)}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          onTouchStart={startPress} onTouchEnd={endPress}
          onContextMenu={e => { e.preventDefault(); setZoomed(true); }}
          draggable={false}
        />
      )}
      {zoomed && <ZoomOverlay name={name} onClose={() => setZoomed(false)} />}
    </>
  );
}

function ZoomableHandCard({ name }: { name: string }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <>
      <div className="flex-shrink-0 cursor-pointer active:scale-95 transition-transform" onClick={() => setZoomed(true)}>
        <CardImage name={name} className="w-20 h-28" />
      </div>
      {zoomed && <ZoomOverlay name={name} onClose={() => setZoomed(false)} />}
    </>
  );
}

function CardBack({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-blue-950 border border-blue-700 rounded flex items-center justify-center ${className}`}>
      <span className="text-xl">🂠</span>
    </div>
  );
}

// ── Bottom action sheet (mobile-friendly card menu) ─────────────────────────

interface ActionSheetProps {
  card: BattlefieldCard;
  onTap: () => void;
  onCounter: (d: number) => void;
  onToGrave: () => void;
  onToHand: () => void;
  onExile: () => void;
  onToggleLand: () => void;
  onClose: () => void;
}

function ActionSheet({ card, onTap, onCounter, onToGrave, onToHand, onExile, onToggleLand, onClose }: ActionSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-gray-900 border-t border-gray-700 rounded-t-2xl p-4 space-y-2 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-white text-sm truncate flex-1 mr-2">{card.name}</span>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onTap}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm font-medium py-3 rounded-xl">
            {card.tapped ? '↺ Untap' : '↷ Tap'}
          </button>
          <div className="flex gap-1">
            <button onClick={() => onCounter(1)}
              className="flex-1 bg-green-900 hover:bg-green-800 active:bg-green-700 text-white text-sm font-medium py-3 rounded-xl">
              +1/+1
            </button>
            <button onClick={() => onCounter(-1)}
              className="flex-1 bg-red-950 hover:bg-red-900 active:bg-red-800 text-white text-sm font-medium py-3 rounded-xl">
              −1/−1
            </button>
          </div>
          <button onClick={onToHand}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm font-medium py-3 rounded-xl">
            ↩ To Hand
          </button>
          <button onClick={onToGrave}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-red-400 text-sm font-medium py-3 rounded-xl">
            💀 Graveyard
          </button>
          <button onClick={onToggleLand}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-yellow-400 text-sm font-medium py-3 rounded-xl">
            {card.isLand ? '⬆ Move to Spells' : '⬇ Move to Lands'}
          </button>
          <button onClick={onExile}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-purple-400 text-sm font-medium py-3 rounded-xl">
            ✦ Exile
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hand action sheet ────────────────────────────────────────────────────────

interface HandSheetProps {
  cardName: string;
  onPlay: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

function HandSheet({ cardName, onPlay, onDiscard, onClose }: HandSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-gray-900 border-t border-gray-700 rounded-t-2xl p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-semibold text-white text-sm truncate flex-1 mr-2">{cardName}</span>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onPlay}
            className="bg-green-700 hover:bg-green-600 active:bg-green-500 text-white font-bold py-4 rounded-xl text-sm">
            ▶ Play
          </button>
          <button onClick={onDiscard}
            className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-red-400 font-bold py-4 rounded-xl text-sm">
            💀 Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Battlefield ──────────────────────────────────────────────────────────────

interface BattlefieldProps {
  cards: BattlefieldCard[];
  isMe: boolean;
  onOpenMenu: (card: BattlefieldCard) => void;
}

function BattlefieldRow({ cards, isMe, onOpenMenu, label }: { cards: BattlefieldCard[]; isMe: boolean; onOpenMenu: (c: BattlefieldCard) => void; label: string }) {
  return (
    <div className="min-h-[4rem]">
      {cards.length === 0 ? (
        <div className="flex items-center px-2 py-1 text-gray-700 text-xs italic">{label}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 p-2">
          {cards.map(card => (
            <div
              key={card.uid}
              className={`relative flex-shrink-0 transition-transform ${card.tapped ? 'rotate-90 my-3 mx-2' : ''} ${isMe ? 'cursor-pointer active:scale-95' : ''}`}
              onClick={() => isMe && onOpenMenu(card)}
            >
              <CardImage name={card.name} className="w-14 h-20 sm:w-16 sm:h-24" />
              {card.counters !== 0 && (
                <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded leading-tight ${card.counters > 0 ? 'bg-green-600' : 'bg-red-700'}`}>
                  {card.counters > 0 ? '+' : ''}{card.counters}
                </span>
              )}
              {card.isToken && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black/70 rounded-b text-yellow-300 leading-tight py-0.5">token</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Battlefield({ cards, isMe, onOpenMenu }: BattlefieldProps) {
  const spells = cards.filter(c => !c.isLand);
  const lands = cards.filter(c => c.isLand);
  return (
    <div className="flex flex-col h-full">
      <BattlefieldRow cards={spells} isMe={isMe} onOpenMenu={onOpenMenu}
        label={isMe ? 'Spells (tap to open actions)' : 'Opponent spells'} />
      <div className="border-t border-gray-800/60 mx-2" />
      <BattlefieldRow cards={lands} isMe={isMe} onOpenMenu={onOpenMenu}
        label={isMe ? 'Lands' : 'Opponent lands'} />
    </div>
  );
}

// ── Hand ─────────────────────────────────────────────────────────────────────

interface HandProps {
  cards: string[];
  onSelect: (idx: number) => void;
  selectedIdx: number | null;
}

function Hand({ cards, onSelect, selectedIdx }: HandProps) {
  return (
    <div className="flex gap-2 p-2 overflow-x-auto">
      {cards.length === 0 && <span className="text-gray-600 text-sm italic py-2 px-1">No cards in hand</span>}
      {cards.map((card, i) => (
        <div
          key={`${card}-${i}`}
          className={`flex-shrink-0 cursor-pointer active:scale-95 transition-transform ${selectedIdx === i ? '-translate-y-2 ring-2 ring-yellow-400 rounded' : ''}`}
          onClick={() => onSelect(i)}
        >
          <CardImage name={card} className="w-14 h-20 sm:w-16 sm:h-24" />
        </div>
      ))}
    </div>
  );
}

// ── Zone modal ───────────────────────────────────────────────────────────────

interface ZoneModalProps {
  title: string;
  cards: string[];
  onReturnToHand?: (idx: number) => void;
  onClose: () => void;
}

function ZoneModal({ title, cards, onReturnToHand, onClose }: ZoneModalProps) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-gray-900 border-t sm:border border-gray-700 rounded-t-2xl sm:rounded-xl p-4 w-full sm:max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-white">{title} ({cards.length})</h2>
          <button onClick={onClose} className="text-gray-400 w-9 h-9 flex items-center justify-center text-xl">✕</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cards.length === 0 && <p className="text-gray-500 text-sm w-full py-4 text-center">Empty</p>}
          {cards.map((card, i) => (
            <div key={i} className="relative flex-shrink-0" onClick={() => onReturnToHand?.(i)}>
              <CardImage name={card} className="w-16 h-24 sm:w-20 sm:h-28" />
              {onReturnToHand && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded opacity-0 active:opacity-100">
                  <span className="text-white text-xs font-bold">↩ Hand</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {onReturnToHand && cards.length > 0 && (
          <p className="text-gray-500 text-xs mt-3 text-center">Tap a card to return it to hand</p>
        )}
      </div>
    </div>
  );
}

// ── Life counter ─────────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 max-w-[5rem] truncate">{name}</span>
      {isMe && (
        <button onClick={() => onLife(-1)}
          className="w-9 h-9 bg-red-900 hover:bg-red-800 active:bg-red-700 rounded-lg text-white text-xl font-bold flex items-center justify-center">
          −
        </button>
      )}
      {editing ? (
        <input autoFocus
          className="w-14 bg-gray-800 border border-yellow-500 rounded text-center text-white text-xl font-bold py-0.5"
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={submit} onKeyDown={e => e.key === 'Enter' && submit()} />
      ) : (
        <span
          className={`text-2xl font-bold min-w-[2rem] text-center ${life <= 5 ? 'text-red-400' : 'text-white'} ${isMe ? 'cursor-pointer' : ''}`}
          onClick={() => { if (isMe) { setVal(String(life)); setEditing(true); } }}>
          {life}
        </span>
      )}
      {isMe && (
        <button onClick={() => onLife(1)}
          className="w-9 h-9 bg-green-900 hover:bg-green-800 active:bg-green-700 rounded-lg text-white text-xl font-bold flex items-center justify-center">
          +
        </button>
      )}
      {poison > 0 && <span className="text-xs text-purple-400">☠{poison}</span>}
      {isMe && (
        <button onClick={() => onPoison(1)}
          className="text-xs text-purple-500 hover:text-purple-400 active:text-purple-300 px-1 py-1">☠+</button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GameRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [cardMenu, setCardMenu] = useState<BattlefieldCard | null>(null);
  const [handSelected, setHandSelected] = useState<number | null>(null);
  const [zoneView, setZoneView] = useState<{ player: PlayerKey; zone: 'graveyard' | 'exile' } | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const playerKey = useRef<PlayerKey | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    const { data: game } = await supabase
      .from('game_sessions')
      .select('state')
      .eq('room_code', roomCode)
      .single();

    if (game) { setState(game.state as GameState); setLoading(false); return; }

    if (playerKey.current !== 'player1') { setState(null); setLoading(false); return; }

    const { data: draft } = await supabase
      .from('draft_sessions').select('state').eq('room_code', roomCode).single();
    if (!draft) { setError('Draft not found'); setLoading(false); return; }

    const ds = draft.state as DraftState;
    const p1Deck = ds.deckBuilds?.player1 ?? ds.players.player1.picks;
    const p2Deck = ds.deckBuilds?.player2 ?? ds.players.player2.picks;
    const gs = initGame(
      ds.players.player1.name, p1Deck,
      ds.players.player2.name, p2Deck,
    );

    const { error: err } = await supabase.from('game_sessions').insert({ room_code: roomCode, state: gs });
    if (err) { setError(err.message); setLoading(false); return; }
    setState(gs);
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;
    const ch = supabase
      .channel(`game_${roomCode}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `room_code=eq.${roomCode}` },
        payload => { const row = payload.new as { state: GameState }; if (row?.state) setState(row.state); }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomCode, loadState]);

  async function push(newState: GameState) {
    if (!roomCode) return;
    setActing(true);
    try {
      const { error: err } = await supabase
        .from('game_sessions').update({ state: newState }).eq('room_code', roomCode);
      if (err) throw err;
      setState(newState);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally { setActing(false); }
  }

  const me = playerKey.current;
  const opp: PlayerKey = me === 'player1' ? 'player2' : 'player1';

  if (loading) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" />
    </div>
  );

  if (error) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate(`/draft/${roomCode}`)} className="text-yellow-400 underline">← Back to draft</button>
      </div>
    </div>
  );

  if (!state) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center text-gray-400">
        <p className="mb-3">Waiting for host to start the game…</p>
        <button onClick={loadState} className="bg-gray-800 text-yellow-400 px-4 py-2 rounded-lg text-sm">Check again</button>
      </div>
    </div>
  );

  if (!me) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center p-4">
      <p className="text-gray-400">Unknown player. <button onClick={() => navigate('/')} className="text-yellow-400 underline">Go home</button></p>
    </div>
  );

  const myState = state.players[me];
  const oppState = state.players[opp];
  const isMyTurn = state.activePlayer === me;
  const inSetup = state.phase === 'setup';
  const needsHand = inSetup && myState.hand.length === 0;
  const needsKeep = inSetup && myState.hand.length > 0 && !myState.ready;

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col overflow-hidden select-none">

      {/* ── Header ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/draft/${roomCode}`)}
            className="text-gray-500 hover:text-gray-300 text-xs py-1 px-1">← Draft</button>
          <span className="font-mono text-yellow-300 text-xs bg-gray-800 px-2 py-0.5 rounded tracking-widest">{roomCode}</span>
        </div>

        {/* Phase strip — hidden on mobile, shown on sm+ */}
        {!inSetup && state.phase === 'playing' && (
          <>
            <div className="hidden sm:flex items-center gap-1">
              {Object.entries(STEP_LABELS).map(([step, label]) => (
                <span key={step} className={`text-xs px-1.5 py-0.5 rounded ${state.step === step ? 'bg-yellow-600 text-black font-bold' : 'text-gray-600'}`}>
                  {label}
                </span>
              ))}
            </div>
            {/* Mobile: show only current step */}
            <span className="sm:hidden text-xs bg-yellow-700 text-yellow-100 font-bold px-2 py-0.5 rounded">
              {STEP_LABELS[state.step]} · T{state.turn}
            </span>
          </>
        )}

        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs hidden sm:block">T{state.turn}</span>
          <button onClick={() => setShowLog(v => !v)}
            className="text-gray-500 hover:text-gray-300 text-xs py-1 px-1">Log</button>
        </div>
      </div>

      {/* ── Log overlay ── */}
      {showLog && (
        <div className="absolute top-12 right-2 z-40 bg-gray-900 border border-gray-700 rounded-xl p-3 w-72 max-h-56 overflow-y-auto shadow-2xl">
          {state.log.slice().reverse().map((msg, i) => (
            <p key={i} className="text-xs text-gray-400 py-0.5 border-b border-gray-800 last:border-0">{msg}</p>
          ))}
        </div>
      )}

      {/* ── Ended banner ── */}
      {state.phase === 'ended' && (
        <div className="bg-yellow-900 border-b border-yellow-700 p-3 text-center text-yellow-200 font-bold shrink-0">
          {state.winner === me ? '🏆 You Win!' : `${oppState.name || opp} wins!`}
        </div>
      )}

      {/* ── SETUP PHASE ── */}
      {inSetup && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-yellow-400">Opening Hand</h2>
          {needsHand && (
            <button onClick={() => push(drawOpeningHand(state, me))}
              className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 text-black font-bold px-8 py-4 rounded-xl text-lg">
              Draw 7 Cards
            </button>
          )}
          {myState.hand.length > 0 && (
            <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
              {myState.hand.map((card, i) => (
                <ZoomableHandCard key={i} name={card} />
              ))}
            </div>
          )}
          {myState.hand.length > 0 && (
            <p className="text-sm text-gray-400">Hand of {myState.hand.length} · Library: {myState.library.length}</p>
          )}
          {needsKeep && (
            <div className="flex gap-3">
              <button onClick={() => push(keepHand(state, me))}
                className="bg-green-600 hover:bg-green-500 active:bg-green-400 text-white font-bold px-6 py-3 rounded-xl">
                Keep
              </button>
              <button onClick={() => push(mulligan(state, me))}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-bold px-6 py-3 rounded-xl">
                Mulligan → {Math.max(myState.hand.length - 1, 1)}
              </button>
            </div>
          )}
          {myState.ready && !oppState.ready && (
            <p className="text-gray-400 text-sm">Waiting for {oppState.name || 'opponent'} to keep…</p>
          )}
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {state.phase === 'playing' && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Opponent area (shrinks to content) */}
          <div className="bg-gray-900/60 border-b border-gray-800 shrink-0">
            {/* Opponent info bar */}
            <div className="flex items-center justify-between px-3 py-1.5 gap-2">
              <LifeCounter
                life={oppState.life} poison={oppState.poison}
                name={oppState.name || opp}
                isMe={false} onLife={() => {}} onPoison={() => {}}
              />
              <div className="flex gap-2 text-xs text-gray-500">
                <span>✋{oppState.hand.length}</span>
                <span>📚{oppState.library.length}</span>
                <button onClick={() => setZoneView({ player: opp, zone: 'graveyard' })}
                  className="hover:text-gray-300 active:text-white">💀{oppState.graveyard.length}</button>
                <button onClick={() => setZoneView({ player: opp, zone: 'exile' })}
                  className="hover:text-gray-300 active:text-white">✦{oppState.exile.length}</button>
              </div>
            </div>
            {/* Opponent hand (backs) */}
            {oppState.hand.length > 0 && (
              <div className="flex gap-1 px-3 pb-1 overflow-x-auto">
                {oppState.hand.map((_, i) => <CardBack key={i} className="w-9 h-12 flex-shrink-0" />)}
              </div>
            )}
            {/* Opponent battlefield */}
            <div className="overflow-x-auto">
              <Battlefield cards={oppState.battlefield} isMe={false} onOpenMenu={() => {}} />
            </div>
          </div>

          {/* Middle controls */}
          <div className="bg-gray-950 border-b border-gray-800 px-2 py-1.5 flex items-center gap-1.5 shrink-0 overflow-x-auto">
            {isMyTurn ? (
              <>
                <button onClick={() => push(nextStep(state))} disabled={acting}
                  className="bg-blue-700 hover:bg-blue-600 active:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
                  Next →
                </button>
                <button onClick={() => push(endTurn(state))} disabled={acting}
                  className="bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
                  End Turn
                </button>
              </>
            ) : (
              <span className="text-gray-500 text-xs whitespace-nowrap px-1">
                {oppState.name || 'Opponent'}'s turn · {STEP_LABELS[state.step]}
              </span>
            )}
            <div className="flex-1" />
            <button onClick={() => push(drawCard(state, me))} disabled={acting}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
              Draw
            </button>
            <button onClick={() => setShowTokenInput(v => !v)}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
              + Token
            </button>
            <button onClick={() => { if (window.confirm('Concede the game?')) push(concede(state, me)); }}
              className="bg-red-900 hover:bg-red-800 active:bg-red-700 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
              ⚐
            </button>
          </div>

          {/* Token input */}
          {showTokenInput && (
            <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex gap-2 shrink-0">
              <input autoFocus
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Token name (e.g. 1/1 Goblin Token)"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tokenInput.trim()) {
                    push(createToken(state, me, tokenInput.trim()));
                    setTokenInput(''); setShowTokenInput(false);
                  } else if (e.key === 'Escape') { setShowTokenInput(false); }
                }}
              />
              <button onClick={() => {
                if (tokenInput.trim()) {
                  push(createToken(state, me, tokenInput.trim()));
                  setTokenInput(''); setShowTokenInput(false);
                }
              }} className="bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm">
                Create
              </button>
            </div>
          )}

          {/* My battlefield (flex-1 = takes remaining space) */}
          <div className="flex-1 bg-green-950/10 overflow-y-auto">
            <Battlefield
              cards={myState.battlefield}
              isMe={true}
              onOpenMenu={card => { setCardMenu(card); setHandSelected(null); }}
            />
          </div>

          {/* My info bar */}
          <div className="bg-gray-900 border-t border-gray-800 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
            <LifeCounter
              life={myState.life} poison={myState.poison}
              name={myState.name || me}
              isMe={true}
              onLife={d => push(adjustLife(state, me, d))}
              onPoison={d => push(adjustPoison(state, me, d))}
            />
            <div className="flex gap-2 text-xs text-gray-500">
              <span>📚{myState.library.length}</span>
              <button onClick={() => setZoneView({ player: me, zone: 'graveyard' })}
                className="hover:text-gray-300 active:text-white py-1">💀{myState.graveyard.length}</button>
              <button onClick={() => setZoneView({ player: me, zone: 'exile' })}
                className="hover:text-gray-300 active:text-white py-1">✦{myState.exile.length}</button>
            </div>
          </div>

          {/* My hand (horizontal scroll) */}
          <div className="bg-gray-900/80 border-t border-gray-800 shrink-0">
            <Hand
              cards={myState.hand}
              selectedIdx={handSelected}
              onSelect={idx => { setHandSelected(handSelected === idx ? null : idx); setCardMenu(null); }}
            />
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {roomCode && me && <Chat roomCode={roomCode} playerName={myState?.name || me} />}

      {cardMenu && (
        <ActionSheet
          card={cardMenu}
          onTap={() => { push(tapToggle(state, me, cardMenu.uid)); setCardMenu(null); }}
          onCounter={d => { push(addCounter(state, me, cardMenu.uid, d)); }}
          onToGrave={() => { push(moveToGraveyard(state, me, cardMenu.uid)); setCardMenu(null); }}
          onToHand={() => { push(returnToHand(state, me, cardMenu.uid)); setCardMenu(null); }}
          onExile={() => { push(exileCard(state, me, cardMenu.uid)); setCardMenu(null); }}
          onToggleLand={() => { push(toggleLandRow(state, me, cardMenu.uid)); setCardMenu(null); }}
          onClose={() => setCardMenu(null)}
        />
      )}

      {handSelected !== null && myState.hand[handSelected] && (
        <HandSheet
          cardName={myState.hand[handSelected]}
          onPlay={() => { push(playCard(state, me, handSelected)); setHandSelected(null); }}
          onDiscard={() => { push(discardCard(state, me, handSelected)); setHandSelected(null); }}
          onClose={() => setHandSelected(null)}
        />
      )}

      {zoneView && (
        <ZoneModal
          title={`${state.players[zoneView.player].name || zoneView.player} — ${zoneView.zone}`}
          cards={state.players[zoneView.player][zoneView.zone]}
          onReturnToHand={zoneView.player === me && zoneView.zone === 'graveyard'
            ? idx => { push(graveToHand(state, me, idx)); setZoneView(null); }
            : undefined}
          onClose={() => setZoneView(null)}
        />
      )}
    </div>
  );
}
