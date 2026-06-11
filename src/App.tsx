import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { BabyProvider } from './hooks/useBaby';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Timeline from './pages/Timeline';
import DataOverview from './pages/DataOverview';
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
              <Route index element={<Navigate to="/timeline" replace />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="data" element={<DataOverview />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/timeline" replace />} />
          </Routes>
        </BrowserRouter>
      </BabyProvider>
    </AuthProvider>
  );
}
