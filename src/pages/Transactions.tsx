import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Account, Transaction } from '../lib/types';
import TransactionRow from '../components/TransactionRow';
import { CATEGORIES } from '../lib/categories';

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: '1', user_id: 'demo', account_id: '1', date: '2026-05-28', description: 'Albert Heijn', amount: -65.40, category: 'Groceries', type: 'expense', created_at: '' },
  { id: '2', user_id: 'demo', account_id: '1', date: '2026-05-27', description: 'Salaris Mai', amount: 3200.00, category: 'Income', type: 'income', created_at: '' },
  { id: '3', user_id: 'demo', account_id: '1', date: '2026-05-26', description: 'Netflix', amount: -15.99, category: 'Subscriptions', type: 'expense', created_at: '' },
  { id: '4', user_id: 'demo', account_id: '1', date: '2026-05-25', description: 'NS Reizen', amount: -24.50, category: 'Transport', type: 'expense', created_at: '' },
  { id: '5', user_id: 'demo', account_id: '3', date: '2026-05-24', description: 'Restaurant De Kas', amount: -78.00, category: 'Dining', type: 'expense', created_at: '' },
  { id: '6', user_id: 'demo', account_id: '1', date: '2026-05-22', description: 'Lidl', amount: -43.10, category: 'Groceries', type: 'expense', created_at: '' },
  { id: '7', user_id: 'demo', account_id: '1', date: '2026-05-20', description: 'Huur mei', amount: -950.00, category: 'Housing', type: 'expense', created_at: '' },
  { id: '8', user_id: 'demo', account_id: '2', date: '2026-05-18', description: 'DEGIRO ETF koop', amount: -500.00, category: 'Investment', type: 'expense', created_at: '' },
];

const DEMO_ACCOUNTS: Account[] = [
  { id: '1', user_id: 'demo', name: 'ING Betaalrekening', type: 'bank', currency: 'EUR', balance: 4250.30, institution: 'ING', color: '#f97316', created_at: '' },
  { id: '2', user_id: 'demo', name: 'DEGIRO Portfolio', type: 'investment', currency: 'EUR', balance: 18750.00, institution: 'DEGIRO', color: '#3b82f6', created_at: '' },
  { id: '3', user_id: 'demo', name: 'Visa Credit Card', type: 'credit_card', currency: 'EUR', balance: -320.50, institution: 'ABN AMRO', color: '#ef4444', created_at: '' },
];

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTransactions(DEMO_TRANSACTIONS);
      setAccounts(DEMO_ACCOUNTS);
      setLoading(false);
      return;
    }
    const [{ data: txns }, { data: accs }] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('accounts').select('*'),
    ]);
    setTransactions(txns || []);
    setAccounts(accs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCategoryChange(id: string, category: string) {
    const type = category === 'Income' ? 'income' : category === 'Transfer' ? 'transfer' : 'expense';
    if (!isSupabaseConfigured) {
      setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category, type: type as Transaction['type'] } : t));
      return;
    }
    await supabase.from('transactions').update({ category, type }).eq('id', id);
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category, type: type as Transaction['type'] } : t));
  }

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  const filtered = transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAccount && t.account_id !== filterAccount) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterType && t.type !== filterType) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-500 text-sm mt-0.5">{filtered.length} transactions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(search || filterAccount || filterCategory || filterType || dateFrom || dateTo) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Total: <span className={`font-semibold ${totalFiltered >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalFiltered.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </span>
            <button
              onClick={() => { setSearch(''); setFilterAccount(''); setFilterCategory(''); setFilterType(''); setDateFrom(''); setDateTo(''); }}
              className="text-blue-600 text-sm hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No transactions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    accountName={accountMap[t.account_id] || 'Unknown'}
                    onCategoryChange={handleCategoryChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
