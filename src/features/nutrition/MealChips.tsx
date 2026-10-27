import React from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { MEALS, Meal } from '@/api/types';

/** Meal selection chips shared by search, scan and the log editor. */
export function MealChips({ value, onChange }: { value: Meal; onChange: (meal: Meal) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {MEALS.map((m) => {
        const active = value === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
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
            <Txt style={{ color: active ? c.onPrimary : c.text, fontSize: 14 }}>{m.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
