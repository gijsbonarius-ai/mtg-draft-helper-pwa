import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, TrendingUp, BookOpen, Camera, Settings, Heart } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/pregnancy', icon: Heart, label: 'Pregnancy' },
  { to: '/growth', icon: TrendingUp, label: 'Growth' },
  { to: '/diary', icon: BookOpen, label: 'Diary' },
  { to: '/gallery', icon: Camera, label: 'Gallery' },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const { baby } = useBaby();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-blossom-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌸</span>
            <div>
              <h1 className="font-display font-bold text-blossom-600 text-lg leading-none">
                Little Journey
              </h1>
              {baby && (
                <p className="text-xs text-gray-400 leading-none mt-0.5">{baby.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl hover:bg-blossom-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-blossom-100 flex items-center justify-center text-blossom-600 font-bold text-sm">
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            </button>
            <button onClick={handleSignOut} className="btn-ghost text-xs px-3 py-1.5">
              Out
            </button>
          </div>
        </div>
      </header>

      {/* Pending approval banner */}
      {profile?.role === 'pending' && (
        <div className="bg-sunshine-100 border-b border-sunshine-200 px-4 py-3 text-center">
          <p className="text-sunshine-700 text-sm font-semibold">
            ⏳ Your account is waiting for approval from a parent. Sit tight!
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {profile?.role === 'pending' ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="text-6xl mb-4">🌱</div>
            <h2 className="font-display font-bold text-2xl text-gray-800 mb-2">Almost there!</h2>
            <p className="text-gray-500 max-w-sm">
              Your account is pending approval. Once a parent approves you, you'll be able to see the journey.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/95 backdrop-blur-sm border-t border-blossom-100 px-2 py-2 z-40">
        <div className="flex items-center justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Settings size={20} strokeWidth={2} />
            <span>Settings</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
