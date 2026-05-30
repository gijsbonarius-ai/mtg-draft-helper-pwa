// TrueLayer token exchange edge function
// Exchanges an OAuth authorization code for access + refresh tokens
// and stores them in the bank_connections table.
//
// To switch from sandbox to live:
//   - Change TRUELAYER_AUTH_URL env var to https://auth.truelayer.com/connect/token
//   - Change TRUELAYER_API_URL env var in truelayer-sync to https://api.truelayer.com

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
    const { code, account_id, user_id } = await req.json();

    if (!code || !account_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange authorization code for tokens
    // Sandbox: https://auth.truelayer-sandbox.com/connect/token
    // Live:    https://auth.truelayer.com/connect/token  (change env var TRUELAYER_AUTH_URL)
    const authUrl = Deno.env.get('TRUELAYER_AUTH_URL') ?? 'https://auth.truelayer-sandbox.com/connect/token';
    const clientId = Deno.env.get('TRUELAYER_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('TRUELAYER_CLIENT_SECRET') ?? '';
    const redirectUri = Deno.env.get('TRUELAYER_REDIRECT_URI') ?? '';

    const tokenRes = await fetch(authUrl, {
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
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: err }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in Supabase using service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error: upsertError } = await supabase
      .from('bank_connections')
      .upsert({
        user_id,
        account_id,
        provider: 'truelayer',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
      }, { onConflict: 'account_id' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
