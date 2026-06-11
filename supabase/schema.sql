-- ============================================================
-- Little Journey - Baby Tracker Schema
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- ============================================================
-- PROFILES (extends auth.users)
-- Must be created first so the helper functions can reference it
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (role IN ('parent', 'viewer', 'pending')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES profiles(id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS
-- Defined after profiles table so the reference is valid
-- ============================================================

CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('parent', 'viewer')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_parent()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES RLS POLICIES
-- ============================================================

-- Users can read their own profile + all approved/parent profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('parent','viewer'))
  );

-- Users can insert their own profile (done via signUp)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile; parents can update any profile role
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_parent());

-- Parents can delete (deny) pending profiles
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (is_parent());

-- ============================================================
-- BABIES
-- ============================================================

CREATE TABLE IF NOT EXISTS babies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  due_date            DATE,
  birth_date          DATE,
  birth_weight_grams  INTEGER,
  birth_height_cm     DECIMAL(5,2),
  sex                 TEXT CHECK (sex IN ('boy', 'girl', 'surprise')),
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE babies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "babies_select"  ON babies FOR SELECT  USING (is_approved());
CREATE POLICY "babies_insert"  ON babies FOR INSERT  WITH CHECK (is_parent());
CREATE POLICY "babies_update"  ON babies FOR UPDATE  USING (is_parent());
CREATE POLICY "babies_delete"  ON babies FOR DELETE  USING (is_parent());

-- ============================================================
-- PREGNANCY ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS pregnancy_entries (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id                UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  week                   INTEGER NOT NULL CHECK (week BETWEEN 1 AND 45),
  mother_weight_kg       DECIMAL(5,2),
  belly_circumference_cm DECIMAL(5,2),
  mood                   TEXT,
  symptoms               TEXT[],
  notes                  TEXT,
  created_by             UUID NOT NULL REFERENCES profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(baby_id, week)
);

ALTER TABLE pregnancy_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pregnancy_select" ON pregnancy_entries FOR SELECT USING (is_approved());
CREATE POLICY "pregnancy_insert" ON pregnancy_entries FOR INSERT WITH CHECK (is_parent());
CREATE POLICY "pregnancy_update" ON pregnancy_entries FOR UPDATE USING (is_parent());
CREATE POLICY "pregnancy_delete" ON pregnancy_entries FOR DELETE USING (is_parent());

-- ============================================================
-- GROWTH ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS growth_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id                  UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  measured_at              DATE NOT NULL,
  weight_grams             INTEGER,
  height_cm                DECIMAL(5,2),
  head_circumference_cm    DECIMAL(5,2),
  notes                    TEXT,
  created_by               UUID NOT NULL REFERENCES profiles(id),
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE growth_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_select" ON growth_entries FOR SELECT USING (is_approved());
CREATE POLICY "growth_insert" ON growth_entries FOR INSERT WITH CHECK (is_parent());
CREATE POLICY "growth_update" ON growth_entries FOR UPDATE USING (is_parent());
CREATE POLICY "growth_delete" ON growth_entries FOR DELETE USING (is_parent());

-- ============================================================
-- DIARY ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS diary_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id     UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  is_private  BOOLEAN NOT NULL DEFAULT FALSE,
  entry_date  DATE,
  tags        TEXT[],
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS diary_entries_date_idx ON diary_entries (baby_id, entry_date);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diary_select" ON diary_entries
  FOR SELECT USING (
    is_parent() OR (is_approved() AND is_private = FALSE)
  );

CREATE POLICY "diary_insert" ON diary_entries FOR INSERT WITH CHECK (is_parent());
CREATE POLICY "diary_update" ON diary_entries FOR UPDATE USING (is_parent());
CREATE POLICY "diary_delete" ON diary_entries FOR DELETE USING (is_parent());

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diary_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PHOTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id         UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  caption         TEXT,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  diary_entry_id  UUID REFERENCES diary_entries(id) ON DELETE SET NULL,
  taken_at        TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON photos
  FOR SELECT USING (
    is_parent() OR (is_approved() AND is_private = FALSE)
  );

CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (is_parent());
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (is_parent());
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (is_parent());

-- ============================================================
-- MILESTONES
-- ============================================================

CREATE TABLE IF NOT EXISTS milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id         UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  achieved_at     DATE NOT NULL,
  milestone_type  TEXT CHECK (milestone_type IN ('motor','social','language','cognitive','other')),
  photo_id        UUID REFERENCES photos(id) ON DELETE SET NULL,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_select" ON milestones
  FOR SELECT USING (
    is_parent() OR (is_approved() AND is_private = FALSE)
  );

CREATE POLICY "milestones_insert" ON milestones FOR INSERT WITH CHECK (is_parent());
CREATE POLICY "milestones_update" ON milestones FOR UPDATE USING (is_parent());
CREATE POLICY "milestones_delete" ON milestones FOR DELETE USING (is_parent());

-- ============================================================
-- STORAGE BUCKET POLICIES
-- Run these AFTER creating the "photos" bucket in Storage tab
-- ============================================================

-- CREATE POLICY "photos_storage_select" ON storage.objects
--   FOR SELECT USING (bucket_id = 'photos');

-- CREATE POLICY "photos_storage_insert" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'photos' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
--   );

-- CREATE POLICY "photos_storage_delete" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'photos' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
--   );
