export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
};

export type Workout = {
  id: string;
  user_id: string;
  name: string;
  date: string;
  created_at: string;
  exercises?: Exercise[];
};

export type Exercise = {
  id: string;
  workout_id: string;
  name: string;
  muscle_group?: string;
  sets?: WorkoutSet[];
};

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  reps: number;
  weight: number;
  set_order: number;
};

export type WaterIntake = {
  id: string;
  user_id: string;
  amount_ml: number;
  date: string;
};

export type DietLog = {
  id: string;
  user_id: string;
  meal_name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  date: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  friend_profile?: Profile;
};
