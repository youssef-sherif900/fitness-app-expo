import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';

export function FlowHeader({
  title,
  subtitle,
  onBack,
  step,
  total,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  step?: number;
  total?: number;
}) {
  const { c, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 }}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Txt>Back</Txt>
        </Pressable>
        {step != null && total != null ? (
          <Txt variant="muted">
            Step {step} of {total}
          </Txt>
        ) : null}
      </View>

      {step != null && total != null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: step }}
          style={{ height: 6, borderRadius: 3, backgroundColor: c.track }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              width: `${Math.min(100, (step / total) * 100)}%`,
              backgroundColor: c.primary,
            }}
          />
        </View>
      ) : null}

      <Txt variant="title">{title}</Txt>
      {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
    </View>
  );
}
