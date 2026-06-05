export type UserRole = "paddler" | "coach" | "captain" | "beginner" | "competitive";
export type TrainingEnv = "team_boat" | "erg" | "solo_water" | "mixed";
export type WorkoutType = "erg" | "water" | "team" | "dryland";
export type PaddleSide = "left" | "right" | "both";
export type WaterCondition = "flat" | "slight_chop" | "choppy" | "windy" | "current";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  training_env: TrainingEnv;
  paddle_side: PaddleSide;
  experience_years: number;
  goals: string[];
  preferred_distances: number[];
  team_id?: string;
  created_at: string;
}

export interface ErgSession {
  id: string;
  user_id: string;
  date: string;
  distance_m: number;
  duration_sec: number;
  split_sec: number;
  stroke_rate: number;
  watts?: number;
  heart_rate?: number;
  rpe: number;
  resistance?: number;
  paddle_side: PaddleSide;
  workout_type: "steady" | "intervals" | "test" | "pyramid";
  notes?: string;
  created_at: string;
}

export interface WaterSession {
  id: string;
  user_id: string;
  date: string;
  distance_m: number;
  duration_sec: number;
  avg_pace_sec: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  stroke_rate?: number;
  heart_rate?: number;
  rpe: number;
  boat_type: string;
  paddle_type?: string;
  water_condition: WaterCondition;
  wind_speed?: number;
  notes?: string;
  route_data?: object;
  created_at: string;
}

export interface TeamSession {
  id: string;
  team_id: string;
  user_id: string;
  date: string;
  duration_min: number;
  distance_m?: number;
  practice_type: "endurance" | "starts" | "race_pieces" | "technique" | "intervals" | "mixed";
  seat_position?: number;
  paddle_side: PaddleSide;
  role_in_boat: "paddler" | "drummer" | "steersperson" | "caller";
  stroke_rate?: number;
  notes?: string;
  coach_feedback?: string;
  created_at: string;
}

export interface DrylandSession {
  id: string;
  user_id: string;
  date: string;
  duration_min: number;
  exercises: ExerciseSet[];
  rpe: number;
  notes?: string;
  created_at: string;
}

export interface ExerciseSet {
  name: string;
  sets: number;
  reps?: number;
  duration_sec?: number;
  weight_kg?: number;
  rpe?: number;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  category: "erg" | "water";
  distance_m: number;
  time_sec: number;
  date: string;
  session_id?: string;
  notes?: string;
  previous_time_sec?: number;
  improvement_sec?: number;
  conditions?: string;
}

export interface TrainingPlan {
  id: string;
  name: string;
  description: string;
  duration_weeks: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  focus: string[];
  weekly_schedule: WeeklySchedule[];
}

export interface WeeklySchedule {
  week: number;
  days: DayWorkout[];
}

export interface DayWorkout {
  day: number;
  type: WorkoutType | "rest" | "recovery";
  name: string;
  description: string;
  duration_min: number;
  intensity: "easy" | "moderate" | "hard" | "max";
  target_stroke_rate?: number;
  target_distance_m?: number;
  notes?: string;
}

export interface TechniqueLesson {
  id: string;
  title: string;
  category: string;
  summary: string;
  explanation: string;
  common_mistakes: string[];
  coaching_cues: string[];
  drills: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  coach_id: string;
  created_at: string;
  members: TeamMember[];
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  role: UserRole;
  paddle_side: PaddleSide;
  seat_number?: number;
  joined_at: string;
}

export interface DashboardStats {
  weekly_distance_m: number;
  weekly_time_min: number;
  weekly_sessions: number;
  avg_stroke_rate: number;
  current_streak: number;
  total_sessions: number;
}
