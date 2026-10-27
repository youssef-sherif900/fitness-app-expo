import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { addDays, isToday, isoDate, monthDay, startOfWeek, weekdayShort } from '@/lib/util';

/** FOOD-5: compact week picker with one-day and one-week navigation. */
export function DateBar({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const { c, radius } = useTheme();
  const start = startOfWeek(value);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable
          onPress={() => onChange(addDays(value, -7))}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={20} color={c.muted} />
        </Pressable>
        <Txt variant="label" style={{ flex: 1, textAlign: 'center' }}>
          {monthDay(days[0])} – {monthDay(days[6])}
        </Txt>
        {!isToday(value) ? (
          <Pressable
            onPress={() => onChange(isoDate())}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: c.surface }}
          >
            <Txt variant="muted">Today</Txt>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
        <Pressable
          onPress={() => onChange(addDays(value, 7))}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((day) => {
          const active = day === value;
          const today = isToday(day);
          return (
            <Pressable
              key={day}
              onPress={() => onChange(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={day}
              style={{
                flex: 1,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                backgroundColor: active ? c.primary : c.surface,
                borderWidth: today && !active ? 1 : 0,
                borderColor: c.primary,
              }}
            >
              <Txt style={{ color: active ? c.onPrimary : c.muted, fontSize: 11 }}>{weekdayShort(day).slice(0, 2)}</Txt>
              <Txt style={{ color: active ? c.onPrimary : c.text, fontWeight: '700' }}>{Number(day.slice(8, 10))}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
