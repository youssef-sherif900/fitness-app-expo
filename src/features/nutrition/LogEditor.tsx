import React, { useState } from 'react';
import { View } from 'react-native';
import { Txt, Button } from '@/components/ui';
import { Meal } from '@/api/types';
import type { LogRow } from '@/db/repos';
import { round } from '@/lib/util';
import { MealChips } from './MealChips';

/** FOOD-5: edit quantity or meal, or delete with undo (handled by the screen). */
export function LogEditor({
  row,
  onSave,
  onDelete,
  onClose,
}: {
  row: LogRow;
  onSave: (patch: { quantity: number; meal: Meal }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(row.quantity);
  const [meal, setMeal] = useState<Meal>(row.meal);
  const base = row.quantity > 0 ? row.quantity : 1;
  const factor = qty / base;
  const step = (d: number) => setQty((q) => Math.max(0.25, Math.round((q + d) * 4) / 4));

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Txt variant="title">{row.name}</Txt>
        <Txt variant="muted">{row.serving_label ?? '1 serving'}{row.server_id ? '' : ' · pending sync'}</Txt>
      </View>

      <MealChips value={meal} onChange={setMeal} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Button title="−" variant="secondary" onPress={() => step(-0.25)} style={{ width: 56 }} />
        <Txt variant="title" accessibilityLabel={`Quantity ${qty}`}>{qty}</Txt>
        <Button title="+" variant="secondary" onPress={() => step(0.25)} style={{ width: 56 }} />
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Txt variant="big">{round(row.kcal * factor)} kcal</Txt>
        <Txt variant="muted">
          P {round(row.protein * factor, 1)} · C {round(row.carbs * factor, 1)} · F {round(row.fat * factor, 1)} g
        </Txt>
      </View>

      <Button title="Save changes" onPress={() => onSave({ quantity: qty, meal })} disabled={qty === row.quantity && meal === row.meal} />
      <Button title="Remove from diary" variant="secondary" onPress={onDelete} />
      <Button title="Cancel" variant="text" onPress={onClose} />
    </View>
  );
}
