import type { Account } from '../lib/types';

interface Props {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  bank: 'Bank Account',
  investment: 'Investment',
  credit_card: 'Credit Card',
};

export default function AccountCard({ account, onEdit, onDelete }: Props) {
  const isNegative = account.balance < 0;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
      style={{ borderLeftColor: account.color || '#3b82f6', borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{account.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {typeLabels[account.type] || account.type}
            {account.institution && ` · ${account.institution}`}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(account)}
            className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors text-sm"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>
      <div className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>
        {account.currency} {account.balance.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
