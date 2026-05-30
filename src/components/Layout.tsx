import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⊞' },
  { path: '/accounts', label: 'Accounts', icon: '🏦' },
  { path: '/transactions', label: 'Transactions', icon: '↕' },
  { path: '/import', label: 'Import', icon: '↑' },
  { path: '/analytics', label: 'Analytics', icon: '📊' },
];

export default function Layout() {
  const navigate = useNavigate();

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-700">
          <span className="text-xl font-bold text-blue-400">FinanceHub</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-lg w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ⎋ Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-amber-800 text-sm flex items-center gap-2">
            <span className="font-semibold">⚠ Setup required:</span>
            Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to{' '}
            <code className="bg-amber-100 px-1 rounded">.env</code> and add your Supabase credentials.
            The app is running in demo mode.
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
