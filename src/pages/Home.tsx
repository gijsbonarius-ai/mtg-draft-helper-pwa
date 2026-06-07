import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { initDraft } from '../lib/winstonDraft';
import { initGame } from '../lib/gameLogic';
import { CUBE_CARDS } from '../lib/cards';
import type { DraftState } from '../lib/types';

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Reusable primitives ────────────────────────────────────────────────────

function GoldDivider({ label }: { label?: string }) {
  return (
    <div className="divider-gold text-xs text-gold/60 tracking-widest uppercase">
      {label}
    </div>
  );
}

function ArenaInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`arena-input w-full rounded-lg px-4 py-3 text-sm ${props.className ?? ''}`}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold tracking-widest uppercase text-gold/70 mb-2">
      {children}
    </label>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardCount, setCardCount] = useState(90);
  const [createdGameRoom, setCreatedGameRoom] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0d0d12' }}>
        <div className="panel rounded-2xl p-8 max-w-md w-full text-center border-red-900/60">
          <h1 className="font-display text-xl text-red-400 mb-3">Supabase not configured</h1>
          <p className="text-sm" style={{ color: 'rgba(200,185,150,0.7)' }}>
            Create a <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-400">.env</code> file with:
          </p>
          <pre className="mt-3 text-left bg-black/50 border border-white/8 rounded-lg p-3 text-xs text-green-400 leading-relaxed">
VITE_SUPABASE_URL=https://xxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJ...
          </pre>
        </div>
      </div>
    );
  }

  // ── Handlers (unchanged logic) ───────────────────────────────────────────

  async function handleSkipToDeckBuilder() {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true); setError('');
    try {
      const roomCode = generateRoomCode();
      const shuffled = [...CUBE_CARDS].sort(() => Math.random() - 0.5).slice(0, 60);
      const state: DraftState = {
        phase: 'done', deck: [], piles: [[], [], []],
        players: {
          player1: { name: name.trim(), picks: shuffled.slice(0, 30) },
          player2: { name: 'Player 2', picks: shuffled.slice(30, 60) },
        },
        currentPlayer: 'player1', currentPileIndex: 0,
      };
      const { error: err } = await supabase.from('draft_sessions').insert({ room_code: roomCode, state });
      if (err) throw err;
      localStorage.setItem(`draft_player_${roomCode}`, 'player1');
      localStorage.setItem(`draft_name_${roomCode}`, name.trim());
      navigate(`/deckbuild/${roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  async function handleSkipToPlay() {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true); setError('');
    try {
      const roomCode = generateRoomCode();
      const shuffled = [...CUBE_CARDS].sort(() => Math.random() - 0.5).slice(0, 60);
      const p1Deck = shuffled.slice(0, 30);
      const p2Deck = shuffled.slice(30, 60);
      const draftState: DraftState = {
        phase: 'done', deck: [], piles: [[], [], []],
        players: {
          player1: { name: name.trim(), picks: p1Deck },
          player2: { name: 'Player 2', picks: p2Deck },
        },
        currentPlayer: 'player1', currentPileIndex: 0,
        deckBuilds: { player1: p1Deck, player2: p2Deck },
      };
      const gameState = initGame(name.trim(), p1Deck, 'Player 2', p2Deck);
      const [draftRes, gameRes] = await Promise.all([
        supabase.from('draft_sessions').insert({ room_code: roomCode, state: draftState }),
        supabase.from('game_sessions').insert({ room_code: roomCode, state: gameState }),
      ]);
      if (draftRes.error) throw draftRes.error;
      if (gameRes.error) throw gameRes.error;
      localStorage.setItem(`draft_player_${roomCode}`, 'player1');
      localStorage.setItem(`draft_name_${roomCode}`, name.trim());
      setCreatedGameRoom(roomCode);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true); setError('');
    try {
      const roomCode = generateRoomCode();
      const state = initDraft(name.trim(), cardCount);
      const { error: err } = await supabase.from('draft_sessions').insert({ room_code: roomCode, state });
      if (err) throw err;
      localStorage.setItem(`draft_player_${roomCode}`, 'player1');
      localStorage.setItem(`draft_name_${roomCode}`, name.trim());
      navigate(`/draft/${roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true); setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const { data, error: err } = await supabase
        .from('draft_sessions').select('*').eq('room_code', code).single();
      if (err || !data) { setError('Room not found'); return; }
      const existing = localStorage.getItem(`draft_player_${code}`);
      if (existing) {
        navigate(data.state.deckBuilds ? `/game/${code}` : `/draft/${code}`);
        return;
      }
      localStorage.setItem(`draft_player_${code}`, 'player2');
      localStorage.setItem(`draft_name_${code}`, name.trim());
      if (data.state.deckBuilds?.player1 && data.state.deckBuilds?.player2) {
        navigate(`/game/${code}`);
      } else {
        navigate(`/draft/${code}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally { setLoading(false); }
  }

  // ── Room code share screen ───────────────────────────────────────────────

  if (createdGameRoom) {
    return (
      <Screen>
        <div className="w-full max-w-sm text-center space-y-6">
          <div>
            <p className="font-display text-gold text-sm tracking-widest uppercase mb-1">Game Created</p>
            <h2 className="font-display text-2xl text-white">Share with Player 2</h2>
          </div>

          {/* Room code display */}
          <div
            className="rounded-2xl py-6 px-8 border"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(201,162,39,0.08) 0%, transparent 70%), #13131a',
              borderColor: 'rgba(201,162,39,0.4)',
              boxShadow: '0 0 40px rgba(201,162,39,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="font-mono text-5xl font-bold tracking-[0.25em] select-all"
              style={{ color: '#e0b84c', textShadow: '0 0 20px rgba(224,184,76,0.4)' }}
            >
              {createdGameRoom}
            </div>
            <p className="text-xs mt-3" style={{ color: 'rgba(200,185,150,0.45)' }}>
              Player 2 enters this code on the home screen
            </p>
          </div>

          <button
            className="btn-gold w-full rounded-xl py-4 text-base font-display tracking-wide"
            onClick={() => navigate(`/game/${createdGameRoom}`)}
          >
            ▶ &nbsp;Enter as Player 1
          </button>
          <button
            className="text-sm transition-colors"
            style={{ color: 'rgba(200,185,150,0.45)' }}
            onClick={() => setCreatedGameRoom(null)}
          >
            ← Back
          </button>
        </div>
      </Screen>
    );
  }

  // ── Main home screen ─────────────────────────────────────────────────────

  return (
    <Screen>
      <div className="w-full max-w-md space-y-7">

        {/* Header */}
        <header className="text-center space-y-2 pt-2">
          {/* Decorative top rule */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.5))' }} />
            <span className="text-gold/50 text-xs tracking-[0.3em]">✦</span>
            <span className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(90deg, rgba(201,162,39,0.5), transparent)' }} />
          </div>

          <h1
            className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-none"
            style={{ color: '#e0b84c', textShadow: '0 0 30px rgba(224,184,76,0.25), 0 2px 4px rgba(0,0,0,0.8)' }}
          >
            Cuby &amp; The Wizards
          </h1>
          <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(200,185,150,0.5)' }}>
            Winston Draft &nbsp;·&nbsp; 2 Players &nbsp;·&nbsp; 540-Card Cube
          </p>
        </header>

        {/* Main panel */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: 'linear-gradient(180deg, #15151e 0%, #11111a 100%)',
            border: '1px solid rgba(201,162,39,0.2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Summoner name */}
          <div>
            <SectionLabel>Summoner Name</SectionLabel>
            <ArenaInput
              placeholder="Enter your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* Card count pills */}
          <div>
            <SectionLabel>Cards in Draft</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {([90, 180, 270, 360, 450, 540] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCardCount(n)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
                  style={
                    cardCount === n
                      ? {
                          background: 'linear-gradient(180deg, #d4a83a, #a87c10)',
                          border: '1px solid #e0b84c',
                          color: '#0d0d12',
                          fontWeight: 600,
                          boxShadow: '0 0 12px rgba(201,162,39,0.3)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(201,162,39,0.18)',
                          color: 'rgba(200,185,150,0.65)',
                        }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-lg px-4 py-2.5 text-sm flex items-center gap-2"
              style={{ background: 'rgba(211,32,42,0.12)', border: '1px solid rgba(211,32,42,0.3)', color: '#f87171' }}
            >
              <span>⚠</span> {error}
            </div>
          )}

          {/* Primary CTA */}
          <button
            className="btn-gold w-full rounded-xl py-4 text-base font-display tracking-wide"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating…
              </span>
            ) : (
              '⚔ &nbsp;Create New Draft'
            )}
          </button>

          {/* Dev shortcuts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Skip to Deck Builder', icon: '🧪', fn: handleSkipToDeckBuilder },
              { label: 'Skip to Play', icon: '🎮', fn: handleSkipToPlay },
            ].map(({ label, icon, fn }) => (
              <button
                key={label}
                className="btn-ghost rounded-lg py-2 text-xs"
                onClick={fn}
                disabled={loading}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <GoldDivider label="or join existing" />

          {/* Join row */}
          <div className="flex gap-2">
            <ArenaInput
              className="flex-1 uppercase tracking-[0.25em] font-mono text-gold placeholder-shown:tracking-normal"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button
              className="btn-ghost rounded-lg px-5 font-semibold text-sm whitespace-nowrap"
              onClick={handleJoin}
              disabled={loading}
            >
              Join
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: 'rgba(200,185,150,0.3)' }}>
          Scryfall card images &nbsp;·&nbsp; Open source
        </p>
      </div>
    </Screen>
  );
}

// ── Shared screen wrapper ──────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #151520 0%, #0d0d12 60%)',
      }}
    >
      {children}
    </div>
  );
}
