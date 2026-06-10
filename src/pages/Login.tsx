import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError('Invalid email or password. Please try again.');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blossom-50 via-cream-50 to-powder-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🌸</div>
          <h1 className="font-display font-bold text-3xl text-blossom-600">Little Journey</h1>
          <p className="text-gray-500 mt-1 text-sm">Your private pregnancy & baby diary</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="bg-sunshine-100 border border-sunshine-300 rounded-2xl p-4 mb-6 text-sm text-sunshine-800">
            <p className="font-semibold mb-1">⚙️ Setup Required</p>
            <p>Add your Supabase URL and anon key to a <code className="bg-sunshine-200 px-1 rounded">.env</code> file to get started.</p>
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl text-gray-800 mb-5">Welcome back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || !isSupabaseConfigured}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-blossom-500 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
