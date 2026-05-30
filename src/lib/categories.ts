export const CATEGORIES = [
  'Groceries',
  'Transport',
  'Subscriptions',
  'Dining',
  'Income',
  'Housing',
  'Insurance',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Utilities',
  'Education',
  'Travel',
  'Investment',
  'Transfer',
  'Other',
];

const rules: { keywords: string[]; category: string }[] = [
  { keywords: ['albert heijn', 'jumbo', 'lidl', 'aldi', 'ah ', 'supermarket', 'plus supermarkt', 'dirk', 'hoogvliet', 'vomar'], category: 'Groceries' },
  { keywords: ['shell', 'bp ', 'esso', 'tankstation', 'texaco', 'total ', 'q8 '], category: 'Transport' },
  { keywords: ['ns ', 'ov-chipkaart', 'ov chipkaart', 'uber', 'bolt ', 'connexxion', 'arriva', 'gvb ', 'ret ', 'htm '], category: 'Transport' },
  { keywords: ['netflix', 'spotify', 'amazon prime', 'disney+', 'hbo', 'videoland', 'youtube premium', 'apple music'], category: 'Subscriptions' },
  { keywords: ['restaurant', 'cafe ', 'mcdonalds', 'starbucks', 'burger king', 'dominos', 'thuisbezorgd', 'deliveroo', 'eten', 'pizza'], category: 'Dining' },
  { keywords: ['salary', 'salaris', 'loon ', 'payroll', 'wages'], category: 'Income' },
  { keywords: ['rent', 'huur', 'mortgage', 'hypotheek'], category: 'Housing' },
  { keywords: ['insurance', 'verzekering', 'achmea', 'interpolis', 'nationale nederlanden', 'centraal beheer'], category: 'Insurance' },
  { keywords: ['apotheek', 'pharmacy', 'huisarts', 'tandarts', 'ziekenhuis', 'hospital', 'zorgverzekering'], category: 'Healthcare' },
  { keywords: ['cinema', 'bioscoop', 'theater', 'concert', 'museum', 'pathé'], category: 'Entertainment' },
  { keywords: ['bol.com', 'amazon', 'zalando', 'h&m', 'zara', 'primark', 'ikea'], category: 'Shopping' },
  { keywords: ['energie', 'gas ', 'water ', 'elektriciteit', 'vattenfall', 'nuon', 'eneco', 'essent'], category: 'Utilities' },
  { keywords: ['degiro', 'investering', 'aandelen', 'etf', 'dividend'], category: 'Investment' },
  { keywords: ['overboeking', 'transfer', 'overschrijving'], category: 'Transfer' },
];

export function categorize(description: string): string {
  const lower = description.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Other';
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Groceries: '#22c55e',
    Transport: '#3b82f6',
    Subscriptions: '#8b5cf6',
    Dining: '#f97316',
    Income: '#10b981',
    Housing: '#ef4444',
    Insurance: '#6366f1',
    Healthcare: '#ec4899',
    Entertainment: '#f59e0b',
    Shopping: '#06b6d4',
    Utilities: '#84cc16',
    Education: '#a855f7',
    Travel: '#14b8a6',
    Investment: '#0ea5e9',
    Transfer: '#94a3b8',
    Other: '#64748b',
  };
  return colors[category] || '#64748b';
}
