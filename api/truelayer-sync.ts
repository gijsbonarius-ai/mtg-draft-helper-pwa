import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TRUELAYER_AUTH_URL = 'https://auth.truelayer.com/connect/token';
const TRUELAYER_API_URL = 'https://api.truelayer.com';

interface TrueLayerTransaction {
  timestamp?: string;
  date?: string;
  description?: string;
  merchant_name?: string;
  amount: number;
  transaction_classification?: string[];
}

function categorize(description: string): string {
  const lower = description.toLowerCase();
  if (/albert heijn|lidl|aldi|jumbo|supermarkt|grocery|groceries/.test(lower)) return 'Groceries';
  if (/ov-chipkaart|ns |gvb|ret |htm |bus |tram |metro |train|transport|uber|taxi/.test(lower)) return 'Transport';
  if (/restaurant|cafe|kfc|mcdonalds|burger|pizza|coffee|starbucks|dining/.test(lower)) return 'Dining';
  if (/netflix|spotify|disney|prime|subscription/.test(lower)) return 'Subscriptions';
  if (/salary|salaris|loon|payroll/.test(lower)) return 'Income';
  if (/rent|huur|hypotheek|mortgage/.test(lower)) return 'Housing';
  if (/ziekenhuis|apotheek|dokter|pharmacy|hospital|health/.test(lower)) return 'Health';
  return 'Other';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).set(corsHeaders).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).set(corsHeaders).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { account_id, user_id } = req.body as { account_id?: string; user_id?: string };

    if (!account_id || !user_id) {
      res.status(400).set(corsHeaders).json({ error: 'Missing required fields' });
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );

    // Fetch the bank connection
    const { data: connection, error: connError } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('account_id', account_id)
      .eq('user_id', user_id)
      .single();

    if (connError || !connection) {
      res.status(404).set(corsHeaders).json({ error: 'Bank connection not found' });
      return;
    }

    const clientId = process.env.TRUELAYER_CLIENT_ID ?? '';
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET ?? '';

    // Refresh token if it expires within 5 minutes
    let accessToken: string = connection.access_token;
    const expiresAt = new Date(connection.token_expires_at).getTime();
    if (Date.now() + 5 * 60 * 1000 >= expiresAt) {
      const refreshRes = await fetch(TRUELAYER_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.refresh_token,
        }),
      });

      if (!refreshRes.ok) {
        const err = await refreshRes.text();
        console.error('Token refresh failed:', err);
        res.status(502).set(corsHeaders).json({ error: 'Token refresh failed' });
        return;
      }

      const newTokens = await refreshRes.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from('bank_connections')
        .update({
          access_token: accessToken,
          refresh_token: newTokens.refresh_token,
          token_expires_at: newExpiresAt,
        })
        .eq('id', connection.id);
    }

    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // Fetch TrueLayer account ID if not stored yet
    let truelayerAccountId: string = connection.truelayer_account_id;
    if (!truelayerAccountId) {
      const accountsRes = await fetch(`${TRUELAYER_API_URL}/data/v1/accounts`, { headers: authHeaders });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json() as { results?: { account_id: string }[] };
        truelayerAccountId = accountsData.results?.[0]?.account_id ?? '';
        if (truelayerAccountId) {
          await supabase
            .from('bank_connections')
            .update({ truelayer_account_id: truelayerAccountId })
            .eq('id', connection.id);
        }
      }
    }

    if (!truelayerAccountId) {
      res.status(502).set(corsHeaders).json({ error: 'Could not determine TrueLayer account ID' });
      return;
    }

    // Fetch balance
    const balanceRes = await fetch(
      `${TRUELAYER_API_URL}/data/v1/accounts/${truelayerAccountId}/balance`,
      { headers: authHeaders },
    );
    if (balanceRes.ok) {
      const balanceData = await balanceRes.json() as { results?: { current: number }[] };
      const balance = balanceData.results?.[0]?.current;
      if (balance !== undefined) {
        await supabase
          .from('accounts')
          .update({ balance })
          .eq('id', account_id);
      }
    }

    // Fetch transactions (last 90 days)
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];
    const txRes = await fetch(
      `${TRUELAYER_API_URL}/data/v1/accounts/${truelayerAccountId}/transactions?from=${from}&to=${to}`,
      { headers: authHeaders },
    );

    let transactionsAdded = 0;
    if (txRes.ok) {
      const txData = await txRes.json() as { results?: TrueLayerTransaction[] };
      const transactions = (txData.results ?? []).map((tx) => {
        const dateStr = tx.timestamp ? tx.timestamp.split('T')[0] : (tx.date ?? to);
        const description = tx.description ?? tx.merchant_name ?? '';
        return {
          user_id,
          account_id,
          date: dateStr,
          description,
          amount: tx.amount,
          type: tx.amount >= 0 ? 'income' : 'expense',
          category: categorize(description),
        };
      });

      if (transactions.length > 0) {
        const { count } = await supabase
          .from('transactions')
          .upsert(transactions, { onConflict: 'account_id,date,description,amount', count: 'exact' });
        transactionsAdded = count ?? transactions.length;
      }
    }

    // Update last_synced_at
    await supabase
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    res.status(200).set(corsHeaders).json({ success: true, transactions_added: transactionsAdded });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).set(corsHeaders).json({ error: 'Internal server error' });
  }
}
