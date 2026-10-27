import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Txt, Button } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { Food, FoodServing, MEALS, Meal, withServing } from '@/api/types';
import { round } from '@/lib/util';
import { MealChips } from './MealChips';

/**
 * FOOD-1: serving picker with live macro preview. Nutrients are per serving,
 * so switching a serving updates the preview immediately.
 */
export function ServingSheet({
  food,
  meal,
  busy = false,
  onMealChange,
  onAdd,
  onClose,
}: {
  food: Food;
  meal: Meal;
  busy?: boolean;
  onMealChange: (meal: Meal) => void;
  onAdd: (qty: number, serving?: FoodServing) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const servings = food.servings ?? [];
  const fallback: FoodServing | undefined = food.servingId
    ? {
        id: food.servingId,
        label: food.serving || '1 serving',
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      }
    : servings.find((s) => s.isDefault) ?? servings[0];

  const [servingId, setServingId] = useState<string | undefined>(fallback?.id);
  const [qty, setQty] = useState(1);

  const serving = servings.find((s) => s.id === servingId) ?? fallback;
  const chosen = serving ? withServing(food, serving) : food;
  const step = (d: number) => setQty((q) => Math.max(0.25, Math.round((q + d) * 4) / 4));
  const mealLabel = MEALS.find((m) => m.key === meal)?.label ?? 'meal';

  return (
    <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ gap: 2 }}>
        <Txt variant="title">{food.name}</Txt>
        {food.brand ? <Txt variant="muted">{food.brand}</Txt> : null}
        <Txt variant="muted">
          {food.verified ? 'Verified food' : food.isCustom ? 'Your custom food' : 'Community food'}
        </Txt>
      </View>

      <MealChips value={meal} onChange={onMealChange} />

      {servings.length > 1 ? (
        <View style={{ gap: 6 }}>
          <Txt variant="label">Serving</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {servings.map((s) => {
              const active = s.id === servingId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setServingId(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    justifyContent: 'center',
                    borderRadius: 22,
                    backgroundColor: active ? c.primary : c.surface,
                  }}
                >
                  <Txt style={{ color: active ? c.onPrimary : c.text, fontSize: 14 }}>
                    {s.label} · {round(s.kcal)} kcal
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Txt variant="muted">{chosen.serving}</Txt>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Button title="−" variant="secondary" onPress={() => step(-0.25)} style={{ width: 56 }} />
        <Txt variant="title" accessibilityLabel={`Quantity ${qty}`}>{qty}</Txt>
        <Button title="+" variant="secondary" onPress={() => step(0.25)} style={{ width: 56 }} />
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Txt variant="big">{round(chosen.kcal * qty)} kcal</Txt>
        <Txt variant="muted">
          P {round(chosen.protein * qty, 1)} · C {round(chosen.carbs * qty, 1)} · F {round(chosen.fat * qty, 1)} g
        </Txt>
      </View>

      <Button title={`Add to ${mealLabel}`} onPress={() => onAdd(qty, serving)} loading={busy} />
      <Button title="Cancel" variant="text" onPress={onClose} disabled={busy} />
    </ScrollView>
  );
}
