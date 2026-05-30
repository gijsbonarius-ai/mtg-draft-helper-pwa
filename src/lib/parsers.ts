import Papa from 'papaparse';
import { categorize } from './categories';
import type { BankFormat, ColumnMapping, ParsedTransaction } from './types';

export function detectFormat(headers: string[]): BankFormat {
  const h = headers.map((x) => x.toLowerCase().trim());
  if (h.includes('af/bij') || h.includes('af bij') || (h.includes('datum') && h.includes('naam / omschrijving'))) return 'ing';
  if (h.some((x) => x.includes('bedrag') && !x.includes('omschrijving')) && h.includes('iban/bban')) return 'rabobank';
  if (h.includes('transactiedatum') || (h.includes('omschrijving') && h.includes('transactiebedrag'))) return 'abnamro';
  if (h.includes('product') && h.includes('isin') && h.includes('beurs')) return 'degiro';
  if (h.includes('buchungstag') && (h.includes('soll') || h.includes('haben'))) return 'deutschebank';
  if (h.includes('buchungstag') && h.includes('buchungstext') && h.includes('umsatz in eur')) return 'comdirect';
  if (h.includes('date') && (h.includes('money out') || h.includes('money in') || (h.includes('debit') && h.includes('credit') && h.includes('balance')))) return 'hsbc';
  if (h.includes('name') && h.includes('net') && h.includes('gross') && h.includes('currency')) return 'paypal';
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
  const semicolonFormats: BankFormat[] = ['rabobank', 'deutschebank', 'comdirect'];
  const delimiter = semicolonFormats.includes(format) ? ';' : undefined;

  // Skip metadata rows at top for Deutsche Bank and Comdirect
  let csvContent = content;
  if (format === 'deutschebank' || format === 'comdirect') {
    const lines = content.split('\n');
    const headerIdx = lines.findIndex((l) => l.toLowerCase().includes('buchungstag'));
    if (headerIdx > 0) csvContent = lines.slice(headerIdx).join('\n');
  }

  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  });

  const rows = result.data;

  switch (format) {
    case 'ing':        return parseING(rows);
    case 'rabobank':   return parseRabobank(rows);
    case 'abnamro':    return parseABNAMRO(rows);
    case 'degiro':     return parseDEGIRO(rows);
    case 'deutschebank': return parseDeutscheBank(rows);
    case 'comdirect':  return parseComdirect(rows);
    case 'hsbc':       return parseHSBC(rows);
    case 'paypal':     return parsePayPal(rows);
    default:
      if (columnMapping) return parseGeneric(rows, columnMapping);
      return [];
  }
}

function parseING(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const rawAmount = row['Bedrag (EUR)'] || row['Amount (EUR)'] || row['Bedrag'] || '0';
    const direction = (row['Af/Bij'] || row['AF/BIJ'] || row['Af Bij'] || '').toLowerCase();
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

function parseDeutscheBank(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const debit = parseAmount(row['Soll'] || row['Debit'] || '0');
    const credit = parseAmount(row['Haben'] || row['Credit'] || '0');
    const amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    const description = row['Verwendungszweck'] || row['Purpose'] || row['Buchungstext'] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';
    return {
      date: parseDate(row['Buchungstag'] || row['Wert'] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}

function parseComdirect(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .filter((row) => row['Buchungstag'] && row['Buchungstag'].trim() !== '')
    .map((row) => {
      const rawAmount = row['Umsatz in EUR'] || row['Umsatz'] || '0';
      // Comdirect uses + for credit, - for debit embedded in the amount string
      const amount = parseAmount(rawAmount);
      const description = row['Buchungstext'] || row['Vorgang'] || '';
      const category = categorize(description);
      const type: 'income' | 'expense' | 'transfer' =
        category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';
      return {
        date: parseDate(row['Buchungstag'] || ''),
        description,
        amount,
        category,
        type,
      };
    });
}

function parseHSBC(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row) => {
    const moneyOut = parseAmount(row['Money Out'] || row['Debit'] || '0');
    const moneyIn = parseAmount(row['Money In'] || row['Credit'] || '0');
    const amount = moneyIn !== 0 ? Math.abs(moneyIn) : -Math.abs(moneyOut);
    const description = row['Description'] || row['Transaction Details'] || '';
    const category = categorize(description);
    const type: 'income' | 'expense' | 'transfer' =
      category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';
    return {
      date: parseDate(row['Date'] || row['Transaction Date'] || ''),
      description,
      amount,
      category,
      type,
    };
  });
}

function parsePayPal(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .filter((row) => row['Date'] && row['Net'])
    .map((row) => {
      const amount = parseAmount(row['Net'] || '0');
      const description = row['Name'] || row['Item Title'] || row['Subject'] || '';
      const category = categorize(description);
      const type: 'income' | 'expense' | 'transfer' =
        category === 'Transfer' ? 'transfer' : amount >= 0 ? 'income' : 'expense';
      return {
        date: parseDate(row['Date'] || ''),
        description,
        amount,
        category,
        type,
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
