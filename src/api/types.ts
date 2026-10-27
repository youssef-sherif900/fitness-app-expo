import { num } from '@/lib/util';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export type User = { id: number | string; name?: string; email: string; [k: string]: any };

export type FoodServing = {
  id: string;
  label: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams?: number | null;
  isDefault?: boolean;
};

export type Food = {
  id: string | number;
  name: string;
  brand?: string;
  serving: string;
  servingId?: string;
  servings?: FoodServing[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  verified: boolean;
  barcode?: string;
  isCustom?: boolean;
};

/** Map the API food shape. Nutrients live on each serving, not on the food row. */
export function toFood(r: any): Food {
  const servings: FoodServing[] = (r.servings ?? []).map((s: any) => ({
    id: String(s.id),
    label: s.label ?? '1 serving',
    kcal: num(s, ['kcal', 'calories']) ?? 0,
    protein: num(s, ['protein_g', 'protein']) ?? 0,
    carbs: num(s, ['carbs_g', 'carbs']) ?? 0,
    fat: num(s, ['fat_g', 'fat']) ?? 0,
    grams: num(s, ['grams']) ?? null,
    isDefault: Boolean(s.is_default),
  }));

  const defaultServing = servings.find((s) => s.isDefault) ?? servings[0];

  return {
    id: r.id,
    name: r.name ?? r.title ?? 'Food',
    brand: r.brand ?? undefined,
    serving:
      defaultServing?.label ??
      r.serving_label ??
      r.serving ??
      (r.serving_size ? `${r.serving_size} ${r.serving_unit ?? 'g'}` : '1 serving'),
    servingId: defaultServing?.id,
    servings,
    kcal: defaultServing?.kcal ?? num(r, ['calories', 'kcal', 'energy_kcal']) ?? 0,
    protein: defaultServing?.protein ?? num(r, ['protein', 'protein_g']) ?? 0,
    carbs: defaultServing?.carbs ?? num(r, ['carbs', 'carbs_g', 'carbohydrates']) ?? 0,
    fat: defaultServing?.fat ?? num(r, ['fat', 'fat_g']) ?? 0,
    verified: Boolean(r.is_verified ?? r.verified ?? false),
    barcode: r.barcode ?? undefined,
    isCustom: Boolean(r.is_custom ?? (r.owner_id != null && r.source === 'custom')),
  };
}

/** The same food with one serving selected; used by the serving picker. */
export function withServing(food: Food, serving: FoodServing): Food {
  return {
    ...food,
    serving: serving.label,
    servingId: serving.id,
    kcal: serving.kcal,
    protein: serving.protein,
    carbs: serving.carbs,
    fat: serving.fat,
  };
}
