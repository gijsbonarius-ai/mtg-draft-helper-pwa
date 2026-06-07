import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Chat from '../components/Chat';
import { ZoomableCard } from '../components/CardZoom';
import type { GameState, PlayerKey, BattlefieldCard, GameStep } from '../lib/gameTypes';
import type { DraftState } from '../lib/types';
import {
  initGame, drawOpeningHand, mulligan, keepHand,
  drawCard, playCard, discardCard, tapToggle, addCounter,
  moveToGraveyard, returnToHand, exileCard, graveToHand,
  createToken, adjustLife, adjustPoison, nextStep, endTurn, concede,
  toggleLandRow, setBlocking, setTargeting, zoneToBattlefield, swapZones, transformCard,
} from '../lib/gameLogic';

const STEP_LABELS: Record<GameStep, string> = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw',
  main1: 'Main 1', combat: 'Combat', main2: 'Main 2', end: 'End',
};

const SCRYFALL_URL = (name: string, back = false) =>
  `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal${back ? '&face=back' : ''}`;

// Plain card image – no tap-to-zoom; modal provides zoom in gameplay
// When transformed=true, tries the back-face URL; falls back to front if it fails
function PlainCardImg({ name, transformed = false, className = '', style }: {
  name: string; transformed?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const [backErr, setBackErr] = useState(false);
  const [frontErr, setFrontErr] = useState(false);

  // Reset backErr when transformed flips back to true
  useEffect(() => { if (transformed) setBackErr(false); }, [transformed]);

  const useBack = transformed && !backErr;
  const src = SCRYFALL_URL(name, useBack);

  function handleError() {
    if (useBack) setBackErr(true);   // silently fall back to front face
    else setFrontErr(true);
  }

  if (frontErr && !useBack) return (
    <div className={`bg-gray-800 border border-gray-600 rounded flex items-center justify-center p-1 ${className}`} style={style}>
      <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
    </div>
  );

  return <img src={src} alt={name} draggable={false}
    className={`rounded object-cover ${className}`} style={style}
    onError={handleError} />;
}

function CardBack({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded border border-blue-800/60 flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #1a3060 0%, #0a1530 70%)', boxShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
      <div className="w-3/4 h-3/4 rounded-sm border border-blue-600/40 flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse, #2040a0 0%, #0a1870 100%)' }}>
        <span className="text-blue-300/80 text-lg select-none">✦</span>
      </div>
    </div>
  );
}

// ── Card detail modal ────────────────────────────────────────────────────────

interface CardDetailModalProps {
  title: string;
  imageName: string;
  transformed?: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  children?: React.ReactNode;
}

function CardDetailModal({ title, imageName, transformed = false, onClose, onPrev, onNext, hasPrev, hasNext, children }: CardDetailModalProps) {
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -50 && onNext && hasNext) onNext();
    if (dx > 50 && onPrev && hasPrev) onPrev();
    touchX.current = null;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext && hasNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev && hasPrev) onPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/98 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-t-2 border-yellow-800/60">
        <button onClick={onPrev} disabled={!hasPrev}
          className="w-10 h-10 flex items-center justify-center text-gray-400 disabled:opacity-20 text-2xl">‹</button>
        <span className="text-white font-semibold text-sm truncate flex-1 text-center px-2">{title}</span>
        <button onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-full text-white text-xl">✕</button>
      </div>

      {/* Card image */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <PlainCardImg name={imageName} transformed={transformed}
          className="rounded-xl shadow-2xl object-contain"
          style={{ maxHeight: '52vh', maxWidth: 'min(85vw, 320px)' }} />
      </div>

      {/* Action buttons */}
      {children && (
        <div className="shrink-0 px-4 pb-4 pt-3 space-y-2">
          {children}
        </div>
      )}

      {/* Prev/Next nav */}
      <div className="flex gap-2 px-4 pb-4 shrink-0">
        <button onClick={onPrev} disabled={!hasPrev}
          className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white py-2 rounded-xl text-sm font-medium">← Prev</button>
        <button onClick={onNext} disabled={!hasNext}
          className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white py-2 rounded-xl text-sm font-medium">Next →</button>
      </div>
    </div>
  );
}

// ── Picker modal (for choosing block/target) ─────────────────────────────────

interface PickerModalProps {
  title: string;
  items: { uid: string; label: string }[];
  onPick: (uid: string) => void;
  onCancel: () => void;
}

function PickerModal({ title, items, onPick, onCancel }: PickerModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full sm:max-w-sm"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-bold text-sm">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map(item => (
            <button key={item.uid}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm px-4 py-3 rounded-lg"
              onClick={() => onPick(item.uid)}>
              {item.label}
            </button>
          ))}
          {items.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No valid targets</p>}
        </div>
        <button onClick={onCancel} className="mt-3 w-full text-gray-500 text-sm hover:text-gray-300">Cancel</button>
      </div>
    </div>
  );
}

// ── Battlefield ──────────────────────────────────────────────────────────────

interface BattlefieldCardProps {
  card: BattlefieldCard;
  isMe: boolean;
  onOpenMenu: (card: BattlefieldCard) => void;
  oppCards?: BattlefieldCard[]; // for showing block indicator
}

function BattlefieldCard_({ card, isMe, onOpenMenu, oppCards = [] }: BattlefieldCardProps) {
  const blockedBy = oppCards.find(c => c.blocking === card.uid);
  const targetedBy = oppCards.find(c => c.targeting === card.uid);
  const blockingCard = card.blocking ? oppCards.find(c => c.uid === card.blocking) : undefined;
  const targetingCard = card.targeting
    ? (card.targeting === 'player1' || card.targeting === 'player2' ? { name: card.targeting } : oppCards.find(c => c.uid === card.targeting))
    : undefined;

  // Tapped cards rotate 90°; give extra margin so they don't overlap neighbours
  return (
    <div
      className={`relative flex-shrink-0 transition-transform
        ${card.tapped ? 'rotate-90 my-4 mx-4' : ''}
        ${isMe ? 'cursor-pointer active:scale-95' : ''}`}
      onClick={() => isMe && onOpenMenu(card)}
    >
      {isMe
        ? <PlainCardImg name={card.name} transformed={card.transformed} className="w-14 h-20 sm:w-16 sm:h-24" />
        : <ZoomableCard name={card.name} face={card.transformed ? 'back' : undefined} className="w-14 h-20 sm:w-16 sm:h-24" />
      }

      {card.counters !== 0 && (
        <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded leading-tight
          ${card.counters > 0 ? 'bg-green-600' : 'bg-red-700'}`}>
          {card.counters > 0 ? '+' : ''}{card.counters}
        </span>
      )}
      {card.isToken && (
        <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black/70 rounded-b text-yellow-300 leading-tight py-0.5">token</span>
      )}

      {/* Blocking badge */}
      {(card.blocking || blockingCard) && (
        <span className="absolute top-0 left-0 bg-red-700 text-white text-[10px] font-bold px-1 rounded leading-tight">⚔</span>
      )}
      {(blockedBy || blockedBy) && (
        <span className="absolute top-0 left-0 bg-orange-700 text-white text-[10px] font-bold px-1 rounded leading-tight">⚔</span>
      )}

      {/* Target badge */}
      {(card.targeting || targetingCard || targetedBy) && (
        <span className="absolute bottom-0 right-0 bg-purple-700 text-white text-[10px] font-bold px-1 rounded leading-tight">🎯</span>
      )}

      {/* Block/target label below card (only when untapped so it doesn't clip) */}
      {!card.tapped && blockingCard && (
        <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-red-400 leading-tight truncate px-1">
          ⚔ {blockingCard.name.split(' ')[0]}
        </div>
      )}
      {!card.tapped && targetingCard && (
        <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-purple-400 leading-tight truncate px-1">
          🎯 {targetingCard.name.split(' ')[0]}
        </div>
      )}
    </div>
  );
}

// Mobile only: same-name lands fanned
function LandStack({ cards, isMe, onOpenMenu }: { cards: BattlefieldCard[]; isMe: boolean; onOpenMenu: (c: BattlefieldCard) => void; oppCards?: BattlefieldCard[] }) {
  const OFFSET = 13;
  const width = 56 + (cards.length - 1) * OFFSET;
  return (
    <div className="relative flex-shrink-0" style={{ width, height: 80 }}>
      {cards.map((card, i) => (
        <div key={card.uid}
          className={`absolute transition-transform ${card.tapped ? 'rotate-90' : ''} ${isMe ? 'cursor-pointer active:scale-95' : ''}`}
          style={{ left: i * OFFSET, zIndex: i + 1 }}
          onClick={() => isMe && onOpenMenu(card)}>
          {isMe
            ? <PlainCardImg name={card.name} transformed={card.transformed} className="w-14 h-20" />
            : <ZoomableCard name={card.name} face={card.transformed ? 'back' : undefined} className="w-14 h-20" />
          }
          {card.counters !== 0 && (
            <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded leading-tight ${card.counters > 0 ? 'bg-green-600' : 'bg-red-700'}`}>
              {card.counters > 0 ? '+' : ''}{card.counters}
            </span>
          )}
        </div>
      ))}
      <span className="absolute -bottom-5 left-0 text-xs text-gray-500 whitespace-nowrap">
        {cards[0].name.split(' ')[0]} ×{cards.length}
      </span>
    </div>
  );
}

function SpellsRow({ cards, isMe, onOpenMenu, label, oppCards }: {
  cards: BattlefieldCard[]; isMe: boolean; onOpenMenu: (c: BattlefieldCard) => void; label: string; oppCards: BattlefieldCard[]
}) {
  return (
    <div className="min-h-[5rem]">
      {cards.length === 0
        ? <div className="flex items-center px-2 py-1 text-yellow-900/60 text-xs italic">{label}</div>
        : <div className="flex flex-wrap gap-x-2 gap-y-6 p-3">
            {cards.map(card => <BattlefieldCard_ key={card.uid} card={card} isMe={isMe} onOpenMenu={onOpenMenu} oppCards={oppCards} />)}
          </div>
      }
    </div>
  );
}

function LandsRow({ cards, isMe, onOpenMenu, label, oppCards }: {
  cards: BattlefieldCard[]; isMe: boolean; onOpenMenu: (c: BattlefieldCard) => void; label: string; oppCards: BattlefieldCard[]
}) {
  const groups: BattlefieldCard[][] = [];
  const seen = new Map<string, BattlefieldCard[]>();
  for (const card of cards) {
    if (!seen.has(card.name)) { const g: BattlefieldCard[] = []; seen.set(card.name, g); groups.push(g); }
    seen.get(card.name)!.push(card);
  }

  if (cards.length === 0) return (
    <div className="min-h-[4rem] flex items-center px-2 py-1 text-gray-700 text-xs italic">{label}</div>
  );

  return (
    <div className="min-h-[5rem]">
      {/* Mobile: stacked by name */}
      <div className="flex sm:hidden flex-wrap gap-5 p-3 pb-8">
        {groups.map((group, i) =>
          group.length === 1
            ? <BattlefieldCard_ key={group[0].uid} card={group[0]} isMe={isMe} onOpenMenu={onOpenMenu} oppCards={oppCards} />
            : <LandStack key={i} cards={group} isMe={isMe} onOpenMenu={onOpenMenu} oppCards={oppCards} />
        )}
      </div>
      {/* Desktop: normal flex, grouped */}
      <div className="hidden sm:flex flex-wrap gap-x-2 gap-y-6 p-3">
        {cards.map(card => <BattlefieldCard_ key={card.uid} card={card} isMe={isMe} onOpenMenu={onOpenMenu} oppCards={oppCards} />)}
      </div>
    </div>
  );
}

function Battlefield({ cards, isMe, onOpenMenu, oppCards = [] }: {
  cards: BattlefieldCard[]; isMe: boolean; onOpenMenu: (c: BattlefieldCard) => void; oppCards?: BattlefieldCard[]
}) {
  const spells = cards.filter(c => !c.isLand);
  const lands = cards.filter(c => c.isLand);
  return (
    <div className="flex flex-col h-full">
      <SpellsRow cards={spells} isMe={isMe} onOpenMenu={onOpenMenu}
        label={isMe ? 'Spells – tap to open actions' : 'Opponent spells'} oppCards={oppCards} />
      <div className="border-t border-yellow-900/50 mx-2 my-1 flex items-center gap-2">
        <span className="text-yellow-900/70 text-[10px] uppercase tracking-widest px-1">Lands</span>
      </div>
      <LandsRow cards={lands} isMe={isMe} onOpenMenu={onOpenMenu}
        label={isMe ? 'Lands' : 'Opponent lands'} oppCards={oppCards} />
    </div>
  );
}

// ── Hand ─────────────────────────────────────────────────────────────────────

function Hand({ cards, onSelect, selectedIdx }: {
  cards: string[]; onSelect: (idx: number) => void; selectedIdx: number | null;
}) {
  return (
    <div className="flex gap-2 p-2 overflow-x-auto">
      {cards.length === 0 && <span className="text-gray-600 text-sm italic py-2 px-1">No cards in hand</span>}
      {cards.map((card, i) => (
        <div key={`${card}-${i}`}
          className={`flex-shrink-0 cursor-pointer active:scale-95 transition-transform
            ${selectedIdx === i ? '-translate-y-2 ring-2 ring-yellow-400 rounded' : ''}`}
          onClick={() => onSelect(i)}>
          <PlainCardImg name={card} className="w-14 h-20 sm:w-16 sm:h-24" />
        </div>
      ))}
    </div>
  );
}

// ── Zone modal ───────────────────────────────────────────────────────────────

interface ZoneModalProps {
  title: string;
  cards: string[];
  isMe: boolean;
  zone: 'graveyard' | 'exile';
  onReturnToHand?: (idx: number) => void;
  onToBattlefield?: (idx: number) => void;
  onSwapZone?: (idx: number) => void;
  onClose: () => void;
}

function ZoneModal({ title, cards, isMe, zone, onReturnToHand, onToBattlefield, onSwapZone, onClose }: ZoneModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  function closeActions() { setSelected(null); }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-gray-900 border-t sm:border border-gray-700 rounded-t-2xl sm:rounded-xl p-4 w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="font-bold text-white">{title} ({cards.length})</h2>
          <button onClick={onClose} className="text-gray-400 w-9 h-9 flex items-center justify-center text-xl">✕</button>
        </div>

        {/* Card grid */}
        <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
          {cards.length === 0 && <p className="text-gray-500 text-sm w-full py-4 text-center">Empty</p>}
          {cards.map((card, i) => (
            <div key={i} className="relative flex-shrink-0 cursor-pointer"
              onClick={() => setSelected(selected === i ? null : i)}>
              <ZoomableCard name={card} className={`w-16 h-24 sm:w-20 sm:h-28 transition-all ${selected === i ? 'ring-2 ring-yellow-400' : ''}`} />
            </div>
          ))}
        </div>

        {/* Action buttons for selected card */}
        {selected !== null && isMe && (
          <div className="shrink-0 mt-3 space-y-2">
            <p className="text-xs text-gray-500 text-center truncate">{cards[selected]}</p>
            <div className="grid grid-cols-3 gap-2">
              {onReturnToHand && (
                <button onClick={() => { onReturnToHand(selected); closeActions(); onClose(); }}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium py-2.5 rounded-xl">↩ Hand</button>
              )}
              {onToBattlefield && (
                <button onClick={() => { onToBattlefield(selected); closeActions(); onClose(); }}
                  className="bg-green-800 hover:bg-green-700 text-white text-xs font-medium py-2.5 rounded-xl">⚔ Battlefield</button>
              )}
              {onSwapZone && (
                <button onClick={() => { onSwapZone(selected); closeActions(); }}
                  className="bg-gray-800 hover:bg-gray-700 text-purple-300 text-xs font-medium py-2.5 rounded-xl">
                  {zone === 'graveyard' ? '✦ → Exile' : '💀 → Grave'}
                </button>
              )}
            </div>
          </div>
        )}
        {selected !== null && !isMe && (
          <p className="text-gray-600 text-xs mt-2 text-center shrink-0">Tap a card to see actions (your cards only)</p>
        )}
      </div>
    </div>
  );
}

// ── Life counter ─────────────────────────────────────────────────────────────

function LifeCounter({ life, poison, name, isMe, onLife, onPoison }: {
  life: number; poison: number; name: string; isMe: boolean;
  onLife: (d: number) => void; onPoison: (d: number) => void;
}) {
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
          className="w-9 h-9 bg-red-900 hover:bg-red-800 active:bg-red-700 rounded-full text-white text-xl font-bold flex items-center justify-center">−</button>
      )}
      {editing ? (
        <input autoFocus
          className="w-14 bg-gray-800 border border-yellow-500 rounded text-center text-white text-xl font-bold py-0.5"
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={submit} onKeyDown={e => e.key === 'Enter' && submit()} />
      ) : (
        <span
          className={`text-3xl font-bold min-w-[2rem] text-center ${life <= 5 ? 'text-red-400' : 'text-yellow-300'} ${isMe ? 'cursor-pointer' : ''}`}
          style={{ fontFamily: "'Cinzel', serif" }}
          onClick={() => { if (isMe) { setVal(String(life)); setEditing(true); } }}>
          {life}
        </span>
      )}
      {isMe && (
        <button onClick={() => onLife(1)}
          className="w-9 h-9 bg-green-900 hover:bg-green-800 active:bg-green-700 rounded-full text-white text-xl font-bold flex items-center justify-center">+</button>
      )}
      {poison > 0 && <span className="text-xs text-purple-400">☠{poison}</span>}
      {isMe && (
        <button onClick={() => onPoison(1)}
          className="text-xs text-purple-500 hover:text-purple-400 active:text-purple-300 px-1 py-1">☠+</button>
      )}
    </div>
  );
}

// ── Controls strip ────────────────────────────────────────────────────────────

function ControlsStrip({ state, me, acting, onNext, onEndTurn, onDraw, onToken, onConcede }: {
  state: GameState; me: PlayerKey; acting: boolean;
  onNext: () => void; onEndTurn: () => void; onDraw: () => void;
  onToken: () => void; onConcede: () => void;
}) {
  const opp: PlayerKey = me === 'player1' ? 'player2' : 'player1';
  const oppState = state.players[opp];
  return (
    <div className="px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto">
      {state.activePlayer === me ? (
        <>
          <button onClick={onNext} disabled={acting}
            className="bg-blue-900 hover:bg-blue-800 active:bg-blue-700 disabled:opacity-50 border border-blue-700/50 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
            Next →
          </button>
          <button onClick={onEndTurn} disabled={acting}
            className="bg-yellow-800 hover:bg-yellow-700 active:bg-yellow-600 disabled:opacity-50 border border-yellow-600/50 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
            End Turn
          </button>
        </>
      ) : (
        <span className="text-gray-500 text-xs whitespace-nowrap px-1">
          {oppState.name || 'Opponent'}'s turn · {STEP_LABELS[state.step]}
        </span>
      )}
      <div className="flex-1" />
      <button onClick={onDraw} disabled={acting}
        className="bg-gray-800 border border-gray-700/50 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        Draw
      </button>
      <button onClick={onToken}
        className="bg-gray-800 border border-gray-700/50 hover:bg-gray-700 active:bg-gray-600 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        + Token
      </button>
      <button onClick={onConcede}
        className="bg-red-900 hover:bg-red-800 active:bg-red-700 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        ⚐
      </button>
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
  // Picker: 'block' | 'target' or null
  const [picker, setPicker] = useState<{ mode: 'block' | 'target'; forUid: string } | null>(null);
  const playerKey = useRef<PlayerKey | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    playerKey.current = (localStorage.getItem(`draft_player_${roomCode}`) as PlayerKey) || null;
  }, [roomCode]);

  const loadState = useCallback(async () => {
    if (!roomCode) return;
    const { data: game } = await supabase
      .from('game_sessions').select('state').eq('room_code', roomCode).single();

    if (game) { setState(game.state as GameState); setLoading(false); return; }

    if (playerKey.current !== 'player1') { setState(null); setLoading(false); return; }

    const { data: draft } = await supabase
      .from('draft_sessions').select('state').eq('room_code', roomCode).single();
    if (!draft) { setError('Draft not found'); setLoading(false); return; }

    const ds = draft.state as DraftState;
    const p1Deck = ds.deckBuilds?.player1 ?? ds.players.player1.picks;
    const p2Deck = ds.deckBuilds?.player2 ?? ds.players.player2.picks;
    const gs = initGame(ds.players.player1.name, p1Deck, ds.players.player2.name, p2Deck);
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
  const inSetup = state.phase === 'setup';
  const needsHand = inSetup && myState.hand.length === 0;
  const needsKeep = inSetup && myState.hand.length > 0 && !myState.ready;

  // Picker items for block/target
  function getPickerItems(): { uid: string; label: string }[] {
    if (!picker) return [];
    if (picker.mode === 'block') {
      return oppState.battlefield.map(c => ({ uid: c.uid, label: `${c.name}${c.tapped ? ' (tapped)' : ''}` }));
    }
    // target: opp creatures + players
    return [
      ...oppState.battlefield.map(c => ({ uid: c.uid, label: c.name })),
      { uid: opp as string, label: `🎯 ${oppState.name || 'Opponent'} (player)` },
      { uid: me as string, label: `🎯 ${myState.name || 'Me'} (player)` },
    ];
  }

  function handlePickerSelect(uid: string) {
    if (!picker || !state) return;
    if (picker.mode === 'block') {
      push(setBlocking(state, me as PlayerKey, picker.forUid, uid));
    } else {
      push(setTargeting(state, me as PlayerKey, picker.forUid, uid));
    }
    setPicker(null);
    setCardMenu(null);
  }

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col overflow-hidden select-none">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-yellow-900/50 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/draft/${roomCode}`)}
            className="text-gray-500 hover:text-gray-300 text-xs py-1 px-1">← Draft</button>
          <span className="font-mono text-yellow-400/90 text-xs bg-black/40 border border-yellow-900/60 px-2 py-0.5 rounded tracking-widest">{roomCode}</span>
        </div>

        {!inSetup && state.phase === 'playing' && (
          <>
            <div className="hidden sm:flex items-center gap-1">
              {Object.entries(STEP_LABELS).map(([step, label]) => (
                <span key={step} className={`text-xs px-1.5 py-0.5 rounded ${state.step === step ? 'bg-yellow-700/80 text-yellow-100 font-bold' : 'text-gray-600'}`}>
                  {label}
                </span>
              ))}
            </div>
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

      {/* Log overlay */}
      {showLog && (
        <div className="absolute top-12 right-2 z-40 bg-gradient-to-b from-yellow-950/95 to-gray-950/95 border border-yellow-900/50 rounded-xl p-3 w-72 max-h-56 overflow-y-auto shadow-2xl">
          {state.log.slice().reverse().map((msg, i) => (
            <p key={i} className="text-xs text-gray-400 py-0.5 border-b border-gray-800 last:border-0">{msg}</p>
          ))}
        </div>
      )}

      {/* Ended banner */}
      {state.phase === 'ended' && (
        <div className="bg-gradient-to-r from-yellow-900 via-yellow-800 to-yellow-900 border-b-2 border-yellow-600 p-3 text-center text-yellow-200 font-bold shrink-0">
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
                <div key={i} className="flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => {}}>
                  <ZoomableCard name={card} className="w-20 h-28" />
                </div>
              ))}
            </div>
          )}
          {myState.hand.length > 0 && (
            <p className="text-sm text-gray-400">Hand of {myState.hand.length} · Library: {myState.library.length}</p>
          )}
          {needsKeep && (
            <div className="flex gap-3">
              <button onClick={() => push(keepHand(state, me))}
                className="bg-green-600 hover:bg-green-500 active:bg-green-400 text-white font-bold px-6 py-3 rounded-xl">Keep</button>
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

          {/* ── Battlefields column (left on desktop, top on mobile) ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">

            {/* Opponent area */}
            <div className="border-b border-yellow-900/30 flex flex-col min-h-0" style={{ maxHeight: '48%', background: 'radial-gradient(ellipse at 50% 100%, #2a1a08 0%, #0d0d0d 70%)' }}>
              <div className="flex items-center justify-between px-3 py-1.5 gap-2 shrink-0">
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
              {oppState.hand.length > 0 && (
                <div className="flex gap-1 px-3 pb-1 overflow-x-auto shrink-0">
                  {oppState.hand.map((_, i) => <CardBack key={i} className="w-9 h-12 flex-shrink-0" />)}
                </div>
              )}
              <div className="flex-1 overflow-y-auto min-h-0">
                <Battlefield cards={oppState.battlefield} isMe={false} onOpenMenu={() => {}}
                  oppCards={myState.battlefield} />
              </div>
            </div>

            {/* Mobile-only: controls strip between battlefields */}
            <div className="lg:hidden bg-gray-950 border-b border-gray-800 shrink-0">
              <ControlsStrip
                state={state} me={me} acting={acting}
                onNext={() => push(nextStep(state))}
                onEndTurn={() => push(endTurn(state))}
                onDraw={() => push(drawCard(state, me))}
                onToken={() => setShowTokenInput(v => !v)}
                onConcede={() => { if (window.confirm('Concede the game?')) push(concede(state, me)); }}
              />
            </div>

            {/* Token input (mobile only) */}
            {showTokenInput && (
              <div className="lg:hidden bg-gray-900 border-b border-gray-800 px-3 py-2 flex gap-2 shrink-0">
                <TokenInput tokenInput={tokenInput} setTokenInput={setTokenInput}
                  onCreate={name => { push(createToken(state, me, name)); setTokenInput(''); setShowTokenInput(false); }}
                  onClose={() => setShowTokenInput(false)} />
              </div>
            )}

            {/* My battlefield */}
            <div className="flex-1 overflow-y-auto min-h-0 zone-felt">
              <Battlefield
                cards={myState.battlefield}
                isMe={true}
                onOpenMenu={card => { setCardMenu(card); setHandSelected(null); }}
                oppCards={oppState.battlefield}
              />
            </div>

            {/* Mobile-only: my info + hand */}
            <div className="lg:hidden">
              <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-t border-yellow-900/40 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
                <LifeCounter
                  life={myState.life} poison={myState.poison}
                  name={myState.name || me} isMe={true}
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
              <div className="zone-hand border-t border-blue-900/40">
                <Hand cards={myState.hand} selectedIdx={handSelected}
                  onSelect={idx => { setHandSelected(handSelected === idx ? null : idx); setCardMenu(null); }} />
              </div>
            </div>
          </div>

          {/* ── Desktop sidebar (right column, hidden on mobile) ── */}
          <div className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 bg-gradient-to-b from-gray-950 to-gray-900 border-l border-yellow-900/30 overflow-hidden shrink-0">
            {/* My info */}
            <div className="border-b border-gray-800 px-3 py-2">
              <LifeCounter
                life={myState.life} poison={myState.poison}
                name={myState.name || me} isMe={true}
                onLife={d => push(adjustLife(state, me, d))}
                onPoison={d => push(adjustPoison(state, me, d))}
              />
              <div className="flex gap-3 text-xs text-gray-500 mt-1.5">
                <span>📚{myState.library.length}</span>
                <button onClick={() => setZoneView({ player: me, zone: 'graveyard' })}
                  className="hover:text-gray-300">💀{myState.graveyard.length}</button>
                <button onClick={() => setZoneView({ player: me, zone: 'exile' })}
                  className="hover:text-gray-300">✦{myState.exile.length}</button>
              </div>
            </div>

            {/* Controls */}
            <div className="border-b border-gray-800">
              <ControlsStrip
                state={state} me={me} acting={acting}
                onNext={() => push(nextStep(state))}
                onEndTurn={() => push(endTurn(state))}
                onDraw={() => push(drawCard(state, me))}
                onToken={() => setShowTokenInput(v => !v)}
                onConcede={() => { if (window.confirm('Concede the game?')) push(concede(state, me)); }}
              />
            </div>

            {/* Token input (desktop) */}
            {showTokenInput && (
              <div className="border-b border-gray-800 px-3 py-2 flex gap-2">
                <TokenInput tokenInput={tokenInput} setTokenInput={setTokenInput}
                  onCreate={name => { push(createToken(state, me, name)); setTokenInput(''); setShowTokenInput(false); }}
                  onClose={() => setShowTokenInput(false)} />
              </div>
            )}

            {/* Hand — wraps in grid on desktop */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs text-gray-600 mb-1 px-1">Hand ({myState.hand.length})</p>
              {myState.hand.length === 0 && <p className="text-gray-600 text-sm italic px-1">No cards</p>}
              <div className="flex flex-wrap gap-2">
                {myState.hand.map((card, i) => (
                  <div key={`${card}-${i}`}
                    className={`flex-shrink-0 cursor-pointer active:scale-95 transition-transform
                      ${handSelected === i ? 'ring-2 ring-yellow-400 rounded' : ''}`}
                    onClick={() => { setHandSelected(handSelected === i ? null : i); setCardMenu(null); }}>
                    <PlainCardImg name={card} className="w-16 h-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {roomCode && me && <Chat roomCode={roomCode} playerName={myState?.name || me} />}

      {/* Battlefield card action modal */}
      {cardMenu && (() => {
        const bf = myState.battlefield;
        const idx = bf.findIndex(c => c.uid === cardMenu.uid);
        const go = (ni: number) => setCardMenu(bf[ni]);
        return (
          <CardDetailModal
            title={cardMenu.name}
            imageName={cardMenu.name}
            transformed={cardMenu.transformed}
            onClose={() => setCardMenu(null)}
            hasPrev={idx > 0} hasNext={idx < bf.length - 1}
            onPrev={() => go(idx - 1)} onNext={() => go(idx + 1)}
          >
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { push(tapToggle(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm font-medium py-3 rounded-xl">
                {cardMenu.tapped ? '↺ Untap' : '↷ Tap'}
              </button>
              <button onClick={() => push(transformCard(state, me, cardMenu.uid))}
                className={`text-sm font-medium py-3 rounded-xl
                  ${cardMenu.transformed ? 'bg-blue-800 hover:bg-blue-700 text-blue-200' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                🔄 {cardMenu.transformed ? 'Unflip' : 'Transform'}
              </button>
              <div className="flex gap-1">
                <button onClick={() => push(addCounter(state, me, cardMenu.uid, 1))}
                  className="flex-1 bg-green-900 hover:bg-green-800 text-white text-sm font-medium py-3 rounded-xl">+1/+1</button>
                <button onClick={() => push(addCounter(state, me, cardMenu.uid, -1))}
                  className="flex-1 bg-red-950 hover:bg-red-900 text-white text-sm font-medium py-3 rounded-xl">−1/−1</button>
              </div>
              <button onClick={() => { push(returnToHand(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-3 rounded-xl">↩ To Hand</button>
              <button onClick={() => { push(moveToGraveyard(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="bg-gray-800 hover:bg-gray-700 text-red-400 text-sm font-medium py-3 rounded-xl">💀 Graveyard</button>
              <button onClick={() => { push(toggleLandRow(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="bg-gray-800 hover:bg-gray-700 text-yellow-400 text-sm font-medium py-3 rounded-xl">
                {cardMenu.isLand ? '⬆ → Spells' : '⬇ → Lands'}
              </button>
              <button onClick={() => { push(exileCard(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="bg-gray-800 hover:bg-gray-700 text-purple-400 text-sm font-medium py-3 rounded-xl">✦ Exile</button>
              {/* Block/Target — combat step only */}
              {state.step === 'combat' ? (
                <>
                  <button
                    onClick={() => {
                      if (cardMenu.blocking) { push(setBlocking(state, me as PlayerKey, cardMenu.uid, null)); setCardMenu(null); }
                      else setPicker({ mode: 'block', forUid: cardMenu.uid });
                    }}
                    className={`bg-gray-800 hover:bg-gray-700 text-sm font-medium py-3 rounded-xl
                      ${cardMenu.blocking ? 'text-red-400' : 'text-gray-300'}`}>
                    {cardMenu.blocking ? '⚔ Clear Block' : '⚔ Block…'}
                  </button>
                  <button
                    onClick={() => {
                      if (cardMenu.targeting) { push(setTargeting(state, me as PlayerKey, cardMenu.uid, null)); setCardMenu(null); }
                      else setPicker({ mode: 'target', forUid: cardMenu.uid });
                    }}
                    className={`bg-gray-800 hover:bg-gray-700 text-sm font-medium py-3 rounded-xl
                      ${cardMenu.targeting ? 'text-purple-400' : 'text-gray-300'}`}>
                    {cardMenu.targeting ? '🎯 Clear Target' : '🎯 Target…'}
                  </button>
                </>
              ) : (
                <div className="col-span-2 text-center text-gray-600 text-xs py-2">
                  Block &amp; Target available in Combat step
                </div>
              )}
            </div>
          </CardDetailModal>
        );
      })()}

      {/* Hand card modal */}
      {handSelected !== null && myState.hand[handSelected] && (
        <CardDetailModal
          title={myState.hand[handSelected]}
          imageName={myState.hand[handSelected]}
          onClose={() => setHandSelected(null)}
          hasPrev={handSelected > 0}
          hasNext={handSelected < myState.hand.length - 1}
          onPrev={() => setHandSelected(handSelected - 1)}
          onNext={() => setHandSelected(handSelected + 1)}
        >
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { push(playCard(state, me, handSelected)); setHandSelected(null); }}
              className="bg-green-700 hover:bg-green-600 active:bg-green-500 text-white font-bold py-4 rounded-xl text-sm">
              ▶ Play
            </button>
            <button onClick={() => { push(discardCard(state, me, handSelected)); setHandSelected(null); }}
              className="bg-gray-800 hover:bg-gray-700 text-red-400 font-bold py-4 rounded-xl text-sm">
              💀 Discard
            </button>
          </div>
        </CardDetailModal>
      )}

      {/* Zone view modal */}
      {zoneView && (() => {
        const isMyZone = zoneView.player === me;
        return (
          <ZoneModal
            title={`${state.players[zoneView.player].name || zoneView.player} — ${zoneView.zone}`}
            cards={state.players[zoneView.player][zoneView.zone]}
            isMe={isMyZone}
            zone={zoneView.zone}
            onReturnToHand={isMyZone ? idx => push(graveToHand(state, me as PlayerKey, idx)) : undefined}
            onToBattlefield={isMyZone ? idx => push(zoneToBattlefield(state, me as PlayerKey, zoneView.zone, idx)) : undefined}
            onSwapZone={isMyZone ? idx => push(swapZones(state, me as PlayerKey, zoneView.zone, idx)) : undefined}
            onClose={() => setZoneView(null)}
          />
        );
      })()}

      {/* Block / Target picker */}
      {picker && (
        <PickerModal
          title={picker.mode === 'block' ? '⚔ Choose creature to block' : '🎯 Choose target'}
          items={getPickerItems()}
          onPick={handlePickerSelect}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  );
}

// ── TokenInput helper ────────────────────────────────────────────────────────

function TokenInput({ tokenInput, setTokenInput, onCreate, onClose }: {
  tokenInput: string; setTokenInput: (v: string) => void;
  onCreate: (name: string) => void; onClose: () => void;
}) {
  return (
    <>
      <input autoFocus
        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
        placeholder="Token name (e.g. 1/1 Goblin)"
        value={tokenInput}
        onChange={e => setTokenInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && tokenInput.trim()) onCreate(tokenInput.trim());
          else if (e.key === 'Escape') onClose();
        }}
      />
      <button onClick={() => { if (tokenInput.trim()) onCreate(tokenInput.trim()); }}
        className="bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm">
        Create
      </button>
    </>
  );
}
