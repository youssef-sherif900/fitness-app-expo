export type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance' | 'fat_loss' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable_machine'
  | 'machine'
  | 'bench'
  | 'pullup_bar'
  | 'bands'
  | 'bodyweight'
  | 'smith_machine'
  | 'other';

export const GOALS: { key: TrainingGoal; label: string; help: string }[] = [
  { key: 'strength', label: 'Get stronger', help: 'Heavier sets with lower reps and longer rest.' },
  { key: 'hypertrophy', label: 'Build muscle', help: 'Moderate reps and steady weekly volume.' },
  { key: 'endurance', label: 'Improve endurance', help: 'Higher reps with shorter rest.' },
  { key: 'fat_loss', label: 'Lose fat', help: 'Full-body work that keeps you moving.' },
  { key: 'general', label: 'General fitness', help: 'A balanced mix of strength and conditioning.' },
];

export const EXPERIENCE_LEVELS: { key: ExperienceLevel; label: string; help: string }[] = [
  { key: 'beginner', label: 'Beginner', help: 'New to training, or returning after a long break.' },
  { key: 'intermediate', label: 'Intermediate', help: 'Training consistently for six months or more.' },
  { key: 'advanced', label: 'Advanced', help: 'Years of consistent training and comfortable with volume.' },
];

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'cable_machine', label: 'Cables' },
  { key: 'machine', label: 'Machines' },
  { key: 'bench', label: 'Bench' },
  { key: 'pullup_bar', label: 'Pull-up bar' },
  { key: 'bands', label: 'Bands' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'smith_machine', label: 'Smith machine' },
  { key: 'other', label: 'Other' },
];

export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  lats: 'Lats',
  traps: 'Traps',
  front_deltoids: 'Front delts',
  side_deltoids: 'Side delts',
  rear_deltoids: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  lower_back: 'Lower back',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  abductors: 'Abductors',
};

export const EQUIPMENT_LABELS = Object.fromEntries(EQUIPMENT.map((e) => [e.key, e.label]));

export type Exercise = {
  id: string;
  name: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  equipment?: string[];
  movement_pattern?: string;
  exercise_type?: string;
  description?: string | null;
};

export type DraftItem = {
  key: string;
  exercise: Exercise;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
};

export type DraftDay = {
  key: string;
  name: string;
  items: DraftItem[];
};

export type DraftProgram = {
  name: string;
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  equipment: Equipment[];
  days: DraftDay[];
};

export type SplitDay = {
  key: string;
  name: string;
  muscles: string[];
  slots: [string, number][];
};

export type ApiProgramDay = {
  id?: string;
  name?: string | null;
  day_number?: number;
  items?: ApiProgramItem[];
  exercises?: ApiProgramItem[];
};

export type ApiProgramItem = {
  id?: string;
  exercise_id?: string;
  position?: number;
  sets?: number;
  rep_min?: number;
  rep_max?: number;
  rep_range?: { min: number; max: number };
  rest_seconds?: number | null;
  exercise?: Exercise;
};

export type ApiProgram = {
  id: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  experience_level?: string | null;
  days_per_week?: number | null;
  status?: string;
  days?: ApiProgramDay[];
  days_count?: number;
};

export type CurrentProgramResponse = {
  assignment?: Record<string, unknown> | null;
  program?: ApiProgram | null;
  days?: ApiProgramDay[];
  program_snapshot?: Record<string, unknown> | null;
} | null;
