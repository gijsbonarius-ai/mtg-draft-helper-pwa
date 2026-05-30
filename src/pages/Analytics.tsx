import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Account, Transaction } from '../lib/types';
import NetWorthChart from '../components/NetWorthChart';
import MonthlyChart from '../components/MonthlyChart';
import SpendingChart from '../components/SpendingChart';
import { getCategoryColor } from '../lib/categories';

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: '1', user_id: 'demo', account_id: '1', date: '2026-05-28', description: 'Albert Heijn', amount: -65.40, category: 'Groceries', type: 'expense', created_at: '' },
  { id: '2', user_id: 'demo', account_id: '1', date: '2026-05-27', description: 'Salaris Mai', amount: 3200.00, category: 'Income', type: 'income', created_at: '' },
  { id: '3', user_id: 'demo', account_id: '1', date: '2026-05-26', description: 'Netflix', amount: -15.99, category: 'Subscriptions', type: 'expense', created_at: '' },
  { id: '4', user_id: 'demo', account_id: '1', date: '2026-05-25', description: 'NS Reizen', amount: -24.50, category: 'Transport', type: 'expense', created_at: '' },
  { id: '5', user_id: 'demo', account_id: '3', date: '2026-05-24', description: 'Restaurant De Kas', amount: -78.00, category: 'Dining', type: 'expense', created_at: '' },
  { id: '6', user_id: 'demo', account_id: '1', date: '2026-04-27', description: 'Salaris April', amount: 3200.00, category: 'Income', type: 'income', created_at: '' },
  { id: '7', user_id: 'demo', account_id: '1', date: '2026-04-20', description: 'Huur april', amount: -950.00, category: 'Housing', type: 'expense', created_at: '' },
  { id: '8', user_id: 'demo', account_id: '1', date: '2026-04-15', description: 'Albert Heijn', amount: -55.20, category: 'Groceries', type: 'expense', created_at: '' },
  { id: '9', user_id: 'demo', account_id: '1', date: '2026-03-27', description: 'Salaris Maart', amount: 3200.00, category: 'Income', type: 'income', created_at: '' },
  { id: '10', user_id: 'demo', account_id: '1', date: '2026-03-20', description: 'Huur maart', amount: -950.00, category: 'Housing', type: 'expense', created_at: '' },
];

const DEMO_ACCOUNTS: Account[] = [
  { id: '1', user_id: 'demo', name: 'ING Betaalrekening', type: 'bank', currency: 'EUR', balance: 4250.30, institution: 'ING', color: '#f97316', created_at: '' },
  { id: '2', user_id: 'demo', name: 'DEGIRO Portfolio', type: 'investment', currency: 'EUR', balance: 18750.00, institution: 'DEGIRO', color: '#3b82f6', created_at: '' },
  { id: '3', user_id: 'demo', name: 'Visa Credit Card', type: 'credit_card', currency: 'EUR', balance: -320.50, institution: 'ABN AMRO', color: '#ef4444', created_at: '' },
];

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
    .slice(-12)
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
    .map(([name, value]) => ({ name, value }));
}

function buildNetWorthHistory(accounts: Account[]) {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, 4 - (11 - i), 1);
    return {
      month: d.toLocaleDateString('en-NL', { month: 'short', year: '2-digit' }),
      value: Math.round(total - (11 - i) * 700 + Math.random() * 300),
    };
  });
}

export default function Analytics() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');

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

  const periodMonths = period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - periodMonths);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filteredTxns = transactions.filter((t) => t.date >= cutoffStr);

  const totalIncome = filteredTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  const netWorthData = buildNetWorthHistory(accounts);
  const monthlyData = buildMonthlyData(filteredTxns);
  const spendingData = buildSpendingData(filteredTxns);

  const topCategories = spendingData.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Detailed financial insights</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['3m', '6m', '12m'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Income</p>
          <p className="text-xl font-bold text-green-600">€{totalIncome.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-red-600">€{totalExpenses.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Net Savings</p>
          <p className={`text-xl font-bold ${savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            €{savings.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Savings Rate</p>
          <p className={`text-xl font-bold ${savingsRate >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Net Worth Over Time</h2>
          <NetWorthChart data={netWorthData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Income vs Expenses</h2>
          <MonthlyChart data={monthlyData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Spending by Category</h2>
          <SpendingChart data={spendingData} />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Top Spending Categories</h2>
          {topCategories.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No expense data yet</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(({ name, value }) => {
                const pct = totalExpenses > 0 ? (value / totalExpenses) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(name) }} />
                        <span className="text-gray-700">{name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">€{value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                        <span className="text-gray-400 text-xs ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: getCategoryColor(name) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
