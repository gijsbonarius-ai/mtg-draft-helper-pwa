import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { BabyProvider } from './hooks/useBaby';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Pregnancy from './pages/Pregnancy';
import Growth from './pages/Growth';
import Diary from './pages/Diary';
import Gallery from './pages/Gallery';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <BabyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pregnancy" element={<Pregnancy />} />
              <Route path="growth" element={<Growth />} />
              <Route path="diary" element={<Diary />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </BabyProvider>
    </AuthProvider>
  );
}
