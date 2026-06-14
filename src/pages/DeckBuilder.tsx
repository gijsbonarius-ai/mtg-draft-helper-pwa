import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ZoomableCard, LongPressZoomCard } from '../components/CardZoom';
import type { DraftState, PlayerKey } from '../lib/types';

const BASIC_LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

// Work-in-progress deck saved locally during drafting (per room + player).
function loadWip(roomCode?: string): { deck: string[]; lands: Record<string, number> } | null {
  if (!roomCode) return null;
  const mk = localStorage.getItem(`draft_player_${roomCode}`);
  if (!mk) return null;
  try {
    const w = JSON.parse(localStorage.getItem(`deckwip_${roomCode}_${mk}`) || 'null');
    if (w && Array.isArray(w.deck)) {
      return { deck: w.deck as string[], lands: w.lands ?? { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 } };
    }
  } catch { /* ignore */ }
  return null;
}

interface CardData { name: string; cmc: number; type_line: string; }
type CardGroup = 'Creatures' | 'Instants' | 'Sorceries' | 'Enchantments' | 'Artifacts' | 'Lands' | 'Other';
const GROUP_ORDER: CardGroup[] = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Lands', 'Other'];
const GROUP_COLORS: Record<CardGroup, string> = {
  Creatures: 'text-green-400', Instants: 'text-blue-400', Sorceries: 'text-red-400',
  Enchantments: 'text-purple-400', Artifacts: 'text-gray-300', Lands: 'text-yellow-400', Other: 'text-gray-400',
};

function getGroup(t: string): CardGroup {
  if (/Land/i.test(t)) return 'Lands';
  if (/Creature/i.test(t)) return 'Creatures';
  if (/Instant/i.test(t)) return 'Instants';
  if (/Sorcery/i.test(t)) return 'Sorceries';
  if (/Enchantment/i.test(t)) return 'Enchantments';
  if (/Artifact/i.test(t)) return 'Artifacts';
  return 'Other';
}

async function fetchCardData(names: string[]): Promise<Map<string, CardData>> {
  const result = new Map<string, CardData>();
  for (let i = 0; i < names.length; i += 75) {
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: names.slice(i, i + 75).map(name => ({ name })) }),
      });
      for (const c of (await res.json()).data ?? [])
        result.set(c.name, { name: c.name, cmc: c.cmc ?? 0, type_line: c.type_line ?? '' });
    } catch { /* ignore */ }
  }
  return result;
}

function CardImg({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  if (err) return (
    <div className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center p-1 ${className}`} style={style}>
      <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
    </div>
  );
  return <img src={src} alt={name} draggable={false} className={`rounded-lg object-cover ${className}`} style={style} onError={() => setErr(true)} />;
}

// Small pool card — tap to toggle, long-press to zoom
function PoolCard({ name, inDeck, onAdd, onRemove }: { name: string; inDeck: boolean; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="relative flex-shrink-0">
      <LongPressZoomCard
        name={name}
        className={`w-16 h-24 transition-opacity ${inDeck ? 'opacity-100' : 'opacity-40'}`}
        onClick={() => inDeck ? onRemove() : onAdd()}
      />
      {inDeck && <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs font-bold pointer-events-none">✓</div>}
    </div>
  );
}

// Full-screen gallery: all pool cards large, scroll through, tap to add/remove
function PoolGallery({ cards, deck, onAdd, onRemove, onClose, startIdx = 0 }: {
  cards: string[]; deck: string[]; onAdd: (n: string) => void; onRemove: (n: string) => void;
  onClose: () => void; startIdx?: number;
}) {
  const [idx, setIdx] = useState(startIdx);
  const name = cards[idx];
  const inDeck = deck.includes(name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, cards.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, cards.length]);

  // Touch swipe
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -40) setIdx(i => Math.min(i + 1, cards.length - 1));
    if (dx > 40) setIdx(i => Math.max(i - 1, 0));
    touchX.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-gray-400 text-sm">{idx + 1} / {cards.length}</span>
        <span className="text-white font-semibold text-sm truncate max-w-[60%] text-center">{name}</span>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white text-xl">✕</button>
      </div>

      {/* Card image */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <CardImg name={name} className="max-h-full max-w-full object-contain" style={{ maxHeight: '65vh', maxWidth: 'min(90vw, 320px)' } as React.CSSProperties} />
      </div>

      {/* Add/remove button */}
      <div className="px-4 py-3 shrink-0">
        <button
          onClick={() => inDeck ? onRemove(name) : onAdd(name)}
          className={`w-full font-bold py-3 rounded-xl text-base transition-colors ${inDeck
            ? 'bg-red-900 hover:bg-red-800 active:bg-red-700 text-red-200'
            : 'bg-green-700 hover:bg-green-600 active:bg-green-500 text-white'}`}>
          {inDeck ? '✕ Remove from deck' : '+ Add to deck'}
        </button>
      </div>

      {/* Prev / Next */}
      <div className="flex gap-2 px-4 pb-4 shrink-0">
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}
          className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white py-2.5 rounded-xl text-sm font-medium">
          ← Prev
        </button>
        <button onClick={() => setIdx(i => Math.min(i + 1, cards.length - 1))} disabled={idx === cards.length - 1}
          className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white py-2.5 rounded-xl text-sm font-medium">
          Next →
        </button>
      </div>

      {/* Scrollable thumbnail strip */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 shrink-0">
        {cards.map((card, i) => (
          <div key={i} onClick={() => setIdx(i)}
            className={`relative flex-shrink-0 cursor-pointer rounded-md overflow-hidden transition-all ${i === idx ? 'ring-2 ring-yellow-400' : 'opacity-50'}`}>
            <CardImg name={card} className="w-10 h-14" />
            {deck.includes(card) && <div className="absolute top-0 right-0 bg-green-500 w-3 h-3 rounded-bl-md" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Deck card — tap to zoom, × to remove
function DeckCard({ name, size, onRemove }: { name: string; size: 'sm' | 'md' | 'lg'; onRemove?: () => void }) {
  const sizeClass = size === 'sm' ? 'w-12 h-[4.2rem]' : size === 'md' ? 'w-16 h-24' : 'w-24 h-[8.4rem]';
  return (
    <div className="relative flex-shrink-0">
      <ZoomableCard name={name} className={sizeClass} />
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-red-600 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs leading-none">×</button>
      )}
    </div>
  );
}

export default function DeckBuilder() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deck, setDeck] = useState<string[]>(() => loadWip(roomCode)?.deck ?? []);
  const [lands, setLands] = useState<Record<string, number>>(() => loadWip(roomCode)?.lands ?? { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 });
  const [target, setTarget] = useState<40 | 60>(60);
  const [cardData, setCardData] = useState<Map<string, CardData>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);
  const [tab, setTab] = useState<'pool' | 'deck'>('pool');
  const [gallery, setGallery] = useState<number | null>(null); // null=closed, number=startIdx
  const [deckCardSize, setDeckCardSize] = useState<'sm' | 'md' | 'lg'>('md');
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
        setCardData(await fetchCardData(picks));
        setDataLoading(false);
      }
    }
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadState();
    if (!roomCode) return;
    const ch = supabase.channel(`deckbuild_${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_sessions', filter: `room_code=eq.${roomCode}` },
        p => setState(p.new.state as DraftState)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomCode, loadState]);

  useEffect(() => {
    const myKey = playerKey.current;
    if (!state || !myKey || saving) return;
    const oppKey = myKey === 'player1' ? 'player2' : 'player1';
    if (state.deckBuilds?.[myKey] && state.deckBuilds?.[oppKey])
      navigate(`/game/${roomCode}`);
  }, [state, roomCode, navigate, saving]);

  // Persist work-in-progress deck so it survives bouncing between draft and builder.
  useEffect(() => {
    if (!roomCode) return;
    const mk = localStorage.getItem(`draft_player_${roomCode}`);
    if (!mk) return;
    localStorage.setItem(`deckwip_${roomCode}_${mk}`, JSON.stringify({ deck, lands }));
  }, [deck, lands, roomCode]);

  const myKey = playerKey.current;
  const myPicks = myKey ? (state?.players[myKey]?.picks ?? []) : [];
  const iAmReady = myKey ? !!(state?.deckBuilds?.[myKey]) : false;
  const opponentReady = myKey ? !!(state?.deckBuilds?.[myKey === 'player1' ? 'player2' : 'player1']) : false;
  const totalLands = Object.values(lands).reduce((a, b) => a + b, 0);
  const deckSize = deck.length + totalLands;

  const deckGroups = (() => {
    const groups: Partial<Record<CardGroup, { name: string; cmc: number }[]>> = {};
    for (const name of deck) {
      const d = cardData.get(name);
      const g = d ? getGroup(d.type_line) : 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g]!.push({ name, cmc: d?.cmc ?? 0 });
    }
    for (const land of BASIC_LANDS) {
      if (lands[land] > 0) {
        if (!groups['Lands']) groups['Lands'] = [];
        for (let i = 0; i < lands[land]; i++) groups['Lands']!.push({ name: land, cmc: 0 });
      }
    }
    for (const g of Object.values(groups)) g?.sort((a, b) => a.cmc - b.cmc);
    return groups;
  })();

  function addCard(name: string) { setDeck(p => [...p, name]); }
  function removeCard(name: string) { setDeck(p => { const i = p.indexOf(name); return i === -1 ? p : [...p.slice(0, i), ...p.slice(i + 1)]; }); }
  function adjustLand(name: string, d: number) { setLands(p => ({ ...p, [name]: Math.max(0, (p[name] ?? 0) + d) })); }

  async function saveDeck() {
    if (!roomCode || !myKey || !state) return;
    setSaving(true);
    try {
      const fullDeck = [...deck, ...BASIC_LANDS.flatMap(land => Array(lands[land]).fill(land))];
      const updated: DraftState = { ...state, deckBuilds: { ...state.deckBuilds, [myKey]: fullDeck } };
      const { error: err } = await supabase.from('draft_sessions').update({ state: updated }).eq('room_code', roomCode);
      if (err) throw err;
      setState(updated);
      localStorage.removeItem(`deckwip_${roomCode}_${myKey}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save deck. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" /></div>;
  if (!state || !myKey) return <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4"><p className="text-red-400">Could not load draft. <button onClick={() => navigate('/')} className="text-yellow-400 underline">Go home</button></p></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {state.phase !== 'done' && (
            <button onClick={() => navigate(`/draft/${roomCode}`)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-yellow-400 px-3 py-1 rounded-lg font-medium">← Draft</button>
          )}
          <span className="text-yellow-400 font-bold text-sm">Build Your Deck</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {([40, 60] as const).map(n => (
              <button key={n} onClick={() => setTarget(n)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${target === n ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}>{n}</button>
            ))}
          </div>
          <span className={`text-sm font-bold ${deckSize === target ? 'text-green-400' : deckSize > target ? 'text-red-400' : 'text-gray-300'}`}>{deckSize}/{target}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 shrink-0 sm:hidden">
        <button onClick={() => setTab('pool')} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'pool' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>
          Card Pool ({myPicks.length})
        </button>
        <button onClick={() => setTab('deck')} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'deck' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>
          My Deck ({deckSize})
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Card pool */}
        <div className={`flex flex-col overflow-hidden sm:flex sm:w-1/2 sm:border-r sm:border-gray-800 ${tab === 'pool' ? 'flex w-full' : 'hidden'}`}>
          <div className="flex items-center justify-between px-3 py-2 shrink-0">
            <p className="text-xs text-gray-500">Tap to add · Long-press to zoom{dataLoading && <span className="ml-1 text-gray-600">· loading…</span>}</p>
            <button onClick={() => setGallery(0)}
              className="text-xs bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-yellow-400 px-3 py-1.5 rounded-lg font-medium">
              🔍 Gallery
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-wrap gap-2">
              {myPicks.map((card, i) => {
                // Count how many times this card has appeared in the pool up to this index
                const poolCountUpToHere = myPicks.slice(0, i + 1).filter(c => c === card).length;
                const deckCount = deck.filter(c => c === card).length;
                const inDeck = deckCount >= poolCountUpToHere;
                return (
                  <PoolCard key={i} name={card} inDeck={inDeck}
                    onAdd={() => addCard(card)}
                    onRemove={() => removeCard(card)} />
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Deck */}
        <div className={`flex flex-col overflow-hidden sm:flex sm:w-1/2 ${tab === 'deck' ? 'flex w-full' : 'hidden'}`}>

          {/* Deck controls */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
            <p className="text-xs text-gray-500">Tap card to zoom · × to remove</p>
            <div className="flex gap-1">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <button key={s} onClick={() => setDeckCardSize(s)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${deckCardSize === s ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                  {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">

            {/* Basic lands */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2">Basic Lands ({totalLands})</p>
              <div className="grid grid-cols-5 gap-1.5">
                {BASIC_LANDS.map(land => (
                  <div key={land} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400">{land.slice(0, 3)}</span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => adjustLand(land, -1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold text-sm flex items-center justify-center">−</button>
                      <span className="text-white font-bold text-sm w-5 text-center">{lands[land]}</span>
                      <button onClick={() => adjustLand(land, 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold text-sm flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped deck with card images */}
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
                    <div className="flex flex-wrap gap-1.5">
                      {cards.map((card, i) => (
                        <DeckCard key={i} name={card.name} size={deckCardSize}
                          onRemove={!BASIC_LANDS.includes(card.name) ? () => removeCard(card.name) : undefined} />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Submit */}
          <div className="p-3 border-t border-gray-800 shrink-0">
            {state.phase !== 'done' ? (
              <div className="text-center space-y-1.5">
                <p className="text-gray-400 text-xs">Saved automatically. Keep drafting and come back anytime — you can submit once the draft is finished.</p>
                <button onClick={() => navigate(`/draft/${roomCode}`)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-yellow-400 font-bold py-3 rounded-xl text-sm">← Back to draft</button>
              </div>
            ) : iAmReady ? (
              <div className="text-center space-y-0.5">
                <p className="text-green-400 font-semibold text-sm">✓ Deck submitted ({state.deckBuilds?.[myKey]?.length ?? 0} cards)</p>
                <p className="text-gray-500 text-xs">{opponentReady ? 'Both ready — loading game…' : 'Waiting for opponent…'}</p>
              </div>
            ) : (
              <button onClick={saveDeck} disabled={saving || deckSize === 0}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl text-sm">
                {saving ? 'Saving…' : `Submit Deck (${deckSize} cards)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gallery overlay */}
      {gallery !== null && (
        <PoolGallery
          cards={myPicks}
          deck={deck}
          onAdd={name => addCard(name)}
          onRemove={name => removeCard(name)}
          onClose={() => setGallery(null)}
          startIdx={gallery}
        />
      )}
    </div>
  );
}
