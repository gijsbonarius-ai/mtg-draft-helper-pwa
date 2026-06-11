import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Clock, BarChart2, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';

const NAV = [
  { to: '/timeline', icon: Clock, label: 'Timeline' },
  { to: '/data', icon: BarChart2, label: 'Data' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { profile, signOut, previewingAsViewer, setPreviewingAsViewer } = useAuth();
  const { baby } = useBaby();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col max-w-2xl mx-auto">
      {/* Minimal header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-blossom-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <span className="font-display font-bold text-blossom-600">Little Journey</span>
            {baby && <span className="text-gray-300 text-sm">· {baby.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blossom-100 flex items-center justify-center text-blossom-600 font-bold text-xs">
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          </div>
        </div>
      </header>

      {/* Preview-as-viewer banner */}
      {previewingAsViewer && (
        <div className="bg-powder-100 border-b border-powder-200 px-4 py-2 flex items-center justify-between">
          <p className="text-powder-700 text-xs font-semibold">
            👁 Previewing as viewer — this is what guests see
          </p>
          <button
            onClick={() => setPreviewingAsViewer(false)}
            className="text-xs text-powder-600 font-bold underline"
          >
            Exit preview
          </button>
        </div>
      )}

      {/* Pending banner */}
      {profile?.role === 'pending' && (
        <div className="bg-sunshine-100 border-b border-sunshine-200 px-4 py-2 text-center">
          <p className="text-sunshine-700 text-xs font-semibold">
            ⏳ Waiting for a parent to approve your account.
          </p>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-20">
        {profile?.role === 'pending' ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="text-6xl mb-4">🌱</div>
            <h2 className="font-display font-bold text-2xl text-gray-800 mb-2">Almost there!</h2>
            <p className="text-gray-500 max-w-sm text-sm">
              Your account is pending approval. Once a parent approves you, you'll see the full journey.
            </p>
            <button onClick={handleSignOut} className="btn-ghost mt-6 text-gray-400">Sign out</button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/95 backdrop-blur-sm border-t border-blossom-100 px-6 py-2 z-30">
        <div className="flex items-center justify-around">
          {NAV.map(({ to, icon: Icon, label }) => (
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
        </div>
      </nav>
    </div>
  );
}
