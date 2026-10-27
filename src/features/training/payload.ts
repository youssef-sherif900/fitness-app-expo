import type { ApiProgram, ApiProgramDay, ApiProgramItem, DraftProgram } from './types';

export function toCreatePayload(program: DraftProgram) {
  return {
    name: program.name.trim() || 'My program',
    goal: program.goal,
    experience_level: program.experienceLevel,
    days_per_week: program.days.length,
    days: program.days.map((day, dayIndex) => ({
      name: day.name.trim() || `Day ${dayIndex + 1}`,
      day_number: dayIndex + 1,
      items: day.items.map((item, itemIndex) => ({
        exercise_id: item.exercise.id,
        position: itemIndex + 1,
        sets: item.sets,
        rep_range: { min: item.repMin, max: item.repMax },
        rest_seconds: item.restSeconds,
      })),
    })),
  };
}

export function validateProgram(program: DraftProgram): string[] {
  const problems: string[] = [];

  if (!program.name.trim()) problems.push('Give your program a name.');
  if (!program.days.length) problems.push('Add at least one training day.');
  if (program.days.length > 7) problems.push('A program can have up to seven days.');

  const itemCount = program.days.reduce((total, day) => total + day.items.length, 0);
  if (!itemCount) problems.push('A program needs at least one day with one exercise.');

  for (const day of program.days) {
    for (const item of day.items) {
      if (!item.exercise?.id) problems.push('One of the exercises is missing.');
      if (item.sets < 1 || item.sets > 30) problems.push(`${item.exercise?.name ?? 'An exercise'} needs 1–30 sets.`);
      if (item.repMin < 1 || item.repMin > item.repMax) problems.push(`Check the rep range for ${item.exercise?.name ?? 'an exercise'}.`);
      if (item.restSeconds < 0 || item.restSeconds > 600) problems.push('Rest must be between 0 and 600 seconds.');
    }
  }

  return [...new Set(problems)];
}

export function currentProgram(data: any): ApiProgram | null {
  if (!data) return null;
  if (data.program) return data.program as ApiProgram;
  if (data.id && data.name) return data as ApiProgram;
  return null;
}

export function currentDays(data: any, program: ApiProgram | null): ApiProgramDay[] {
  return (
    (data?.days as ApiProgramDay[] | undefined) ??
    program?.days ??
    (data?.program_snapshot?.days as ApiProgramDay[] | undefined) ??
    []
  );
}

export function programDays(program: ApiProgram | null | undefined): ApiProgramDay[] {
  return program?.days ?? [];
}

export function dayItems(day: ApiProgramDay | null | undefined): ApiProgramItem[] {
  const rows = day?.items ?? day?.exercises ?? [];
  return [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function itemName(item: ApiProgramItem): string {
  return item.exercise?.name ?? 'Exercise';
}

export function itemReps(item: ApiProgramItem): string {
  const min = item.rep_range?.min ?? item.rep_min;
  const max = item.rep_range?.max ?? item.rep_max;
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

export function itemMuscles(item: ApiProgramItem): string {
  return (item.exercise?.primary_muscles ?? [])
    .map((m) => m.replace(/_/g, ' '))
    .join(' · ');
}
