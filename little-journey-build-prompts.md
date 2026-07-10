# Little Journey — Build Prompts

A sequenced set of prompts to build the "Little Journey" pregnancy & baby
tracker from scratch in a fresh project. Paste them **one at a time** into
Claude Code (or your AI coding tool), waiting for each step to finish before
sending the next.

These prompts bake in fixes for the bugs found in the first build, so the
rebuild is correct from the start.

---

## Prompt 0 — Project setup

```
Create a new web app called "Little Journey": a private, cloud-based
pregnancy and baby-growth tracker for two parents, with a cute baby-diary
aesthetic.

Stack:
- React 18 + TypeScript + Vite
- Tailwind CSS
- Supabase (Postgres + Auth + Storage) for the backend
- React Router v6
- Recharts for charts
- lucide-react for icons
- Fonts: Nunito (display) + Inter (body) from Google Fonts

Set up the project scaffolding now: Vite React+TS app, Tailwind configured,
React Router, a Supabase client in src/lib/supabase.ts that reads
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from env (with a clear error if
missing), and a .env.example. Add a soft pastel theme in tailwind.config.js
with colors: blossom (pink), powder (blue), sunshine (yellow), meadow
(green), lilac (purple), cream (warm background), plus soft/card shadows.
Set the app title and PWA meta in index.html. Name the package
"little-journey". Don't build features yet — just the scaffold.
```

---

## Prompt 1 — Database schema (Supabase)

```
Create supabase/schema.sql for Little Journey. Requirements and IMPORTANT
correctness rules:

Tables:
- profiles (extends auth.users): id (PK, refs auth.users on delete cascade),
  display_name, email, role ('parent'|'viewer'|'pending', default 'pending'),
  avatar_url, created_at, approved_at, approved_by.
- babies: id, name, due_date, birth_date, birth_weight_grams,
  birth_height_cm, sex ('boy'|'girl'|'surprise'), created_by, created_at.
- pregnancy_entries: id, baby_id, week (1-45), mother_weight_kg,
  belly_circumference_cm, mood, symptoms (text[]), notes, created_by,
  created_at. UNIQUE(baby_id, week).
- growth_entries: id, baby_id, measured_at (DATE), weight_grams, height_cm,
  head_circumference_cm, notes, created_by, created_at.
  UNIQUE(baby_id, measured_at).
- diary_entries: id, baby_id, title, content, is_private (default false),
  entry_date (DATE), created_by, created_at, updated_at.
  UNIQUE(baby_id, entry_date). Index on (baby_id, entry_date).
- photos: id, baby_id, storage_path, caption, is_private (default false),
  entry_date (DATE), created_by, created_at.
- milestones: id, baby_id, title, description, achieved_at, is_private,
  created_by, created_at.

CRITICAL ordering & RLS rules (these caused real bugs before — follow
exactly):
1. Create the profiles table FIRST, before any function that references it.
2. Helper functions is_parent() and is_approved() must be
   LANGUAGE SQL SECURITY DEFINER STABLE and MUST include
   `SET search_path = public`, and must schema-qualify `public.profiles`.
   They return whether auth.uid()'s profile role is parent / in
   (parent,viewer).
3. The profiles_select policy must NOT contain an inline subquery on the
   profiles table (that causes infinite RLS recursion). Use:
   USING (auth.uid() = id OR is_approved()).
4. profiles_update MUST have a WITH CHECK that prevents privilege
   escalation: a normal user updating their own row must NOT be able to
   change their own role/approved_at/approved_by; only is_parent() may change
   roles. (e.g. USING (auth.uid()=id OR is_parent()) WITH CHECK
   (is_parent() OR (auth.uid()=id AND role = (SELECT role FROM public.profiles
   WHERE id = auth.uid())))).
5. Enable RLS on every table. babies/pregnancy_entries/growth_entries:
   select = is_approved(), insert/update/delete = is_parent().
   diary_entries/photos/milestones: select =
   is_parent() OR (is_approved() AND is_private = false);
   insert/update/delete = is_parent().
6. Add an AFTER INSERT trigger on auth.users called handle_new_user that
   auto-creates the profile row from raw_user_meta_data->>'display_name'
   (fallback to the email prefix). The function must be
   SECURITY DEFINER with SET search_path = public and use public.profiles.
   Make the FIRST ever registered user a 'parent' and everyone after
   'pending'.
7. Add an updated_at trigger for diary_entries.

Also include, at the bottom, ready-to-run (uncommented) Storage policies for
a PRIVATE bucket named 'photos': allow SELECT/INSERT/DELETE on
storage.objects where bucket_id='photos' and the user is a parent (for
write) or approved (for read). Add a comment explaining the bucket must be
created as PRIVATE and the app will use signed URLs.
```

---

## Prompt 2 — Auth

```
Build authentication for Little Journey with Supabase Auth.

Create src/hooks/useAuth.tsx exposing an AuthProvider + useAuth() with:
user, session, profile, loading, signIn, signUp(email,password,displayName),
signOut, refreshProfile.

CRITICAL robustness rules (a real bug before):
- signUp must pass displayName via options.data.display_name so the DB
  trigger can create the profile. Do NOT insert the profile from the client.
- fetchProfile must use try/finally and ALWAYS call setLoading(false), even
  if the query errors or returns no row, so the app can never hang on a
  loading spinner.
- On sign-out / auth logout, reset profile to null.

Also add a "previewingAsViewer" boolean to the context: when true, the
exposed `profile.role` is overridden to 'viewer' (keep the real profile
separately) so a parent can preview the viewer experience. Reset it on
sign out.

Create src/components/ProtectedRoute.tsx that redirects to /login when there
is no user, and shows a cute loading state while loading.

Create Login and Register pages matching the pastel theme. Register collects
name/email/password and, on success, shows a "waiting for approval" screen
(new accounts are 'pending'). Show a clear message if Supabase env vars are
missing. Handle and display auth errors; show loading states on submit.
```

---

## Prompt 3 — Shared date utilities (do this before the timeline)

```
Create src/lib/dates.ts with LOCAL-date helpers, and use them everywhere
that converts between dates and keys. This prevents a timezone bug:
NEVER use Date.toISOString() to derive a calendar day.

Include:
- toLocalDateKey(date): returns 'YYYY-MM-DD' built from getFullYear/
  getMonth/getDate (local), never toISOString.
- parseLocalDate(str): parse 'YYYY-MM-DD' into a local-midnight Date.
- getLMP(dueDate): last menstrual period = due date minus 280 days, computed
  consistently (single source of truth — do not duplicate this elsewhere).
- daysBetween(a,b), addDays(date,n).
- pregnancyWeekForDate(date, lmp) and weekStartDate(week, lmp) that are exact
  inverses of each other (weekStartDate(w) fed back into
  pregnancyWeekForDate returns w).
- getBabyAgeDisplay(birthDate), getDaysUntilDueDate(dueDate) using these
  local helpers.

All timeline keys, content-indicator lookups, and save paths must use these
helpers so the key used to STORE always equals the key used to LOOK UP.
```

---

## Prompt 4 — Development-info content

```
Create src/lib/pregnancyData.ts and src/lib/babyData.ts with the
educational content shown on the timeline.

pregnancyData.ts: an array of weeks 4–40, each with: week, sizeComparison
(e.g. "a blueberry"), sizeEmoji, babyDevelopment, momChanges, funFact.
Export getWeekInfo(week) that clamps to the nearest available week.

babyData.ts: developmental milestones for baby ages (0,1,2,3,6,9,12,18,24
months): age, title, description, emoji, category. Export helpers to get the
current/upcoming milestones for a given age in months. Use calendar-month
math consistent with the timeline (setMonth), not 30.44-day approximations.
```

---

## Prompt 5 — Timeline (main screen)

```
Build the main Timeline page (src/pages/Timeline.tsx) — a vertical
scrollable timeline, the heart of the app.

- If the baby has no birth_date -> pregnancy mode: show weeks 1–42 with
  important pregnancy MILESTONE cards (cute illustrated/emoji cards) at
  weeks 4,6,8,12,16,20,24,28,37,40 interspersed among week rows.
- If the baby has a birth_date -> baby mode: show days from birth to today+7,
  with month-anniversary milestone cards and month labels.
- Build the item list in src/lib/timelineData.ts as a typed TimelineItem[].
  Each item has a stable `key`. Use src/lib/dates.ts helpers ONLY — the
  key for a pregnancy row is `week-N`, for a baby day it's the local
  'YYYY-MM-DD'. getEntryDateForItem(item) must return the SAME key basis
  used for lookups (local date), never toISOString.
- Auto-scroll to the current week/day on load; add a "Today" jump button.
- Content indicator dots: query diary_entries.entry_date, photos.entry_date,
  and (growth_entries.measured_at | pregnancy_entries.week) — only the
  key columns, lightweight — and build three Sets. A row shows small colored
  dots for which content types exist. The lookup key MUST match the store
  key exactly (both via dates.ts helpers).
- Tapping a non-future row opens a full-screen DayDetail (next prompt).
- Handle the no-baby case with a friendly "create a baby profile" empty
  state (only parents see the create button).

Performance note: for baby mode, if there could be hundreds of days,
render efficiently (e.g. group past days by month or lazy-render) so the
list stays smooth.
```

---

## Prompt 6 — Day detail (diary, photos, data)

```
Build src/components/DayDetail.tsx — a full-screen modal opened from a
timeline item, with a development-info strip and three tabs: Story, Photos,
Data.

CRITICAL data rules (real bugs before):
- ALL saves must use Supabase .upsert(payload, { onConflict: '...' }) against
  the real unique constraints (diary: baby_id,entry_date; growth:
  baby_id,measured_at; pregnancy: baby_id,week) — never a manual
  "insert-if-not-loaded" pattern, which creates duplicates.
- Always set baby_id and created_by on writes.
- Derive entry_date/measured_at from src/lib/dates.ts local helpers so it
  matches the timeline keys.
- Number inputs: parse with Number() and guard with Number.isFinite; write
  null (not NaN) when empty/invalid. Accept comma decimals defensively.
- For non-parent viewers (including a parent in preview-as-viewer mode):
  filter out is_private rows client-side as defense-in-depth, and hide all
  edit/save/upload controls. Never show private content to a viewer.
- Reset all form state when the selected item changes (clear previous day's
  values in the load effect's else-branches).

Story tab: title + textarea + private/shared toggle, upsert to
diary_entries.
Photos tab: upload (caption + private checkbox), grid, lightbox with delete.
Photos live in a PRIVATE Supabase Storage bucket named 'photos' — upload to
`${baby_id}/${entry_date}/${filename}`, store storage_path + entry_date in
the photos table, and display via createSignedUrl (with expiry), NOT
getPublicUrl. Surface upload/DB errors to the user, and if the DB insert
fails after a successful upload, delete the orphaned storage object.
Data tab: pregnancy mode (mother weight, belly, mood, symptom chips, notes ->
pregnancy_entries) or baby mode (weight g, height cm, head cm, notes ->
growth_entries).
```

---

## Prompt 7 — Data overview page

```
Build src/pages/DataOverview.tsx — charts and trends.

- Stat cards: latest weight, latest height, birth weight, birth height.
- A Baby/Pregnancy section toggle when both kinds of data exist.
- Recharts LineCharts for: baby weight, height, head circumference; and
  pregnancy mom-weight and belly circumference. Only render a chart when it
  has >= 2 data points.
- Sort all series by real date (use a sortable date key including the year,
  not just day+month, to avoid points colliding).
- A table listing all measurements.
- Guard against empty/null data so nothing crashes.
```

---

## Prompt 8 — Settings, roles & layout

```
Build src/components/Layout.tsx and src/pages/Settings.tsx, plus wire up
routing in App.tsx.

Layout: minimal sticky header (app name + baby name + avatar initial),
a bottom nav with Timeline / Data / Settings, a "pending approval" waiting
screen for pending users, and a blue "Previewing as viewer" banner (with an
Exit button) when previewingAsViewer is on.

Settings:
- Profile card showing name, email, role badge. Use optional chaining for
  the avatar initial (display_name?.[0] — a blank name must not crash).
- Baby profile form (parents only): create or update the baby (name, sex,
  due date, birth date, birth weight/height). Parse numbers safely.
- "Preview as viewer" button (parents only) toggling previewingAsViewer.
- Pending approvals list (parents): approve -> role 'viewer' (+approved_at/
  approved_by), deny -> delete. Refetch the list after each action and
  check Supabase errors (don't optimistically desync on failure).
- People-with-access list with a Revoke option for viewers.
- Sign out.

App.tsx routes: /login, /register (public); protected /timeline, /data,
/settings behind ProtectedRoute + Layout, with / redirecting to /timeline.
```

---

## Prompt 9 — Deploy

```
Add a vercel.json with an SPA rewrite so client-side routes don't 404:
{ "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }

Then give me step-by-step instructions to:
1. Create the Supabase project, run supabase/schema.sql, and create a
   PRIVATE storage bucket named 'photos'.
2. Deploy the frontend to Vercel with VITE_SUPABASE_URL and
   VITE_SUPABASE_ANON_KEY env vars (from Supabase Project Settings > API).
3. Register the first account (it auto-becomes parent via the trigger).
```

---

## Notes / lessons already baked in
- **No privilege escalation:** profiles_update has a WITH CHECK so users
  can't self-promote to parent.
- **No RLS recursion:** profiles_select uses is_approved() (SECURITY
  DEFINER), not an inline subquery.
- **No timezone day-drift:** all date↔key conversion goes through local-date
  helpers in dates.ts; never toISOString() for calendar days.
- **No duplicate rows:** every save is an upsert against a real unique
  constraint.
- **No hanging spinner:** fetchProfile always clears loading in finally.
- **Private really means private:** photos use a private bucket + signed
  URLs, and viewers get private rows filtered client-side too.
- **Trigger reliability:** handle_new_user is SECURITY DEFINER with
  SET search_path = public and schema-qualified tables.
```
