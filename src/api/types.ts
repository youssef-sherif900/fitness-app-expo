import { num } from '@/lib/util';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export type User = { id: number | string; name?: string; email: string; [k: string]: any };

export type Food = {
  id: string | number;
  name: string;
  brand?: string;
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  verified: boolean;
  barcode?: string;
};

/** Defensive mapping: confirm field names against docs/api.json (Scramble) and tighten. */
export function toFood(r: any): Food {
  return {
    id: r.id,
    name: r.name ?? r.title ?? 'Food',
    brand: r.brand ?? undefined,
    serving:
      r.serving_label ??
      r.serving ??
      (r.serving_size ? `${r.serving_size} ${r.serving_unit ?? 'g'}` : '1 serving'),
    kcal: num(r, ['calories', 'kcal', 'energy_kcal']) ?? 0,
    protein: num(r, ['protein', 'protein_g']) ?? 0,
    carbs: num(r, ['carbs', 'carbs_g', 'carbohydrates']) ?? 0,
    fat: num(r, ['fat', 'fat_g']) ?? 0,
    verified: Boolean(r.is_verified ?? r.verified ?? false),
    barcode: r.barcode ?? undefined,
  };
}
