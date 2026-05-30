import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Account, Transaction } from '../lib/types';
import NetWorthChart from '../components/NetWorthChart';
import SpendingChart from '../components/SpendingChart';
import MonthlyChart from '../components/MonthlyChart';
import { getCategoryColor } from '../lib/categories';

// Demo data for when Supabase is not configured
const DEMO_ACCOUNTS: Account[] = [
  { id: '1', user_id: 'demo', name: 'ING Betaalrekening', type: 'bank', currency: 'EUR', balance: 4250.30, institution: 'ING', color: '#f97316', created_at: '' },
  { id: '2', user_id: 'demo', name: 'DEGIRO Portfolio', type: 'investment', currency: 'EUR', balance: 18750.00, institution: 'DEGIRO', color: '#3b82f6', created_at: '' },
  { id: '3', user_id: 'demo', name: 'Visa Credit Card', type: 'credit_card', currency: 'EUR', balance: -320.50, institution: 'ABN AMRO', color: '#ef4444', created_at: '' },
];

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: '1', user_id: 'demo', account_id: '1', date: '2026-05-28', description: 'Albert Heijn', amount: -65.40, category: 'Groceries', type: 'expense', created_at: '' },
  { id: '2', user_id: 'demo', account_id: '1', date: '2026-05-27', description: 'Salaris Mai', amount: 3200.00, category: 'Income', type: 'income', created_at: '' },
  { id: '3', user_id: 'demo', account_id: '1', date: '2026-05-26', description: 'Netflix', amount: -15.99, category: 'Subscriptions', type: 'expense', created_at: '' },
  { id: '4', user_id: 'demo', account_id: '1', date: '2026-05-25', description: 'NS Reizen', amount: -24.50, category: 'Transport', type: 'expense', created_at: '' },
  { id: '5', user_id: 'demo', account_id: '3', date: '2026-05-24', description: 'Restaurant De Kas', amount: -78.00, category: 'Dining', type: 'expense', created_at: '' },
];

function buildNetWorthHistory(_transactions: Transaction[], accounts: Account[]) {
  const totalNow = accounts.reduce((s, a) => s + a.balance, 0);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(2026, 4 - i, 1);
    const label = d.toLocaleDateString('en-NL', { month: 'short', year: '2-digit' });
    months.push({ month: label, value: totalNow - i * 800 });
  }
  return months;
}

function buildMonthlyData(transactions: Transaction[]) {
  const map: Record<string, { income: number; expenses: number }> = {};
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    if (!map[m]) map[m] = { income: 0, expenses: 0 };
    if (t.amount >= 0) map[m].income += t.amount;
    else map[m].expenses += Math.abs(t.amount);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => ({ month: month.slice(5), ...v }));
}

function buildSpendingData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type === 'expense' && t.category && t.category !== 'Transfer') {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    }
  }
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAccounts(DEMO_ACCOUNTS);
      setTransactions(DEMO_TRANSACTIONS);
      setLoading(false);
      return;
    }
    const [{ data: accs }, { data: txns }] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      supabase.from('transactions').select('*').order('date', { ascending: false }).limit(100),
    ]);
    setAccounts(accs || []);
    setTransactions(txns || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTxns = transactions.filter((t) => t.date.startsWith(thisMonth));
  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpenses = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);

  const recentTxns = transactions.slice(0, 5);
  const netWorthData = buildNetWorthHistory(transactions, accounts);
  const monthlyData = buildMonthlyData(transactions);
  const spendingData = buildSpendingData(transactions);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your financial overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500 mb-1">Net Worth</p>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            €{netWorth.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500 mb-1">This Month Income</p>
          <p className="text-2xl font-bold text-green-600">
            €{monthIncome.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500 mb-1">This Month Expenses</p>
          <p className="text-2xl font-bold text-red-600">
            €{monthExpenses.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Net Worth Over Time</h2>
          <NetWorthChart data={netWorthData} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Income vs Expenses</h2>
          <MonthlyChart data={monthlyData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Accounts</h2>
            <Link to="/accounts" className="text-blue-600 text-sm hover:underline">View all</Link>
          </div>
          {accounts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              No accounts yet. <Link to="/accounts" className="text-blue-600 hover:underline">Add one</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.slice(0, 4).map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color || '#3b82f6' }} />
                    <span className="text-sm text-gray-700">{acc.name}</span>
                  </div>
                  <span className={`text-sm font-semibold ${acc.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    €{acc.balance.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spending by category */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Spending by Category</h2>
          <SpendingChart data={spendingData} />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-blue-600 text-sm hover:underline">View all</Link>
        </div>
        {recentTxns.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            No transactions yet. <Link to="/import" className="text-blue-600 hover:underline">Import from CSV</Link>
          </p>
        ) : (
          <div className="space-y-1">
            {recentTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(t.category || 'Other') }}
                  />
                  <div>
                    <p className="text-sm text-gray-900">{t.description}</p>
                    <p className="text-xs text-gray-400">{t.date} · {t.category}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.amount >= 0 ? '+' : ''}€{Math.abs(t.amount).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
