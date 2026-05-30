import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Account } from '../lib/types';
import AccountCard from '../components/AccountCard';

interface BankConnection {
  account_id: string;
  last_synced_at: string | null;
}

// Build the TrueLayer OAuth URL for a given account.
// Sandbox base: https://auth.truelayer-sandbox.com
// Live base:    https://auth.truelayer.com  (change VITE_TRUELAYER_AUTH_BASE env var)
function buildTrueLayerAuthUrl(accountId: string): string {
  const base = import.meta.env.VITE_TRUELAYER_AUTH_BASE ?? 'https://auth.truelayer-sandbox.com';
  const clientId = import.meta.env.VITE_TRUELAYER_CLIENT_ID ?? '';
  const redirectUri = import.meta.env.VITE_TRUELAYER_REDIRECT_URI ?? '';
  const providers = 'uk-ob-all uk-oauth-all de-ob-all nl-ob-all';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'accounts transactions balance offline_access',
    redirect_uri: redirectUri,
    providers,
    state: accountId, // state carries the account_id back to /callback
  });
  return `${base}/?${params.toString()}`;
}

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899'];

interface FormData {
  name: string;
  type: 'bank' | 'investment' | 'credit_card';
  currency: string;
  balance: string;
  institution: string;
  color: string;
}

const defaultForm: FormData = {
  name: '',
  type: 'bank',
  currency: 'EUR',
  balance: '0',
  institution: '',
  color: COLORS[0],
};

let demoAccounts: Account[] = [
  { id: '1', user_id: 'demo', name: 'ING Betaalrekening', type: 'bank', currency: 'EUR', balance: 4250.30, institution: 'ING', color: '#f97316', created_at: '' },
  { id: '2', user_id: 'demo', name: 'DEGIRO Portfolio', type: 'investment', currency: 'EUR', balance: 18750.00, institution: 'DEGIRO', color: '#3b82f6', created_at: '' },
  { id: '3', user_id: 'demo', name: 'Visa Credit Card', type: 'credit_card', currency: 'EUR', balance: -320.50, institution: 'ABN AMRO', color: '#ef4444', created_at: '' },
];

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAccounts([...demoAccounts]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('accounts').select('*').order('created_at');
    setAccounts(data || []);
    const { data: connData } = await supabase
      .from('bank_connections')
      .select('account_id, last_synced_at');
    setConnections(connData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Show success message if redirected back from /callback
  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setSuccessMessage('Your bank account was connected successfully! Click "Sync now" to import transactions.');
    }
  }, [searchParams]);

  function connectBank(accountId: string) {
    window.location.href = buildTrueLayerAuthUrl(accountId);
  }

  async function syncBank(accountId: string) {
    if (!isSupabaseConfigured) return;
    setSyncing(accountId);
    setSyncError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: fnError } = await supabase.functions.invoke('truelayer-sync', {
        body: { account_id: accountId, user_id: user!.id },
      });
      if (fnError || !data?.success) {
        setSyncError('Sync failed. Please try again.');
      } else {
        await load();
        setSuccessMessage('Transactions synced successfully!');
      }
    } catch {
      setSyncError('An unexpected error occurred during sync.');
    } finally {
      setSyncing(null);
    }
  }

  function openAdd() {
    setEditId(null);
    setForm(defaultForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(account: Account) {
    setEditId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: String(account.balance),
      institution: account.institution || '',
      color: account.color || COLORS[0],
    });
    setError('');
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account and all its transactions?')) return;
    if (!isSupabaseConfigured) {
      demoAccounts = demoAccounts.filter((a) => a.id !== id);
      setAccounts([...demoAccounts]);
      return;
    }
    await supabase.from('accounts').delete().eq('id', id);
    load();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: form.name,
      type: form.type,
      currency: form.currency,
      balance: parseFloat(form.balance) || 0,
      institution: form.institution || undefined,
      color: form.color,
    };

    try {
      if (!isSupabaseConfigured) {
        if (editId) {
          demoAccounts = demoAccounts.map((a) => a.id === editId ? { ...a, ...payload } : a);
        } else {
          demoAccounts = [...demoAccounts, { ...payload, id: Date.now().toString(), user_id: 'demo', created_at: '' }];
        }
        setAccounts([...demoAccounts]);
        setShowModal(false);
        return;
      }

      if (editId) {
        const { error } = await supabase.from('accounts').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('accounts').insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
      await load();
      setShowModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Total net worth: <span className="font-semibold text-gray-900">€{netWorth.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Account
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800 ml-3">×</button>
        </div>
      )}
      {syncError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center justify-between">
          <span>{syncError}</span>
          <button onClick={() => setSyncError('')} className="text-red-500 hover:text-red-700 ml-3">×</button>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 mb-4">No accounts yet</p>
          <button onClick={openAdd} className="text-blue-600 hover:underline text-sm">Add your first account</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const conn = connections.find((c) => c.account_id === acc.id);
            return (
              <div key={acc.id} className="flex flex-col gap-2">
                <AccountCard account={acc} onEdit={openEdit} onDelete={handleDelete} />
                <div className="flex items-center gap-2 px-1">
                  {conn ? (
                    <>
                      <button
                        onClick={() => syncBank(acc.id)}
                        disabled={syncing === acc.id}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {syncing === acc.id ? 'Syncing…' : '↻ Sync now'}
                      </button>
                      {conn.last_synced_at && (
                        <span className="text-xs text-gray-400">
                          Last synced: {new Date(conn.last_synced_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => connectBank(acc.id)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      🏦 Connect to bank
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-900">{editId ? 'Edit Account' : 'Add Account'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. ING Betaalrekening"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as FormData['type'] })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="investment">Investment</option>
                    <option value="credit_card">Credit Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                  <input
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. ING"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
