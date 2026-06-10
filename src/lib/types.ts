export type UserRole = 'parent' | 'viewer' | 'pending';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface Baby {
  id: string;
  name: string;
  due_date?: string;
  birth_date?: string;
  birth_weight_grams?: number;
  birth_height_cm?: number;
  sex?: 'boy' | 'girl' | 'surprise';
  created_by: string;
  created_at: string;
}

export interface PregnancyEntry {
  id: string;
  baby_id: string;
  week: number;
  mother_weight_kg?: number;
  belly_circumference_cm?: number;
  mood?: string;
  symptoms?: string[];
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface GrowthEntry {
  id: string;
  baby_id: string;
  measured_at: string;
  weight_grams?: number;
  height_cm?: number;
  head_circumference_cm?: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  baby_id: string;
  title: string;
  content: string;
  is_private: boolean;
  tags?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  baby_id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  is_private: boolean;
  diary_entry_id?: string;
  taken_at?: string;
  created_by: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  baby_id: string;
  title: string;
  description?: string;
  achieved_at: string;
  milestone_type?: 'motor' | 'social' | 'language' | 'cognitive' | 'other';
  photo_id?: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
}
