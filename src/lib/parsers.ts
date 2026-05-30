import Papa from 'papaparse';
import { categorize } from './categories';
import type { BankFormat, ColumnMapping, ParsedTransaction } from './types';

export function detectFormat(headers: string[]): BankFormat {
  const h = headers.map((x) => x.toLowerCase().trim());
  if (h.includes('af/bij') || (h.includes('datum') && h.includes('naam / omschrijving'))) return 'ing';
  if (h.some((x) => x.includes('bedrag') && !x.includes('omschrijving')) && h.includes('iban/bban')) return 'rabobank';
  if (h.includes('transactiedatum') || h.includes('omschrijving') && h.includes('transactiebedrag')) return 'abnamro';
  if (h.includes('product') && h.includes('isin') && h.includes('beurs')) return 'degiro';
  return 'generic';
}

function parseAmount(raw: string): number {
  // Handle European number formats: 1.234,56 or 1234.56
  const cleaned = raw.trim().replace(/[^0-9,.-]/g, '');
  // If there's a comma after the last dot, it's European format
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    // European: 1.234,56
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(cleaned.replace(/,/g, ''));
}

function parseDate(raw: string): string {
  const s = raw.trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // YYYYMMDD
  const ymd8 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd8) return `${ymd8[1]}-${ymd8[2]}-${ymd8[3]}`;
  // Already ISO
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return s.slice(0, 10);
  return s;
}

export function parseCSV(content: string, format: BankFormat, columnMapping?: ColumnMapping): ParsedTransaction[] {
  const delimiter = format === 'rabobank' ? ';' : undefined;
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  });

  const rows = result.data;

  switch (format) {
    case 'ing':
      return parseING(rows);
    case 'rabobank':
      return parseRabobank(rows);
    case 'abnamro':
      return parseABNAMRO(rows);
    case 'degiro':
      return parseDEGIRO(rows);
    default:
      if (columnMapping) return parseGeneric(rows, columnMapping);
      return [];
  }
}

function parseING(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const rawAmount = row['Bedrag (EUR)'] || row['Amount (EUR)'] || row['Bedrag'] || '0';
    const direction = (row['Af/Bij'] || row['AF/BIJ'] || '').toLowerCase();
    let amount = parseAmount(rawAmount);
    if (direction === 'af' || direction === 'debit') amount = -Math.abs(amount);
    else amount = Math.abs(amount);

    const description = row['Naam / Omschrijving'] || row['Name / Description'] || row['Omschrijving'] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';

    return {
      date: parseDate(row['Datum'] || row['Date'] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}

function parseRabobank(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const rawAmount = row['Bedrag'] || row['Amount'] || '0';
    let amount = parseAmount(rawAmount);
    const debitCredit = (row['Debet/Credit'] || row['D/C'] || '').toUpperCase();
    if (debitCredit === 'D' || debitCredit === 'DEBET') amount = -Math.abs(amount);
    else amount = Math.abs(amount);

    const description = row['Omschrijving-1'] || row['Naam tegenpartij'] || row['Omschrijving'] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';

    return {
      date: parseDate(row['Datum'] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}

function parseABNAMRO(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const rawAmount = row['Transactiebedrag'] || row['Amount'] || '0';
    const amount = parseAmount(rawAmount);
    const description = row['Omschrijving'] || row['Naam tegenrekening'] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';

    return {
      date: parseDate(row['Transactiedatum'] || row['Datum'] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}

function parseDEGIRO(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .filter((row) => row['Datum'] || row['Date'])
    .map((row) => {
      const rawAmount = row['Totaal'] || row['Total'] || row['Bedrag'] || '0';
      const amount = parseAmount(rawAmount);
      const description = `${row['Product'] || ''} ${row['Omschrijving'] || row['Description'] || ''}`.trim();

      return {
        date: parseDate(row['Datum'] || row['Date'] || ''),
        description,
        amount,
        category: 'Investment',
        type: (amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
      };
    });
}

function parseGeneric(rows: Record<string, string>[], mapping: ColumnMapping): ParsedTransaction[] {
  return rows.map((row) => {
    const rawAmount = row[mapping.amount] || '0';
    const amount = parseAmount(rawAmount);
    const description = row[mapping.description] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';

    return {
      date: parseDate(row[mapping.date] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}
