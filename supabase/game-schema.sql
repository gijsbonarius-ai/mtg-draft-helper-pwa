-- Game sessions table (created after draft is complete)
create table if not exists game_sessions (
  id uuid default gen_random_uuid() primary key,
  room_code text unique not null,
  state jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table game_sessions enable row level security;
create policy "public_access" on game_sessions for all using (true) with check (true);

create trigger game_sessions_updated_at
  before update on game_sessions
  for each row execute procedure update_updated_at();
