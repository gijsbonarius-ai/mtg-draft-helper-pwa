import type { Transaction } from '../lib/types';
import { getCategoryColor, CATEGORIES } from '../lib/categories';

interface Props {
  transaction: Transaction;
  accountName?: string;
  onCategoryChange?: (id: string, category: string) => void;
}

export default function TransactionRow({ transaction, accountName, onCategoryChange }: Props) {
  const isPositive = transaction.amount >= 0;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{transaction.date}</td>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{transaction.description}</td>
      {accountName !== undefined && (
        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{accountName}</td>
      )}
      <td className="px-4 py-3 text-sm">
        {onCategoryChange ? (
          <select
            value={transaction.category || 'Other'}
            onChange={(e) => onCategoryChange(transaction.id, e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            style={{ borderLeftColor: getCategoryColor(transaction.category || 'Other'), borderLeftWidth: 3 }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <span
            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: getCategoryColor(transaction.category || 'Other') }}
          >
            {transaction.category || 'Other'}
          </span>
        )}
      </td>
      <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}
        {transaction.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );
}
