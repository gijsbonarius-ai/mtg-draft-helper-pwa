import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { initDraft } from '../lib/winstonDraft';

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          <p className="text-gray-500 text-xs mt-4">Then run the SQL in <code>supabase/draft-schema.sql</code> and enable Realtime on the <code>draft_sessions</code> table.</p>
        </div>
      </div>
    );
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const roomCode = generateRoomCode();
      const state = initDraft(name.trim());
      const { error: err } = await supabase
        .from('draft_sessions')
        .insert({ room_code: roomCode, state });
      if (err) throw err;
      localStorage.setItem(`draft_player_${roomCode}`, 'player1');
      localStorage.setItem(`draft_name_${roomCode}`, name.trim());
      navigate(`/draft/${roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const { data, error: err } = await supabase
        .from('draft_sessions')
        .select('*')
        .eq('room_code', code)
        .single();
      if (err || !data) { setError('Room not found'); return; }

      const existing = localStorage.getItem(`draft_player_${code}`);
      if (existing) {
        navigate(`/draft/${code}`);
        return;
      }

      if (data.state.players.player2?.name) {
        setError('Room is full');
        return;
      }

      localStorage.setItem(`draft_player_${code}`, 'player2');
      localStorage.setItem(`draft_name_${code}`, name.trim());
      navigate(`/draft/${code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Creating…' : 'Create New Draft'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-900 px-3 text-gray-500 text-sm">or join existing</span>
            </div>
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
            <button
              onClick={handleJoin}
              disabled={loading}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold px-4 rounded-lg transition-colors"
            >
              Join
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs">
          540-card Power Cube · Scryfall card images
        </p>
      </div>
    </div>
  );
}
