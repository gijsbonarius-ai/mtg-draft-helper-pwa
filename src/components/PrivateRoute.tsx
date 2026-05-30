import type { Session } from '@supabase/supabase-js';
import { Navigate, Outlet } from 'react-router-dom';
import { isSupabaseConfigured } from '../lib/supabase';

interface Props {
  session: Session | null;
}

export default function PrivateRoute({ session }: Props) {
  if (!isSupabaseConfigured) {
    // Allow access without auth when Supabase is not configured
    return <Outlet />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
