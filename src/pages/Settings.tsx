import { useEffect, useState, FormEvent } from 'react';
import { LogOut, Check, X, User, Baby } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

export default function Settings() {
  const { profile, signOut, previewingAsViewer, setPreviewingAsViewer } = useAuth();
  const { baby, refetch: refetchBaby } = useBaby();
  const navigate = useNavigate();

  // Baby form
  const [babyName, setBabyName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthWeightG, setBirthWeightG] = useState('');
  const [birthHeightCm, setBirthHeightCm] = useState('');
  const [babySex, setBabySex] = useState<'boy' | 'girl' | 'surprise'>('surprise');
  const [savingBaby, setSavingBaby] = useState(false);
  const [babyMsg, setBabyMsg] = useState('');

  // Pending users
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  const isParent = profile?.role === 'parent';

  useEffect(() => {
    if (baby) {
      setBabyName(baby.name ?? '');
      setDueDate(baby.due_date ?? '');
      setBirthDate(baby.birth_date ?? '');
      setBirthWeightG(baby.birth_weight_grams ? String(baby.birth_weight_grams) : '');
      setBirthHeightCm(baby.birth_height_cm ? String(baby.birth_height_cm) : '');
      setBabySex(baby.sex ?? 'surprise');
    }

    if (isParent) {
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'pending')
        .then(({ data }) => setPendingUsers((data as Profile[]) ?? []));

      supabase
        .from('profiles')
        .select('*')
        .in('role', ['parent', 'viewer'])
        .order('role')
        .then(({ data }) => setAllUsers((data as Profile[]) ?? []));
    }
  }, [baby, isParent]);

  const handleBabySave = async (e: FormEvent) => {
    e.preventDefault();
    if (!isParent) return;
    setSavingBaby(true);
    setBabyMsg('');

    if (baby) {
      await supabase.from('babies').update({
        name: babyName,
        due_date: dueDate || null,
        birth_date: birthDate || null,
        birth_weight_grams: birthWeightG ? parseInt(birthWeightG) : null,
        birth_height_cm: birthHeightCm ? parseFloat(birthHeightCm) : null,
        sex: babySex,
      }).eq('id', baby.id);
    } else {
      await supabase.from('babies').insert({
        name: babyName,
        due_date: dueDate || null,
        birth_date: birthDate || null,
        birth_weight_grams: birthWeightG ? parseInt(birthWeightG) : null,
        birth_height_cm: birthHeightCm ? parseFloat(birthHeightCm) : null,
        sex: babySex,
        created_by: profile!.id,
      });
    }

    await refetchBaby();
    setSavingBaby(false);
    setBabyMsg('Saved!');
    setTimeout(() => setBabyMsg(''), 2000);
  };

  const approveUser = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ role: 'viewer', approved_at: new Date().toISOString(), approved_by: profile!.id })
      .eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    const { data } = await supabase.from('profiles').select('*').in('role', ['parent', 'viewer']).order('role');
    setAllUsers((data as Profile[]) ?? []);
  };

  const denyUser = async (userId: string) => {
    if (!confirm('Remove this user?')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
  };

  const revokeAccess = async (userId: string) => {
    if (!confirm('Revoke access for this user?')) return;
    await supabase.from('profiles').update({ role: 'pending' }).eq('id', userId);
    const { data } = await supabase.from('profiles').select('*').in('role', ['parent', 'viewer']).order('role');
    setAllUsers((data as Profile[]) ?? []);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleColors: Record<string, string> = {
    parent: 'bg-blossom-100 text-blossom-700',
    viewer: 'bg-meadow-100 text-meadow-700',
    pending: 'bg-sunshine-100 text-sunshine-700',
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="font-display font-bold text-2xl text-gray-800">Settings</h2>

      {/* Profile info */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blossom-100 flex items-center justify-center text-blossom-600 font-bold text-lg">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{profile?.display_name}</p>
            <p className="text-gray-400 text-sm">{profile?.email}</p>
            <span className={`badge mt-1 ${roleColors[profile?.role ?? 'pending']}`}>
              {profile?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Baby profile (parents only) */}
      {isParent && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Baby size={18} className="text-blossom-500" />
            <h3 className="font-display font-bold text-lg text-gray-800">
              {baby ? 'Baby profile' : 'Create baby profile'}
            </h3>
          </div>

          <form onSubmit={handleBabySave} className="space-y-4">
            <div>
              <label className="label">Baby's name (or nickname)</label>
              <input
                type="text"
                className="input"
                placeholder="Peanut, Bean, ..."
                value={babyName}
                onChange={e => setBabyName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Sex</label>
              <div className="flex gap-2">
                {(['boy', 'girl', 'surprise'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBabySex(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors capitalize ${babySex === s ? 'bg-blossom-100 border-blossom-300 text-blossom-700' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    {s === 'boy' ? '💙 Boy' : s === 'girl' ? '💗 Girl' : '🎀 Surprise'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Due date</label>
                <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Birth date</label>
                <input type="date" className="input" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
              </div>
            </div>

            {birthDate && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Birth weight (g)</label>
                  <input type="number" className="input" placeholder="3400" value={birthWeightG} onChange={e => setBirthWeightG(e.target.value)} />
                </div>
                <div>
                  <label className="label">Birth height (cm)</label>
                  <input type="number" step="0.1" className="input" placeholder="51.0" value={birthHeightCm} onChange={e => setBirthHeightCm(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={savingBaby}>
                {savingBaby ? 'Saving...' : baby ? 'Update' : 'Create profile'}
              </button>
              {babyMsg && <span className="text-meadow-500 text-sm font-semibold">✓ {babyMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Pending approvals */}
      {isParent && pendingUsers.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-1">
            Pending approvals
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            These people registered and are waiting for access.
          </p>
          <div className="space-y-3">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-2 p-3 bg-sunshine-50 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-sunshine-200 flex items-center justify-center text-sunshine-700 font-bold text-sm">
                    {u.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{u.display_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveUser(u.id)}
                    className="w-8 h-8 rounded-full bg-meadow-100 hover:bg-meadow-200 flex items-center justify-center text-meadow-600 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => denyUser(u.id)}
                    className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All approved users */}
      {isParent && allUsers.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-powder-500" />
            <h3 className="font-display font-bold text-lg text-gray-800">People with access</h3>
          </div>
          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blossom-100 flex items-center justify-center text-blossom-600 font-bold text-sm">
                    {u.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      {u.display_name}
                      {u.id === profile?.id && ' (you)'}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${roleColors[u.role]}`}>{u.role}</span>
                  {isParent && u.id !== profile?.id && u.role === 'viewer' && (
                    <button
                      onClick={() => revokeAccess(u.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview as viewer (parents only) */}
      {profile?.role === 'parent' && !previewingAsViewer && (
        <button
          onClick={() => setPreviewingAsViewer(true)}
          className="btn-secondary w-full"
        >
          👁 Preview as viewer
        </button>
      )}

      {/* Sign out */}
      <button onClick={handleSignOut} className="btn-secondary w-full text-red-500 border-red-100 hover:bg-red-50">
        <LogOut size={16} />
        Sign out
      </button>
    </div>
  );
}
