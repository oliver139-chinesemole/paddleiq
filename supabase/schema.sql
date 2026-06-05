-- PaddleIQ Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS ====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('paddler','coach','captain','beginner','competitive')) DEFAULT 'paddler',
  training_env TEXT[] DEFAULT '{}',
  paddle_side TEXT CHECK (paddle_side IN ('left','right','both')) DEFAULT 'left',
  experience_years INTEGER DEFAULT 0,
  goals TEXT[] DEFAULT '{}',
  preferred_distances INTEGER[] DEFAULT '{}',
  team_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TEAMS ====================
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  coach_id UUID REFERENCES profiles(id),
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seat_number INTEGER,
  paddle_side TEXT CHECK (paddle_side IN ('left','right','both')),
  role_in_team TEXT CHECK (role_in_team IN ('paddler','drummer','steersperson','caller','coach')) DEFAULT 'paddler',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ==================== ERG SESSIONS ====================
CREATE TABLE IF NOT EXISTS erg_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  split_sec DECIMAL(6,2),
  stroke_rate INTEGER,
  watts INTEGER,
  heart_rate INTEGER,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  resistance INTEGER,
  paddle_side TEXT CHECK (paddle_side IN ('left','right','both')),
  workout_type TEXT CHECK (workout_type IN ('steady','intervals','test','pyramid')) DEFAULT 'steady',
  interval_template TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== WATER SESSIONS ====================
CREATE TABLE IF NOT EXISTS water_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  avg_pace_sec DECIMAL(6,2),
  avg_speed_kmh DECIMAL(5,2),
  max_speed_kmh DECIMAL(5,2),
  stroke_rate INTEGER,
  heart_rate INTEGER,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  boat_type TEXT,
  paddle_type TEXT,
  water_condition TEXT CHECK (water_condition IN ('flat','slight_chop','choppy','windy','current')),
  wind_speed_kmh INTEGER,
  notes TEXT,
  route_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TEAM SESSIONS ====================
CREATE TABLE IF NOT EXISTS team_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INTEGER,
  distance_m INTEGER,
  practice_type TEXT CHECK (practice_type IN ('endurance','starts','race_pieces','technique','intervals','mixed')),
  seat_number INTEGER,
  paddle_side TEXT CHECK (paddle_side IN ('left','right')),
  role_in_boat TEXT CHECK (role_in_boat IN ('paddler','drummer','steersperson','caller')) DEFAULT 'paddler',
  stroke_rate INTEGER,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  notes TEXT,
  coach_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== DRYLAND SESSIONS ====================
CREATE TABLE IF NOT EXISTS dryland_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INTEGER,
  exercises JSONB DEFAULT '[]',
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PERSONAL RECORDS ====================
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('erg','water')) NOT NULL,
  distance_m INTEGER NOT NULL,
  time_sec INTEGER NOT NULL,
  date DATE NOT NULL,
  session_id UUID,
  notes TEXT,
  previous_time_sec INTEGER,
  improvement_sec INTEGER,
  conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, distance_m)
);

-- ==================== TRAINING PLANS ====================
CREATE TABLE IF NOT EXISTS user_training_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  current_week INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  progress JSONB DEFAULT '{}'
);

-- ==================== TECHNIQUE VIDEOS ====================
CREATE TABLE IF NOT EXISTS technique_videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  video_url TEXT,
  session_type TEXT CHECK (session_type IN ('erg','team','solo_water','dryland')),
  notes TEXT,
  coach_comments TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TEAM ANNOUNCEMENTS ====================
CREATE TABLE IF NOT EXISTS team_announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE erg_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dryland_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_plans ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Erg sessions: own data only
CREATE POLICY "Users can manage own erg sessions" ON erg_sessions FOR ALL USING (auth.uid() = user_id);

-- Water sessions: own data only
CREATE POLICY "Users can manage own water sessions" ON water_sessions FOR ALL USING (auth.uid() = user_id);

-- Team sessions: own data only
CREATE POLICY "Users can manage own team sessions" ON team_sessions FOR ALL USING (auth.uid() = user_id);

-- Dryland sessions: own data only
CREATE POLICY "Users can manage own dryland sessions" ON dryland_sessions FOR ALL USING (auth.uid() = user_id);

-- PRs: own data only
CREATE POLICY "Users can manage own PRs" ON personal_records FOR ALL USING (auth.uid() = user_id);

-- Training plans: own data only
CREATE POLICY "Users can manage own training plans" ON user_training_plans FOR ALL USING (auth.uid() = user_id);

-- ==================== AUTO PR DETECTION FUNCTION ====================
CREATE OR REPLACE FUNCTION check_and_update_pr()
RETURNS TRIGGER AS $$
DECLARE
  existing_pr personal_records%ROWTYPE;
  pace_500 DECIMAL;
BEGIN
  -- Calculate split per 500m
  IF NEW.distance_m > 0 AND NEW.duration_sec > 0 THEN
    pace_500 := (NEW.duration_sec::DECIMAL / NEW.distance_m) * 500;
  ELSE
    RETURN NEW;
  END IF;

  -- Check for existing PR
  SELECT * INTO existing_pr
  FROM personal_records
  WHERE user_id = NEW.user_id
    AND category = TG_TABLE_NAME::text -- 'erg' or 'water'
    AND distance_m = NEW.distance_m;

  IF existing_pr.id IS NULL THEN
    -- First time at this distance — create PR
    INSERT INTO personal_records (user_id, category, distance_m, time_sec, date)
    VALUES (NEW.user_id, CASE WHEN TG_TABLE_NAME = 'erg_sessions' THEN 'erg' ELSE 'water' END, NEW.distance_m, NEW.duration_sec, NEW.date);
  ELSIF NEW.duration_sec < existing_pr.time_sec THEN
    -- New PR!
    UPDATE personal_records SET
      previous_time_sec = time_sec,
      improvement_sec = time_sec - NEW.duration_sec,
      time_sec = NEW.duration_sec,
      date = NEW.date
    WHERE id = existing_pr.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for auto PR detection
CREATE TRIGGER erg_pr_check AFTER INSERT ON erg_sessions FOR EACH ROW EXECUTE FUNCTION check_and_update_pr();
CREATE TRIGGER water_pr_check AFTER INSERT ON water_sessions FOR EACH ROW EXECUTE FUNCTION check_and_update_pr();

-- ==================== PROFILE AUTO-CREATE ====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
