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

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardCount, setCardCount] = useState(90);
  // After skip-to-play: show room code so second device can join
  const [createdGameRoom, setCreatedGameRoom] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-700 rounded-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Supabase not configured</h1>
          <p className="text-gray-400 text-sm">
            Create a <code className="bg-gray-800 px-1 rounded">.env</code> file with:<br />
            <code className="bg-gray-800 px-1 rounded text-green-400 block mt-2 p-2 text-left">
              VITE_SUPABASE_URL=https://xxx.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=eyJ...
            </code>
          </p>
        </div>
      </div>
    );
  }

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
      // Show the room code so a second device can join before navigating
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

      // If this device already has a role, just navigate to the right place
      const existing = localStorage.getItem(`draft_player_${code}`);
      if (existing) {
        const dest = data.state.deckBuilds ? `/game/${code}` : `/draft/${code}`;
        navigate(dest);
        return;
      }

      // Join as player 2
      localStorage.setItem(`draft_player_${code}`, 'player2');
      localStorage.setItem(`draft_name_${code}`, name.trim());

      // If decks are already built (skip-to-play), go straight to game
      if (data.state.deckBuilds?.player1 && data.state.deckBuilds?.player2) {
        navigate(`/game/${code}`);
      } else {
        navigate(`/draft/${code}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally { setLoading(false); }
  }

  // After skip-to-play: show room code screen
  if (createdGameRoom) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-5 text-center">
          <div>
            <p className="text-gray-400 text-sm mb-2">Game room created! Share this code with the second device:</p>
            <div className="font-mono text-4xl font-bold text-yellow-300 tracking-widest bg-gray-800 rounded-xl py-4 px-6 select-all">
              {createdGameRoom}
            </div>
            <p className="text-gray-600 text-xs mt-2">The other device enters this code on the home screen and taps Join</p>
          </div>
          <button
            onClick={() => navigate(`/game/${createdGameRoom}`)}
            className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 text-black font-bold py-3 rounded-xl text-base"
          >
            ▶ Enter Game as Player 1
          </button>
          <button
            onClick={() => setCreatedGameRoom(null)}
            className="text-gray-500 text-sm hover:text-gray-300"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-yellow-400 tracking-tight">Cuby & The Wizards</h1>
          <p className="text-gray-400 mt-1 text-sm">Winston Draft • 2 Players</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your name</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
              placeholder="e.g. Gandalf"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Cards in this draft</label>
            <div className="flex gap-2 flex-wrap">
              {([90, 180, 270, 360, 450, 540] as const).map(n => (
                <button key={n} type="button" onClick={() => setCardCount(n)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${cardCount === n ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleCreate} disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-bold py-3 rounded-lg transition-colors">
            {loading ? 'Creating…' : 'Create New Draft'}
          </button>

          <div className="flex gap-2">
            <button onClick={handleSkipToDeckBuilder} disabled={loading}
              className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 text-xs py-2 rounded-lg border border-gray-700">
              🧪 Skip to Deck Builder
            </button>
            <button onClick={handleSkipToPlay} disabled={loading}
              className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 text-xs py-2 rounded-lg border border-gray-700">
              🎮 Skip to Play
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700" /></div>
            <div className="relative flex justify-center"><span className="bg-gray-900 px-3 text-gray-500 text-sm">or join existing</span></div>
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white uppercase tracking-widest focus:outline-none focus:border-yellow-500 placeholder-gray-600"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button onClick={handleJoin} disabled={loading}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold px-4 rounded-lg">
              Join
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs">540-card Power Cube · Scryfall card images</p>
      </div>
    </div>
  );
}
