import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Chat from '../components/Chat';
import { ZoomableCard } from '../components/CardZoom';
import type { GameState, PlayerKey, BattlefieldCard, GameStep } from '../lib/gameTypes';
import type { DraftState } from '../lib/types';
import {
  initGame, drawOpeningHand, mulligan, keepHand,
  drawCard, playCard, discardCard, tapToggle, addCounter, untapAll, addStunCounter,
  moveToGraveyard, returnToHand, exileCard, graveToHand,
  createToken, adjustLife, adjustPoison, nextStep, endTurn, concede,
  toggleLandRow, setBlocking, setTargeting, zoneToBattlefield, swapZones, transformCard,
  millCards, resolveScry,
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
    <div className={`bg-[#13131a] border border-[rgba(201,162,39,0.18)] rounded flex items-center justify-center p-1 ${className}`} style={style}>
      <span className="text-[#c9a227]/60 text-xs text-center leading-tight">{name}</span>
    </div>
  );

  return <img src={src} alt={name} draggable={false}
    className={`rounded object-contain ${className}`} style={style}
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
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#0d0d12ee' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="panel flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ borderColor: 'var(--border-mid)' }}>
        <button onClick={onPrev} disabled={!hasPrev}
          className="btn-ghost w-10 h-10 flex items-center justify-center disabled:opacity-20 text-2xl">‹</button>
        <span className="font-display text-gold text-sm truncate flex-1 text-center px-2">{title}</span>
        <button onClick={onClose}
          className="btn-ghost w-10 h-10 flex items-center justify-center rounded-full text-xl">✕</button>
      </div>

      {/* Scrollable body: image + actions */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Card image — fixed height so buttons always visible */}
        <div className="flex items-center justify-center px-4 pt-3 pb-2">
          <PlainCardImg name={imageName} transformed={transformed}
            className="rounded-xl shadow-2xl glow-gold-sm"
            style={{ maxHeight: '52vh', maxWidth: 'min(85vw, 360px)', width: 'auto', height: 'auto' }} />
        </div>

        {/* Action buttons */}
        {children && (
          <div className="px-4 pb-2 pt-1 space-y-2">
            {children}
          </div>
        )}

        {/* Prev/Next nav */}
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onPrev} disabled={!hasPrev}
            className="btn-ghost flex-1 disabled:opacity-30 py-2 rounded-xl text-sm font-medium">← Prev</button>
          <button onClick={onNext} disabled={!hasNext}
            className="btn-ghost flex-1 disabled:opacity-30 py-2 rounded-xl text-sm font-medium">Next →</button>
        </div>
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
      <div className="panel border rounded-xl p-4 w-full sm:max-w-sm"
        style={{ borderColor: 'var(--border-mid)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-display text-gold font-bold text-sm">{title}</h3>
          <button onClick={onCancel} className="btn-ghost text-xl w-8 h-8 flex items-center justify-center rounded">✕</button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map(item => (
            <button key={item.uid}
              className="btn-ghost w-full text-left text-sm px-4 py-3 rounded-lg"
              onClick={() => onPick(item.uid)}>
              {item.label}
            </button>
          ))}
          {items.length === 0 && <p className="text-[#c9a227]/40 text-sm text-center py-4">No valid targets</p>}
        </div>
        <button onClick={onCancel} className="mt-3 w-full text-[#c9a227]/40 text-sm hover:text-gold">Cancel</button>
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
      className={`relative flex-shrink-0 transition-transform card-hover
        ${card.tapped ? 'rotate-90 my-4 mx-4 opacity-80' : ''}
        ${isMe ? 'cursor-pointer active:scale-95' : 'cursor-zoom-in'}`}
      onClick={e => { if (isMe) { e.stopPropagation(); onOpenMenu(card); } }}
    >
      {isMe
        ? <PlainCardImg name={card.name} transformed={card.transformed} className="w-14 h-20 sm:w-16 sm:h-24" />
        : <ZoomableCard name={card.name} face={card.transformed ? 'back' : undefined} className="w-14 h-20 sm:w-16 sm:h-24" />
      }

      {card.counters !== 0 && (
        <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded leading-tight font-display
          ${card.counters > 0 ? 'bg-green-700 text-[#e0b84c]' : 'bg-red-800 text-white'}`}>
          {card.counters > 0 ? '+' : ''}{card.counters}
        </span>
      )}
      {(card.stunCounters ?? 0) > 0 && (
        <span className="absolute top-0 left-0 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded leading-tight">
          ⚡{card.stunCounters}
        </span>
      )}
      {card.isToken && (
        <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black/70 rounded-b text-gold leading-tight py-0.5">token</span>
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
          className={`absolute transition-transform ${card.tapped ? 'rotate-90 opacity-80' : ''} ${isMe ? 'cursor-pointer active:scale-95' : ''}`}
          style={{ left: i * OFFSET, zIndex: i + 1 }}
          onClick={() => isMe && onOpenMenu(card)}>
          {isMe
            ? <PlainCardImg name={card.name} transformed={card.transformed} className="w-14 h-20" />
            : <ZoomableCard name={card.name} face={card.transformed ? 'back' : undefined} className="w-14 h-20" />
          }
          {card.counters !== 0 && (
            <span className={`absolute top-0 right-0 text-xs font-bold px-1 rounded leading-tight ${card.counters > 0 ? 'bg-green-700 text-[#e0b84c]' : 'bg-red-800 text-white'}`}>
              {card.counters > 0 ? '+' : ''}{card.counters}
            </span>
          )}
        </div>
      ))}
      <span className="absolute -bottom-5 left-0 text-xs text-[#c9a227]/50 whitespace-nowrap">
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
        ? <div className="flex items-center px-2 py-1 text-[#c9a227]/30 text-xs italic font-display">{label}</div>
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
    <div className="min-h-[4rem] flex items-center px-2 py-1 text-[#c9a227]/20 text-xs italic font-display">{label}</div>
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
      <div className="divider-gold mx-2 my-1 flex items-center gap-2">
        <span className="text-[#c9a227]/50 text-[10px] uppercase tracking-widest px-1 font-display">Lands</span>
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
      {cards.length === 0 && <span className="text-[#c9a227]/30 text-sm italic py-2 px-1">No cards in hand</span>}
      {cards.map((card, i) => (
        <div key={`${card}-${i}`}
          className={`flex-shrink-0 cursor-pointer active:scale-95 transition-transform card-hover
            ${selectedIdx === i ? '-translate-y-2 ring-2 ring-[#c9a227] rounded glow-gold-sm' : ''}`}
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

  const zoneClass = zone === 'graveyard' ? 'zone-grave' : 'zone-exile';

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className={`panel ${zoneClass} border-t sm:border rounded-t-2xl sm:rounded-xl p-4 w-full sm:max-w-lg max-h-[85vh] flex flex-col`}
        style={{ borderColor: 'var(--border-mid)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="font-display text-gold font-bold">{title} ({cards.length})</h2>
          <button onClick={onClose} className="btn-ghost w-9 h-9 flex items-center justify-center text-xl rounded">✕</button>
        </div>

        {/* Card grid */}
        <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
          {cards.length === 0 && <p className="text-[#c9a227]/30 text-sm w-full py-4 text-center">Empty</p>}
          {cards.map((card, i) => (
            <div key={i} className="relative flex-shrink-0 cursor-pointer card-hover"
              onClick={() => setSelected(selected === i ? null : i)}>
              <ZoomableCard name={card} className={`w-16 h-24 sm:w-20 sm:h-28 transition-all ${selected === i ? 'ring-2 ring-[#c9a227] glow-gold-sm' : ''}`} />
            </div>
          ))}
        </div>

        {/* Action buttons for selected card */}
        {selected !== null && isMe && (
          <div className="shrink-0 mt-3 space-y-2">
            <p className="text-xs text-[#c9a227]/40 text-center truncate">{cards[selected]}</p>
            <div className="grid grid-cols-3 gap-2">
              {onReturnToHand && (
                <button onClick={() => { onReturnToHand(selected); closeActions(); onClose(); }}
                  className="btn-ghost text-xs font-medium py-2.5 rounded-xl">↩ Hand</button>
              )}
              {onToBattlefield && (
                <button onClick={() => { onToBattlefield(selected); closeActions(); onClose(); }}
                  className="btn-gold text-xs font-medium py-2.5 rounded-xl">⚔ Battlefield</button>
              )}
              {onSwapZone && (
                <button onClick={() => { onSwapZone(selected); closeActions(); }}
                  className="btn-ghost text-xs font-medium py-2.5 rounded-xl text-[#e0b84c]">
                  {zone === 'graveyard' ? '✦ → Exile' : '💀 → Grave'}
                </button>
              )}
            </div>
          </div>
        )}
        {selected !== null && !isMe && (
          <p className="text-[#c9a227]/30 text-xs mt-2 text-center shrink-0">Tap a card to see actions (your cards only)</p>
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
    <div className="panel flex items-center gap-2 px-2 py-1 rounded-lg">
      <span className="text-xs text-[#c9a227]/60 max-w-[5rem] truncate font-display">{name}</span>
      {isMe && (
        <button onClick={() => onLife(-1)}
          className="btn-ghost w-9 h-9 rounded-full text-white text-xl font-bold flex items-center justify-center">−</button>
      )}
      {editing ? (
        <input autoFocus
          className="arena-input w-14 text-center text-xl font-bold py-0.5 font-display"
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={submit} onKeyDown={e => e.key === 'Enter' && submit()} />
      ) : (
        <span
          className={`text-3xl font-bold min-w-[2rem] text-center font-display
            ${life <= 5 ? 'text-red-400' : 'text-gold-light'} ${isMe ? 'cursor-pointer' : ''}`}
          onClick={() => { if (isMe) { setVal(String(life)); setEditing(true); } }}>
          {life}
        </span>
      )}
      {isMe && (
        <button onClick={() => onLife(1)}
          className="btn-ghost w-9 h-9 rounded-full text-white text-xl font-bold flex items-center justify-center">+</button>
      )}
      {poison > 0 && <span className="text-xs text-purple-400">☠{poison}</span>}
      {isMe && (
        <button onClick={() => onPoison(1)}
          className="btn-ghost text-xs text-purple-400 px-1 py-1">☠+</button>
      )}
    </div>
  );
}

// ── Controls strip ────────────────────────────────────────────────────────────

function ControlsStrip({ state, me, acting, onNext, onEndTurn, onDraw, onToken, onUntapAll, onScry, onMill, onConcede }: {
  state: GameState; me: PlayerKey; acting: boolean;
  onNext: () => void; onEndTurn: () => void; onDraw: () => void;
  onToken: () => void; onUntapAll: () => void; onScry: () => void; onMill: () => void; onConcede: () => void;
}) {
  const opp: PlayerKey = me === 'player1' ? 'player2' : 'player1';
  const oppState = state.players[opp];
  return (
    <div className="panel px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto">
      {state.activePlayer === me ? (
        <>
          <button onClick={onNext} disabled={acting}
            className="btn-ghost disabled:opacity-50 text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap font-display">
            Next →
          </button>
          <button onClick={onEndTurn} disabled={acting}
            className="btn-gold disabled:opacity-50 text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
            End Turn
          </button>
        </>
      ) : (
        <span className="text-[#c9a227]/40 text-xs whitespace-nowrap px-1 font-display">
          {oppState.name || 'Opponent'}'s turn · {STEP_LABELS[state.step]}
        </span>
      )}
      <div className="flex-1" />
      <button onClick={onUntapAll} disabled={acting}
        className="btn-ghost disabled:opacity-50 text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        ↺ Untap All
      </button>
      <button onClick={onDraw} disabled={acting}
        className="btn-ghost disabled:opacity-50 text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        Draw
      </button>
      <button onClick={onToken}
        className="btn-ghost text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        + Token
      </button>
      <button onClick={onScry}
        className="btn-ghost text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        Scry
      </button>
      <button onClick={onMill}
        className="btn-ghost text-xs px-3 py-2 rounded-lg whitespace-nowrap">
        Mill
      </button>
      <button onClick={onConcede}
        className="btn-ghost text-red-400 hover:text-red-300 text-xs px-3 py-2 rounded-lg whitespace-nowrap">
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
  const [showScryInput, setShowScryInput] = useState(false);
  const [scryCards_, setScryCards] = useState<string[] | null>(null);
  const [showMillModal, setShowMillModal] = useState(false);
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

    if (playerKey.current !== 'player1') {
      // Player 2 arrived before player 1 created the game session — retry after a delay
      setTimeout(() => loadState(), 3000);
      return;
    }

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
    <div className="h-[100dvh] bg-[#0d0d12] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#c9a227]" />
    </div>
  );
  if (error) return (
    <div className="h-[100dvh] bg-[#0d0d12] flex items-center justify-center p-4">
      <div className="text-center panel p-8 rounded-xl" style={{ borderColor: 'var(--border-mid)' }}>
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate(`/draft/${roomCode}`)} className="text-gold underline">← Back to draft</button>
      </div>
    </div>
  );
  if (!state) return (
    <div className="h-[100dvh] bg-[#0d0d12] flex items-center justify-center p-4">
      <div className="panel text-center p-8 rounded-xl" style={{ borderColor: 'var(--border-mid)' }}>
        <p className="mb-3 text-[#c9a227]/60">Waiting for host to start the game…</p>
        <button onClick={loadState} className="btn-ghost text-gold px-4 py-2 rounded-lg text-sm">Check again</button>
      </div>
    </div>
  );
  if (!me) return (
    <div className="h-[100dvh] bg-[#0d0d12] flex items-center justify-center p-4">
      <p className="text-[#c9a227]/60">Unknown player. <button onClick={() => navigate('/')} className="text-gold underline">Go home</button></p>
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
    <div className="h-[100dvh] bg-[#0d0d12] text-white flex flex-col overflow-hidden select-none min-h-screen">

      {/* ── Header ── */}
      <div className="bg-[#13131a] border-b px-3 py-2 flex items-center justify-between gap-2 shrink-0"
        style={{ borderColor: 'var(--border-mid)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/draft/${roomCode}`)}
            className="btn-ghost text-xs py-1 px-1 rounded">← Draft</button>
          <span className="font-display text-gold text-xs bg-black/40 border px-2 py-0.5 rounded tracking-widest"
            style={{ borderColor: 'var(--border-subtle)' }}>{roomCode}</span>
        </div>

        {!inSetup && state.phase === 'playing' && (
          <>
            <div className="hidden sm:flex items-center gap-1">
              {Object.entries(STEP_LABELS).map(([step, label]) => (
                <span key={step}
                  className={`text-xs px-1.5 py-0.5 rounded font-display
                    ${state.step === step
                      ? 'text-[#e0b84c] font-bold glow-gold-sm'
                      : 'text-[#c9a227]/30'}`}
                  style={state.step === step ? { background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.35)' } : {}}>
                  {label}
                </span>
              ))}
            </div>
            <span className="sm:hidden text-xs font-bold px-2 py-0.5 rounded font-display text-[#e0b84c]"
              style={{ background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.35)' }}>
              {STEP_LABELS[state.step]} · T{state.turn}
            </span>
          </>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[#c9a227]/40 text-xs hidden sm:block font-display">T{state.turn}</span>
          <button onClick={() => setShowLog(v => !v)}
            className="btn-ghost text-xs py-1 px-1 rounded">Log</button>
        </div>
      </div>

      {/* Log overlay */}
      {showLog && (
        <div className="absolute top-12 right-2 z-40 panel border rounded-xl p-3 w-72 max-h-56 overflow-y-auto shadow-2xl"
          style={{ borderColor: 'var(--border-mid)' }}>
          {state.log.slice().reverse().map((msg, i) => (
            <p key={i} className="text-xs text-[#c9a227]/50 py-0.5 border-b last:border-0"
              style={{ borderColor: 'var(--border-subtle)' }}>{msg}</p>
          ))}
        </div>
      )}

      {/* Ended banner */}
      {state.phase === 'ended' && (
        <div className="border-b-2 p-3 text-center font-bold shrink-0 font-display text-[#e0b84c] glow-gold"
          style={{ background: 'rgba(201,162,39,0.12)', borderColor: 'var(--border-mid)' }}>
          {state.winner === me ? '🏆 You Win!' : `${oppState.name || opp} wins!`}
        </div>
      )}

      {/* ── SETUP PHASE ── */}
      {inSetup && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-gold font-display glow-gold">Opening Hand</h2>
          {needsHand && (
            <button onClick={() => push(drawOpeningHand(state, me))}
              className="btn-gold font-bold px-8 py-4 rounded-xl text-lg">
              Draw 7 Cards
            </button>
          )}
          {myState.hand.length > 0 && (
            <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
              {myState.hand.map((card, i) => (
                <ZoomableCard key={i} name={card} className="w-20 h-28 flex-shrink-0 card-hover" />
              ))}
            </div>
          )}
          {myState.hand.length > 0 && (
            <p className="text-sm text-[#c9a227]/50 font-display">Hand of {myState.hand.length} · Library: {myState.library.length}</p>
          )}
          {needsKeep && (
            <div className="flex gap-3">
              <button onClick={() => push(keepHand(state, me))}
                className="btn-gold font-bold px-6 py-3 rounded-xl">Keep</button>
              <button onClick={() => push(mulligan(state, me))}
                className="btn-ghost font-bold px-6 py-3 rounded-xl">
                Mulligan → {Math.max(myState.hand.length - 1, 1)}
              </button>
            </div>
          )}
          {myState.ready && !oppState.ready && (
            <p className="text-[#c9a227]/40 text-sm font-display">Waiting for {oppState.name || 'opponent'} to keep…</p>
          )}
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {state.phase === 'playing' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

          {/* ── Battlefields column (left on desktop, top on mobile) ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">

            {/* Opponent area */}
            <div className="zone-opp border-b flex flex-col min-h-0"
              style={{ maxHeight: '48%', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-3 py-1.5 gap-2 shrink-0">
                <LifeCounter
                  life={oppState.life} poison={oppState.poison}
                  name={oppState.name || opp}
                  isMe={false} onLife={() => {}} onPoison={() => {}}
                />
                <div className="flex gap-2 text-xs text-[#c9a227]/50">
                  <span>✋{oppState.hand.length}</span>
                  <span>📚{oppState.library.length}</span>
                  <button onClick={() => setZoneView({ player: opp, zone: 'graveyard' })}
                    className="hover:text-gold active:text-gold-light">💀{oppState.graveyard.length}</button>
                  <button onClick={() => setZoneView({ player: opp, zone: 'exile' })}
                    className="hover:text-gold active:text-gold-light">✦{oppState.exile.length}</button>
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
            <div className="lg:hidden bg-[#13131a] border-b shrink-0"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <ControlsStrip
                state={state} me={me} acting={acting}
                onNext={() => push(nextStep(state))}
                onEndTurn={() => push(endTurn(state))}
                onDraw={() => push(drawCard(state, me))}
                onToken={() => setShowTokenInput(v => !v)}
                onUntapAll={() => push(untapAll(state, me))}
                onScry={() => { setShowScryInput(v => !v); setShowTokenInput(false); }}
                onMill={() => { setShowMillModal(true); setShowTokenInput(false); setShowScryInput(false); }}
                onConcede={() => { if (window.confirm('Concede the game?')) push(concede(state, me)); }}
              />
            </div>

            {/* Token / Scry input (mobile only) */}
            {showTokenInput && (
              <div className="lg:hidden bg-[#13131a] border-b px-3 py-2 flex gap-2 shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <TokenInput tokenInput={tokenInput} setTokenInput={setTokenInput}
                  onCreate={name => { push(createToken(state, me, name)); setTokenInput(''); setShowTokenInput(false); }}
                  onClose={() => setShowTokenInput(false)} />
              </div>
            )}
            {showScryInput && (
              <div className="lg:hidden bg-[#13131a] border-b px-3 py-2 flex gap-2 shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <ScryInput
                  onScry={n => {
                    const top = myState.library.slice(0, n);
                    setScryCards(top);
                    setShowScryInput(false);
                  }}
                  onClose={() => setShowScryInput(false)} />
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
              <div className="bg-[#13131a] border-t px-3 py-2 flex items-center justify-between gap-2 shrink-0"
                style={{ borderColor: 'var(--border-mid)' }}>
                <LifeCounter
                  life={myState.life} poison={myState.poison}
                  name={myState.name || me} isMe={true}
                  onLife={d => push(adjustLife(state, me, d))}
                  onPoison={d => push(adjustPoison(state, me, d))}
                />
                <div className="flex gap-2 text-xs text-[#c9a227]/50">
                  <span>📚{myState.library.length}</span>
                  <button onClick={() => setZoneView({ player: me, zone: 'graveyard' })}
                    className="hover:text-gold active:text-gold-light py-1">💀{myState.graveyard.length}</button>
                  <button onClick={() => setZoneView({ player: me, zone: 'exile' })}
                    className="hover:text-gold active:text-gold-light py-1">✦{myState.exile.length}</button>
                </div>
              </div>
              <div className="zone-hand border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <Hand cards={myState.hand} selectedIdx={handSelected}
                  onSelect={idx => { setHandSelected(handSelected === idx ? null : idx); setCardMenu(null); }} />
              </div>
            </div>
          </div>

          {/* ── Desktop sidebar (right column, hidden on mobile) ── */}
          <div className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 bg-[#13131a] border-l overflow-hidden shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}>
            {/* My info */}
            <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <LifeCounter
                life={myState.life} poison={myState.poison}
                name={myState.name || me} isMe={true}
                onLife={d => push(adjustLife(state, me, d))}
                onPoison={d => push(adjustPoison(state, me, d))}
              />
              <div className="flex gap-3 text-xs text-[#c9a227]/50 mt-1.5">
                <span>📚{myState.library.length}</span>
                <button onClick={() => setZoneView({ player: me, zone: 'graveyard' })}
                  className="hover:text-gold">💀{myState.graveyard.length}</button>
                <button onClick={() => setZoneView({ player: me, zone: 'exile' })}
                  className="hover:text-gold">✦{myState.exile.length}</button>
              </div>
            </div>

            {/* Controls */}
            <div className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <ControlsStrip
                state={state} me={me} acting={acting}
                onNext={() => push(nextStep(state))}
                onEndTurn={() => push(endTurn(state))}
                onDraw={() => push(drawCard(state, me))}
                onToken={() => setShowTokenInput(v => !v)}
                onUntapAll={() => push(untapAll(state, me))}
                onScry={() => { setShowScryInput(v => !v); setShowTokenInput(false); }}
                onMill={() => { setShowMillModal(true); setShowTokenInput(false); setShowScryInput(false); }}
                onConcede={() => { if (window.confirm('Concede the game?')) push(concede(state, me)); }}
              />
            </div>

            {/* Token / Scry input (desktop) */}
            {showTokenInput && (
              <div className="border-b px-3 py-2 flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <TokenInput tokenInput={tokenInput} setTokenInput={setTokenInput}
                  onCreate={name => { push(createToken(state, me, name)); setTokenInput(''); setShowTokenInput(false); }}
                  onClose={() => setShowTokenInput(false)} />
              </div>
            )}
            {showScryInput && (
              <div className="border-b px-3 py-2 flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <ScryInput
                  onScry={n => {
                    const top = myState.library.slice(0, n);
                    setScryCards(top);
                    setShowScryInput(false);
                  }}
                  onClose={() => setShowScryInput(false)} />
              </div>
            )}

            {/* Hand — wraps in grid on desktop */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs text-[#c9a227]/40 mb-1 px-1 font-display">Hand ({myState.hand.length})</p>
              {myState.hand.length === 0 && <p className="text-[#c9a227]/20 text-sm italic px-1">No cards</p>}
              <div className="flex flex-wrap gap-2">
                {myState.hand.map((card, i) => (
                  <div key={`${card}-${i}`}
                    className={`flex-shrink-0 cursor-pointer active:scale-95 transition-transform card-hover
                      ${handSelected === i ? 'ring-2 ring-[#c9a227] rounded glow-gold-sm' : ''}`}
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
                className="btn-ghost text-sm font-medium py-3 rounded-xl">
                {cardMenu.tapped ? '↺ Untap' : '↷ Tap'}
              </button>
              <button onClick={() => push(transformCard(state, me, cardMenu.uid))}
                className={`btn-ghost text-sm font-medium py-3 rounded-xl
                  ${cardMenu.transformed ? 'text-[#e0b84c]' : 'text-[#c9a227]/60'}`}>
                🔄 {cardMenu.transformed ? 'Unflip' : 'Transform'}
              </button>
              <div className="flex gap-1">
                <button onClick={() => push(addCounter(state, me, cardMenu.uid, 1))}
                  className="flex-1 btn-ghost text-green-400 text-sm font-medium py-3 rounded-xl">+1/+1</button>
                <button onClick={() => push(addCounter(state, me, cardMenu.uid, -1))}
                  className="flex-1 btn-ghost text-red-400 text-sm font-medium py-3 rounded-xl">−1/−1</button>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-yellow-400 text-xs font-medium">⚡ Stun ({cardMenu.stunCounters ?? 0})</span>
                  <div className="flex gap-1 w-full">
                    <button onClick={() => push(addStunCounter(state, me, cardMenu.uid, 1))}
                      className="flex-1 btn-ghost text-yellow-400 text-sm font-medium py-2 rounded-xl">+</button>
                    <button onClick={() => push(addStunCounter(state, me, cardMenu.uid, -1))}
                      disabled={(cardMenu.stunCounters ?? 0) === 0}
                      className="flex-1 btn-ghost text-yellow-600 text-sm font-medium py-2 rounded-xl disabled:opacity-30">−</button>
                  </div>
                </div>
              </div>
              <button onClick={() => { push(returnToHand(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="btn-ghost text-sm font-medium py-3 rounded-xl">↩ To Hand</button>
              <button onClick={() => { push(moveToGraveyard(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="btn-ghost text-red-400 text-sm font-medium py-3 rounded-xl">💀 Graveyard</button>
              <button onClick={() => { push(toggleLandRow(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="btn-ghost text-gold text-sm font-medium py-3 rounded-xl">
                {cardMenu.isLand ? '⬆ → Spells' : '⬇ → Lands'}
              </button>
              <button onClick={() => { push(exileCard(state, me, cardMenu.uid)); setCardMenu(null); }}
                className="btn-ghost text-purple-400 text-sm font-medium py-3 rounded-xl">✦ Exile</button>
              {/* Block/Target — combat step only */}
              {state.step === 'combat' ? (
                <>
                  <button
                    onClick={() => {
                      if (cardMenu.blocking) { push(setBlocking(state, me as PlayerKey, cardMenu.uid, null)); setCardMenu(null); }
                      else setPicker({ mode: 'block', forUid: cardMenu.uid });
                    }}
                    className={`btn-ghost text-sm font-medium py-3 rounded-xl
                      ${cardMenu.blocking ? 'text-red-400' : 'text-[#c9a227]/60'}`}>
                    {cardMenu.blocking ? '⚔ Clear Block' : '⚔ Block…'}
                  </button>
                  <button
                    onClick={() => {
                      if (cardMenu.targeting) { push(setTargeting(state, me as PlayerKey, cardMenu.uid, null)); setCardMenu(null); }
                      else setPicker({ mode: 'target', forUid: cardMenu.uid });
                    }}
                    className={`btn-ghost text-sm font-medium py-3 rounded-xl
                      ${cardMenu.targeting ? 'text-purple-400' : 'text-[#c9a227]/60'}`}>
                    {cardMenu.targeting ? '🎯 Clear Target' : '🎯 Target…'}
                  </button>
                </>
              ) : (
                <div className="col-span-2 text-center text-[#c9a227]/25 text-xs py-2 font-display">
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
            <button onClick={() => {
              push(playCard(state, me, handSelected));
              setHandSelected(null);
            }}
              className="btn-gold font-bold py-4 rounded-xl text-sm">
              ▶ Play
            </button>
            <button onClick={() => { push(discardCard(state, me, handSelected)); setHandSelected(null); }}
              className="btn-ghost text-red-400 font-bold py-4 rounded-xl text-sm">
              💀 Discard
            </button>
          </div>
        </CardDetailModal>
      )}

      {scryCards_ && (
        <ScryModal
          cards={scryCards_}
          onResolve={(keepOnTop, putOnBottom) => {
            push(resolveScry(state, me as PlayerKey, keepOnTop, putOnBottom));
            setScryCards(null);
          }}
          onClose={() => setScryCards(null)}
        />
      )}

      {showMillModal && (
        <MillModal
          onMill={(count, target) => {
            const opp: PlayerKey = (me as PlayerKey) === 'player1' ? 'player2' : 'player1';
            push(millCards(state, target === 'opp' ? opp : me as PlayerKey, count));
            setShowMillModal(false);
          }}
          onClose={() => setShowMillModal(false)}
        />
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

// ── ScryModal ────────────────────────────────────────────────────────────────

function ScryModal({ cards, onResolve, onClose }: {
  cards: string[];
  onResolve: (keepOnTop: string[], putOnBottom: string[]) => void;
  onClose: () => void;
}) {
  const [decisions, setDecisions] = useState<('top' | 'bottom')[]>(cards.map(() => 'top'));

  function toggle(i: number) {
    setDecisions(d => d.map((v, idx) => idx === i ? (v === 'top' ? 'bottom' : 'top') : v));
  }

  function confirm() {
    const keepOnTop = cards.filter((_, i) => decisions[i] === 'top');
    const putOnBottom = cards.filter((_, i) => decisions[i] === 'bottom');
    onResolve(keepOnTop, putOnBottom);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 w-full max-w-sm space-y-4" style={{ borderColor: 'var(--border-mid)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-gold text-center font-bold">Scry {cards.length}</h3>
        <p className="text-xs text-center" style={{ color: 'rgba(200,185,150,0.5)' }}>
          Tap each card to send it to the bottom
        </p>
        <div className="space-y-2">
          {cards.map((card, i) => (
            <button key={i} onClick={() => toggle(i)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                decisions[i] === 'top'
                  ? 'btn-ghost text-[#e0b84c]'
                  : 'btn-ghost text-gray-500 line-through'
              }`}>
              <span>{card}</span>
              <span className="text-xs ml-2 shrink-0">{decisions[i] === 'top' ? '↑ Keep top' : '↓ Put bottom'}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Cancel</button>
          <button onClick={confirm} className="btn-gold flex-1 py-3 rounded-xl text-sm font-bold">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── MillModal ─────────────────────────────────────────────────────────────────

function MillModal({ onMill, onClose }: {
  onMill: (count: number, target: 'self' | 'opp') => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(1);
  const [target, setTarget] = useState<'self' | 'opp'>('opp');
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 w-full max-w-xs space-y-4" style={{ borderColor: 'var(--border-mid)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-gold text-center font-bold">Mill</h3>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setCount(c => Math.max(1, c - 1))} className="btn-ghost w-10 h-10 rounded-xl text-lg">−</button>
          <span className="text-2xl font-bold text-[#e0b84c] w-10 text-center">{count}</span>
          <button onClick={() => setCount(c => c + 1)} className="btn-ghost w-10 h-10 rounded-xl text-lg">+</button>
        </div>
        <div className="flex gap-2">
          {(['opp', 'self'] as const).map(t => (
            <button key={t} onClick={() => setTarget(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${target === t ? 'btn-gold' : 'btn-ghost'}`}>
              {t === 'opp' ? 'Opponent' : 'Yourself'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Cancel</button>
          <button onClick={() => onMill(count, target)} className="btn-gold flex-1 py-3 rounded-xl text-sm font-bold">Mill</button>
        </div>
      </div>
    </div>
  );
}

// ── ScryInput helper ──────────────────────────────────────────────────────────

function ScryInput({ onScry, onClose }: { onScry: (n: number) => void; onClose: () => void }) {
  const [count, setCount] = useState(1);
  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setCount(c => Math.max(1, c - 1))} className="btn-ghost w-9 h-9 rounded-lg text-lg">−</button>
        <span className="text-[#e0b84c] font-bold w-8 text-center">{count}</span>
        <button onClick={() => setCount(c => c + 1)} className="btn-ghost w-9 h-9 rounded-lg text-lg">+</button>
        <button onClick={() => onScry(count)} className="btn-gold font-bold px-4 py-2 rounded-lg text-sm">Scry</button>
        <button onClick={onClose} className="btn-ghost px-3 py-2 rounded-lg text-sm">✕</button>
      </div>
    </>
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
        className="arena-input flex-1 px-3 py-2 text-sm"
        placeholder="Token name (e.g. 1/1 Goblin)"
        value={tokenInput}
        onChange={e => setTokenInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && tokenInput.trim()) onCreate(tokenInput.trim());
          else if (e.key === 'Escape') onClose();
        }}
      />
      <button onClick={() => { if (tokenInput.trim()) onCreate(tokenInput.trim()); }}
        className="btn-gold font-bold px-4 py-2 rounded-lg text-sm">
        Create
      </button>
    </>
  );
}
