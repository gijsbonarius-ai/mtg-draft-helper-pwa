import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const { code, account_id, user_id } = req.body as { code?: string; account_id?: string; user_id?: string };

    if (!code || !account_id || !user_id) {
      res.status(400).set(corsHeaders).json({ error: 'Missing required fields' });
      return;
    }

    const clientId = process.env.TRUELAYER_CLIENT_ID ?? '';
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET ?? '';
    const redirectUri = process.env.VITE_TRUELAYER_REDIRECT_URI ?? '';

    // Exchange authorization code for tokens (live endpoint)
    const tokenRes = await fetch('https://auth.truelayer.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('TrueLayer token exchange failed:', err);
      res.status(502).set(corsHeaders).json({ error: 'Token exchange failed', detail: err });
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in Supabase using service role key (bypasses RLS)
    const supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );

    const { error: upsertError } = await supabase
      .from('bank_connections')
      .upsert(
        {
          user_id,
          account_id,
          provider: 'truelayer',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
        },
        { onConflict: 'account_id' },
      );

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      res.status(500).set(corsHeaders).json({ error: 'Failed to save connection' });
      return;
    }

    res.status(200).set(corsHeaders).json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).set(corsHeaders).json({ error: 'Internal server error' });
  }
}
