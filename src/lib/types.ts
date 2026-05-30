export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'investment' | 'credit_card';
  currency: string;
  balance: number;
  institution?: string;
  color?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  type: 'income' | 'expense' | 'transfer';
  created_at: string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  type: 'income' | 'expense' | 'transfer';
}

export type BankFormat = 'ing' | 'rabobank' | 'abnamro' | 'degiro' | 'generic';

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  type?: string;
}
