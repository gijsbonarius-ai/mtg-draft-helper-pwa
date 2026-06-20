-- Stage 1 security lockdown.
--
-- Replaces the permissive "public_access" (FOR ALL) policies — which currently let
-- anyone DELETE/UPDATE any row with the anon key — with least-privilege anon policies.
-- Realtime (postgres_changes) keeps working because anon SELECT is preserved.
-- DELETE is no longer granted to anon (no policy = denied).
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- This script is idempotent (safe to run more than once).

alter table public.chat_messages  enable row level security;
alter table public.draft_sessions enable row level security;
alter table public.game_sessions  enable row level security;

-- 1) Drop the old allow-everything policies (these are the actual hole).
drop policy if exists "public_access" on public.chat_messages;
drop policy if exists "public_access" on public.draft_sessions;
drop policy if exists "public_access" on public.game_sessions;

-- 2) Drop the new policy names too, so re-running this script is safe.
drop policy if exists chat_read    on public.chat_messages;
drop policy if exists chat_insert  on public.chat_messages;
drop policy if exists draft_read   on public.draft_sessions;
drop policy if exists draft_insert on public.draft_sessions;
drop policy if exists draft_update on public.draft_sessions;
drop policy if exists game_read    on public.game_sessions;
drop policy if exists game_insert  on public.game_sessions;
drop policy if exists game_update  on public.game_sessions;

-- chat_messages: read (Realtime needs it) + validated insert; NO update, NO delete
create policy chat_read   on public.chat_messages for select to anon using (true);
create policy chat_insert on public.chat_messages for insert to anon
  with check (
    char_length(message)     <= 500 and
    char_length(player_name)  <= 40  and
    room_code ~ '^[A-Z0-9]{6}$'
  );

-- draft_sessions: read + insert + update; NO delete
create policy draft_read   on public.draft_sessions for select to anon using (true);
create policy draft_insert on public.draft_sessions for insert to anon with check (room_code ~ '^[A-Z0-9]{6}$');
create policy draft_update on public.draft_sessions for update to anon using (true) with check (true);

-- game_sessions: read + insert + update; NO delete
create policy game_read   on public.game_sessions for select to anon using (true);
create policy game_insert on public.game_sessions for insert to anon with check (room_code ~ '^[A-Z0-9]{6}$');
create policy game_update on public.game_sessions for update to anon using (true) with check (true);
