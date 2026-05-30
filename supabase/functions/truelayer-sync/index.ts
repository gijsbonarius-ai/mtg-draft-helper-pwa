// TrueLayer sync edge function
// Fetches latest transactions and balance from TrueLayer and stores them in Supabase.
//
// To switch from sandbox to live:
//   - Change TRUELAYER_API_URL env var to https://api.truelayer.com
//   - Change TRUELAYER_AUTH_URL env var to https://auth.truelayer.com/connect/token

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { account_id, user_id } = await req.json();

    if (!account_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch the bank connection
    const { data: connection, error: connError } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('account_id', account_id)
      .eq('user_id', user_id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Bank connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sandbox: https://auth.truelayer-sandbox.com/connect/token
    // Live:    https://auth.truelayer.com/connect/token  (change TRUELAYER_AUTH_URL env var)
    const authUrl = Deno.env.get('TRUELAYER_AUTH_URL') ?? 'https://auth.truelayer-sandbox.com/connect/token';
    // Sandbox: https://api.truelayer-sandbox.com
    // Live:    https://api.truelayer.com  (change TRUELAYER_API_URL env var)
    const apiUrl = Deno.env.get('TRUELAYER_API_URL') ?? 'https://api.truelayer-sandbox.com';

    const clientId = Deno.env.get('TRUELAYER_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('TRUELAYER_CLIENT_SECRET') ?? '';

    // Refresh token if it expires within 5 minutes
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.token_expires_at).getTime();
    if (Date.now() + 5 * 60 * 1000 >= expiresAt) {
      const refreshRes = await fetch(authUrl, {
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
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newTokens = await refreshRes.json();
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

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Fetch TrueLayer accounts to get the truelayer_account_id
    let truelayerAccountId = connection.truelayer_account_id;
    if (!truelayerAccountId) {
      const accountsRes = await fetch(`${apiUrl}/data/v1/accounts`, { headers });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        truelayerAccountId = accountsData.results?.[0]?.account_id;
        if (truelayerAccountId) {
          await supabase
            .from('bank_connections')
            .update({ truelayer_account_id: truelayerAccountId })
            .eq('id', connection.id);
        }
      }
    }

    if (!truelayerAccountId) {
      return new Response(JSON.stringify({ error: 'Could not determine TrueLayer account ID' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch balance
    const balanceRes = await fetch(`${apiUrl}/data/v1/accounts/${truelayerAccountId}/balance`, { headers });
    if (balanceRes.ok) {
      const balanceData = await balanceRes.json();
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
      `${apiUrl}/data/v1/accounts/${truelayerAccountId}/transactions?from=${from}&to=${to}`,
      { headers },
    );

    if (txRes.ok) {
      const txData = await txRes.json();
      const transactions = (txData.results ?? []).map((tx: Record<string, unknown>) => ({
        user_id,
        account_id,
        date: (tx.timestamp as string).split('T')[0],
        description: tx.description as string,
        amount: Math.abs(tx.amount as number),
        type: (tx.amount as number) >= 0 ? 'income' : 'expense',
        category: (tx.transaction_classification as string[])?.join(' > ') || undefined,
      }));

      if (transactions.length > 0) {
        await supabase
          .from('transactions')
          .upsert(transactions, { onConflict: 'account_id,date,description,amount' });
      }
    }

    // Update last_synced_at
    await supabase
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
