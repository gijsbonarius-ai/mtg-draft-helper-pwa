-- Winston Draft sessions table
create table if not exists draft_sessions (
  id uuid default gen_random_uuid() primary key,
  room_code text unique not null,
  state jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allow public access (room code acts as the secret)
alter table draft_sessions enable row level security;
create policy "public_access" on draft_sessions for all using (true) with check (true);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger draft_sessions_updated_at
  before update on draft_sessions
  for each row execute procedure update_updated_at();
