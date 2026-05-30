create table bank_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  account_id uuid references accounts(id) on delete cascade not null,
  provider text not null default 'truelayer',
  truelayer_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);
alter table bank_connections enable row level security;
create policy "Users can manage own connections" on bank_connections for all using (auth.uid() = user_id);
