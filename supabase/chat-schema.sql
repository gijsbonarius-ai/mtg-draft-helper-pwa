-- Chat messages table (shared between draft and game)
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  room_code text not null,
  player_name text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;
create policy "public_access" on chat_messages for all using (true) with check (true);
create index on chat_messages (room_code, created_at);
