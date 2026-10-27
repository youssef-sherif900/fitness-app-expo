import { uuid } from '@/lib/util';
import type { DraftDay, DraftItem, DraftProgram, Exercise, ExperienceLevel, SplitDay, TrainingGoal } from './types';

const PUSH: SplitDay = {
  key: 'push',
  name: 'Push',
  muscles: ['chest', 'front_deltoids', 'side_deltoids', 'triceps'],
  slots: [
    ['chest', 2],
    ['front_deltoids', 1],
    ['side_deltoids', 1],
    ['triceps', 2],
  ],
};

const PULL: SplitDay = {
  key: 'pull',
  name: 'Pull',
  muscles: ['back', 'lats', 'rear_deltoids', 'biceps', 'forearms'],
  slots: [
    ['lats', 2],
    ['back', 2],
    ['rear_deltoids', 1],
    ['biceps', 1],
  ],
};

const LEGS: SplitDay = {
  key: 'legs',
  name: 'Legs',
  muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abs'],
  slots: [
    ['quadriceps', 2],
    ['hamstrings', 1],
    ['glutes', 1],
    ['calves', 1],
    ['abs', 1],
  ],
};

const UPPER: SplitDay = {
  key: 'upper',
  name: 'Upper',
  muscles: ['chest', 'back', 'lats', 'front_deltoids', 'biceps', 'triceps'],
  slots: [
    ['chest', 1],
    ['back', 1],
    ['lats', 1],
    ['front_deltoids', 1],
    ['biceps', 1],
    ['triceps', 1],
  ],
};

const LOWER: SplitDay = {
  key: 'lower',
  name: 'Lower',
  muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abs'],
  slots: [
    ['quadriceps', 2],
    ['hamstrings', 1],
    ['glutes', 1],
    ['calves', 1],
    ['abs', 1],
  ],
};

const FULL: SplitDay = {
  key: 'full',
  name: 'Full body',
  muscles: ['quadriceps', 'chest', 'back', 'front_deltoids', 'hamstrings', 'abs'],
  slots: [
    ['quadriceps', 1],
    ['chest', 1],
    ['back', 1],
    ['front_deltoids', 1],
    ['hamstrings', 1],
    ['abs', 1],
  ],
};

const CORE: SplitDay = {
  key: 'core',
  name: 'Core & conditioning',
  muscles: ['abs', 'obliques', 'lower_back', 'glutes', 'calves'],
  slots: [
    ['abs', 2],
    ['obliques', 1],
    ['lower_back', 1],
    ['glutes', 1],
    ['calves', 1],
  ],
};

const SPLITS: Record<number, SplitDay[]> = {
  1: [{ ...FULL, key: 'full-a', name: 'Full body' }],
  2: [
    { ...FULL, key: 'full-a', name: 'Full body A' },
    { ...FULL, key: 'full-b', name: 'Full body B' },
  ],
  3: [PUSH, PULL, LEGS],
  4: [
    { ...UPPER, key: 'upper-a', name: 'Upper A' },
    { ...LOWER, key: 'lower-a', name: 'Lower A' },
    { ...UPPER, key: 'upper-b', name: 'Upper B' },
    { ...LOWER, key: 'lower-b', name: 'Lower B' },
  ],
  5: [PUSH, PULL, LEGS, { ...UPPER, key: 'upper-a', name: 'Upper' }, { ...LOWER, key: 'lower-a', name: 'Lower' }],
  6: [
    { ...PUSH, key: 'push-a', name: 'Push A' },
    { ...PULL, key: 'pull-a', name: 'Pull A' },
    { ...LEGS, key: 'legs-a', name: 'Legs A' },
    { ...PUSH, key: 'push-b', name: 'Push B' },
    { ...PULL, key: 'pull-b', name: 'Pull B' },
    { ...LEGS, key: 'legs-b', name: 'Legs B' },
  ],
  7: [
    { ...PUSH, key: 'push', name: 'Push' },
    { ...PULL, key: 'pull', name: 'Pull' },
    { ...LEGS, key: 'legs', name: 'Legs' },
    { ...UPPER, key: 'upper', name: 'Upper' },
    { ...LOWER, key: 'lower', name: 'Lower' },
    { ...FULL, key: 'full', name: 'Full body' },
    CORE,
  ],
};

export function splitForDays(days: number): SplitDay[] {
  return SPLITS[Math.max(1, Math.min(7, days))] ?? SPLITS[3];
}

export function splitTitle(days: number): string {
  if (days === 3 || days === 6) return 'Push Pull Legs';
  if (days === 4) return 'Upper Lower';
  if (days === 2) return 'Full Body';
  return `${days}-Day Split`;
}

const GOAL_SCHEME: Record<TrainingGoal, { sets: number; min: number; max: number; rest: number }> = {
  strength: { sets: 4, min: 3, max: 5, rest: 180 },
  hypertrophy: { sets: 3, min: 8, max: 12, rest: 90 },
  endurance: { sets: 3, min: 12, max: 20, rest: 60 },
  fat_loss: { sets: 3, min: 10, max: 15, rest: 60 },
  general: { sets: 3, min: 8, max: 12, rest: 90 },
};

function prescriptionFor(goal: TrainingGoal, experience: ExperienceLevel, exercise: Exercise) {
  const scheme = GOAL_SCHEME[goal];
  let sets = scheme.sets;
  let min = scheme.min;
  let max = scheme.max;

  if (experience === 'beginner') sets -= 1;
  if (experience === 'advanced') sets += 1;

  const isolation = exercise.movement_pattern === 'isolation' || exercise.movement_pattern === 'core';
  if (isolation) {
    min += 2;
    max += 4;
  }

  if (exercise.exercise_type === 'duration') {
    sets = Math.max(2, sets - 1);
    min = 20;
    max = 45;
  }

  return {
    sets: Math.max(2, Math.min(6, sets)),
    repMin: Math.max(1, Math.min(50, min)),
    repMax: Math.max(min + 1, Math.min(60, max)),
    restSeconds: exercise.exercise_type === 'duration' ? 60 : scheme.rest,
  };
}

function equipmentAllowed(exercise: Exercise, equipment: string[], bodyweightOnly: boolean): boolean {
  const own = exercise.equipment ?? [];
  if (!own.length) return true;
  if (bodyweightOnly) return own.includes('bodyweight');
  if (!equipment.length) return true;
  const allowed = new Set([...equipment, 'bodyweight']);
  return own.some((e) => allowed.has(e));
}

function matchesMuscle(exercise: Exercise, muscle: string): boolean {
  return Boolean(
    exercise.primary_muscles?.includes(muscle) || exercise.secondary_muscles?.includes(muscle),
  );
}

/**
 * Builds the suggested split on the phone. The backend intentionally has no
 * generator route, so the wizard saves these days through POST /training/programs.
 */
export function generateDays(
  exercises: Exercise[],
  options: {
    days: number;
    goal: TrainingGoal;
    experience: ExperienceLevel;
    equipment: string[];
  },
): DraftDay[] {
  const split = splitForDays(options.days);
  const usage = new Map<string, number>();
  const bodyweightOnly =
    options.equipment.length === 1 && options.equipment[0] === 'bodyweight';

  const pick = (day: SplitDay, muscle: string, used: Set<string>): Exercise | null => {
    const available = exercises.filter(
      (ex) =>
        !used.has(ex.id) &&
        equipmentAllowed(ex, options.equipment, bodyweightOnly) &&
        matchesMuscle(ex, muscle),
    );

    const primary = available.filter((ex) => ex.primary_muscles?.includes(muscle));
    const secondary = available.filter((ex) => !primary.includes(ex));
    const pool = primary.length ? primary : secondary;

    if (!pool.length) return null;

    return [...pool].sort((a, b) => {
      const useDiff = (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0);
      return useDiff !== 0 ? useDiff : a.name.localeCompare(b.name);
    })[0];
  };

  return split.map((day) => {
    const used = new Set<string>();
    const items: DraftItem[] = [];

    for (const [muscle, count] of day.slots) {
      for (let i = 0; i < count; i++) {
        const exercise = pick(day, muscle, used);
        if (!exercise) continue;
        used.add(exercise.id);
        usage.set(exercise.id, (usage.get(exercise.id) ?? 0) + 1);
        items.push({
          key: uuid(),
          exercise,
          ...prescriptionFor(options.goal, options.experience, exercise),
        });
      }
    }

    // If a muscle group is missing from the library, fill the day with the best
    // remaining exercises that train the day's focus.
    if (items.length < 5) {
      const fallback = exercises
        .filter(
          (ex) =>
            !used.has(ex.id) &&
            equipmentAllowed(ex, options.equipment, bodyweightOnly) &&
            day.muscles.some((m) => matchesMuscle(ex, m)),
        )
        .sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))
        .slice(0, 5 - items.length);

      for (const exercise of fallback) {
        used.add(exercise.id);
        usage.set(exercise.id, (usage.get(exercise.id) ?? 0) + 1);
        items.push({
          key: uuid(),
          exercise,
          ...prescriptionFor(options.goal, options.experience, exercise),
        });
      }
    }

    return {
      key: uuid(),
      name: day.name,
      items,
    };
  });
}

export function prescriptionForExercise(
  goal: TrainingGoal,
  experience: ExperienceLevel,
  exercise: Exercise,
) {
  return prescriptionFor(goal, experience, exercise);
}

export function emptyProgram(): DraftProgram {
  return {
    name: 'My program',
    goal: 'hypertrophy',
    experienceLevel: 'intermediate',
    equipment: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
    days: [
      {
        key: uuid(),
        name: 'Day 1',
        items: [],
      },
    ],
  };
}
