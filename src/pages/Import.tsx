import { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Account, BankFormat, ColumnMapping, ParsedTransaction } from '../lib/types';
import { detectFormat, parseCSV } from '../lib/parsers';
import { getCategoryColor, CATEGORIES } from '../lib/categories';

type Step = 1 | 2 | 3 | 4;

const DEMO_ACCOUNTS: Account[] = [
  { id: '1', user_id: 'demo', name: 'ING Betaalrekening', type: 'bank', currency: 'EUR', balance: 4250.30, institution: 'ING', color: '#f97316', created_at: '' },
  { id: '2', user_id: 'demo', name: 'DEGIRO Portfolio', type: 'investment', currency: 'EUR', balance: 18750.00, institution: 'DEGIRO', color: '#3b82f6', created_at: '' },
  { id: '3', user_id: 'demo', name: 'Visa Credit Card', type: 'credit_card', currency: 'EUR', balance: -320.50, institution: 'ABN AMRO', color: '#ef4444', created_at: '' },
];

const FORMAT_LABELS: Record<BankFormat, string> = {
  ing: 'ING Bank (NL)',
  rabobank: 'Rabobank (NL)',
  abnamro: 'ABN AMRO (NL)',
  degiro: 'DEGIRO Broker',
  deutschebank: 'Deutsche Bank (DE)',
  comdirect: 'Comdirect (DE)',
  hsbc: 'HSBC (UK/NL)',
  paypal: 'PayPal',
  generic: 'Generic CSV',
};

export default function Import() {
  const [step, setStep] = useState<Step>(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<BankFormat>('generic');
  const [manualFormat, setManualFormat] = useState<BankFormat | ''>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ date: '', description: '', amount: '' });
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [editablePreview, setEditablePreview] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAccounts() {
      if (!isSupabaseConfigured) {
        setAccounts(DEMO_ACCOUNTS);
        return;
      }
      const { data } = await supabase.from('accounts').select('*').order('name');
      setAccounts(data || []);
    }
    loadAccounts();
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setCsvContent(content);

      const result = Papa.parse<Record<string, string>>(content, { header: true, preview: 1 });
      const headers = result.meta.fields || [];
      setCsvHeaders(headers);

      const fmt = detectFormat(headers);
      setDetectedFormat(fmt);
      setManualFormat('');

      if (fmt === 'generic' && headers.length >= 2) {
        setColumnMapping({ date: headers[0], description: headers[1], amount: headers[2] || headers[1] });
      }

      setStep(3);
    };
    reader.readAsText(file);
  }

  const buildPreview = useCallback(() => {
    const fmt = (manualFormat || detectedFormat) as BankFormat;
    const mapping = fmt === 'generic' ? columnMapping : undefined;
    const parsed = parseCSV(csvContent, fmt, mapping);
    setPreview(parsed.slice(0, 5));
    setEditablePreview(parsed);
  }, [csvContent, detectedFormat, manualFormat, columnMapping]);

  useEffect(() => {
    if (step === 3 && csvContent) {
      buildPreview();
    }
  }, [step, csvContent, buildPreview]);

  function updatePreviewCategory(index: number, category: string) {
    const type = category === 'Income' ? 'income' : category === 'Transfer' ? 'transfer' : 'expense';
    setEditablePreview((prev) =>
      prev.map((t, i) => i === index ? { ...t, category, type: type as ParsedTransaction['type'] } : t)
    );
    setPreview((prev) =>
      prev.map((t, i) => i === index ? { ...t, category, type: type as ParsedTransaction['type'] } : t)
    );
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      if (!isSupabaseConfigured) {
        setImportedCount(editablePreview.length);
        setStep(4);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const rows = editablePreview.map((t) => ({
        ...t,
        account_id: selectedAccount,
        user_id: user!.id,
      }));

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('transactions').insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      setImportedCount(rows.length);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep(1);
    setSelectedAccount('');
    setCsvContent('');
    setCsvHeaders([]);
    setDetectedFormat('generic');
    setManualFormat('');
    setPreview([]);
    setEditablePreview([]);
    setError('');
    setImportedCount(0);
  }

  const activeFormat = (manualFormat || detectedFormat) as BankFormat;

  const stepLabels = ['Select Account', 'Upload CSV', 'Preview & Map', 'Confirm'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Transactions</h1>
        <p className="text-gray-500 text-sm mt-0.5">Import CSV files from your bank or broker</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          const active = step === s;
          const done = step > s;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'border-blue-600 bg-blue-50' : done ? 'border-green-600 bg-green-50' : 'border-gray-300'}`}>
                  {done ? '✓' : s}
                </div>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-2" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      )}

      {/* Step 1: Select account */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Step 1: Select Account</h2>
          {accounts.length === 0 ? (
            <p className="text-gray-400 text-sm">No accounts found. Add an account first.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <label key={acc.id} className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${selectedAccount === acc.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="account"
                    value={acc.id}
                    checked={selectedAccount === acc.id}
                    onChange={() => setSelectedAccount(acc.id)}
                    className="text-blue-600"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color || '#3b82f6' }} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{acc.name}</p>
                    <p className="text-xs text-gray-500">{acc.institution} · {acc.type.replace('_', ' ')}</p>
                  </div>
                </label>
              ))}
              <button
                disabled={!selectedAccount}
                onClick={() => setStep(2)}
                className="w-full mt-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Upload CSV */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Step 2: Upload CSV File</h2>
          <p className="text-sm text-gray-600 mb-4">Supported formats: ING, Rabobank, ABN AMRO, DEGIRO, or any CSV with column mapping.</p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 transition-colors">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-gray-600 text-sm mb-3">Drag & drop your CSV file, or click to browse</p>
            <label className="cursor-pointer">
              <span className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                Choose File
              </span>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          <button onClick={() => setStep(1)} className="mt-4 text-gray-500 text-sm hover:underline">← Back</button>
        </div>
      )}

      {/* Step 3: Preview & configure */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Step 3: Preview & Configure</h2>

          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detected Format</label>
              <select
                value={manualFormat || detectedFormat}
                onChange={(e) => {
                  setManualFormat(e.target.value as BankFormat);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}{v === detectedFormat && !manualFormat ? ' (auto)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              {editablePreview.length} transactions found
            </div>
          </div>

          {activeFormat === 'generic' && csvHeaders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-3">Map CSV columns:</p>
              <div className="grid grid-cols-3 gap-3">
                {(['date', 'description', 'amount'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{field}</label>
                    <select
                      value={columnMapping[field]}
                      onChange={(e) => {
                        const newMapping = { ...columnMapping, [field]: e.target.value };
                        setColumnMapping(newMapping);
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="">Select...</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={buildPreview}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Update Preview
              </button>
            </div>
          )}

          {/* Preview table */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows):</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Date</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Description</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Category</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{t.date}</td>
                      <td className="px-3 py-2 text-gray-900 max-w-xs truncate">{t.description}</td>
                      <td className="px-3 py-2">
                        <select
                          value={t.category || 'Other'}
                          onChange={(e) => updatePreviewCategory(i, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                          style={{ borderLeftColor: getCategoryColor(t.category || 'Other'), borderLeftWidth: 3 }}
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className={`px-3 py-2 font-semibold text-right whitespace-nowrap ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.amount >= 0 ? '+' : ''}€{Math.abs(t.amount).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editablePreview.length > 5 && (
              <p className="text-xs text-gray-400 mt-2">...and {editablePreview.length - 5} more transactions</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={editablePreview.length === 0}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Review Import ({editablePreview.length} transactions)
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm import */}
      {step === 4 && importedCount === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 4: Confirm Import</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Ready to import <strong>{editablePreview.length} transactions</strong> into{' '}
              <strong>{accounts.find((a) => a.id === selectedAccount)?.name}</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${editablePreview.length} Transactions`}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 4 && importedCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Successful!</h2>
          <p className="text-gray-500 text-sm mb-6">
            {importedCount} transactions have been imported{isSupabaseConfigured ? '' : ' (demo mode)'}.
          </p>
          <button onClick={reset} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm hover:bg-blue-700">
            Import More
          </button>
        </div>
      )}
    </div>
  );
}
