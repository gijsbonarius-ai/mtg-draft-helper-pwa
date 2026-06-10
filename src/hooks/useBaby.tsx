import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Baby } from '../lib/types';
import { useAuth } from './useAuth';

interface BabyContextType {
  baby: Baby | null;
  babies: Baby[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const BabyContext = createContext<BabyContextType | undefined>(undefined);

export function BabyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBabies = async () => {
    const { data } = await supabase.from('babies').select('*').order('created_at');
    const list = (data as Baby[]) || [];
    setBabies(list);
    setBaby(list[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (profile && profile.role !== 'pending') {
      fetchBabies();
    } else {
      setLoading(false);
    }
  }, [profile]);

  return (
    <BabyContext.Provider value={{ baby, babies, loading, refetch: fetchBabies }}>
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBaby must be used within BabyProvider');
  return context;
}
