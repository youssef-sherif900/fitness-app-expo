import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { ExerciseVisual } from './ExerciseVisual';
import { SLUG_BY_NAME } from './exerciseMedia.generated';
import { guideFor } from './exerciseGuides.generated';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Exercise } from './types';

function patternLabel(pattern?: string | null) {
  if (!pattern) return null;
  return pattern.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase());
}

/**
 * The preview body, without a scroll container or chrome, so it can be shown
 * inside the exercise picker's modal as well as in its own sheet.
 */
export function ExercisePreviewBody({ exercise }: { exercise: Exercise }) {
  const { spacing } = useTheme();
  const slug = exercise.slug ?? SLUG_BY_NAME[exercise.name];
  const guide = guideFor(slug);

  const primary = (exercise.primary_muscles ?? []).map((m) => MUSCLE_LABELS[m] ?? m);
  const secondary = (exercise.secondary_muscles ?? []).map((m) => MUSCLE_LABELS[m] ?? m);
  const equipment = (exercise.equipment ?? []).map((e) => EQUIPMENT_LABELS[e] ?? e);

  const subtitle = [
    patternLabel(exercise.movement_pattern),
    equipment.length ? equipment.join(' · ') : null,
    guide?.difficulty ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const description = guide?.description ?? exercise.description ?? null;

  return (
    <View style={{ gap: spacing.lg }}>
      <ExerciseVisual exercise={exercise} />

      <View style={{ gap: 4 }}>
        <Txt variant="title">{exercise.name}</Txt>
        {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
      </View>

      {primary.length || secondary.length ? (
        <View style={{ gap: 6 }}>
          {primary.length ? (
            <Txt>
              <Txt variant="label">Primary </Txt>
              {primary.join(', ')}
            </Txt>
          ) : null}
          {secondary.length ? (
            <Txt variant="muted">
              <Txt variant="label">Secondary </Txt>
              {secondary.join(', ')}
            </Txt>
          ) : null}
        </View>
      ) : null}

      {description ? <Txt>{description}</Txt> : null}

      {guide && guide.steps.length ? (
        <View style={{ gap: spacing.sm }}>
          <Txt variant="label">How to do it</Txt>
          {guide.steps.map((step, index) => (
            <View key={`${index}-${step.slice(0, 12)}`} style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: 'rgba(127,127,127,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Txt variant="label">{index + 1}</Txt>
              </View>
              <Txt style={{ flex: 1, lineHeight: 22 }}>{step}</Txt>
            </View>
          ))}
        </View>
      ) : null}

      {guide && guide.tips.length ? (
        <View style={{ gap: spacing.sm }}>
          <Txt variant="label">Coaching cues</Txt>
          {guide.tips.map((tip) => (
            <View key={tip} style={{ flexDirection: 'row', gap: 10 }}>
              <Txt variant="muted">•</Txt>
              <Txt style={{ flex: 1, lineHeight: 22 }}>{tip}</Txt>
            </View>
          ))}
        </View>
      ) : null}

      <Txt variant="muted">Illustration and instructions: RepDB (repdb.co)</Txt>
    </View>
  );
}

/** Standalone presentation for surfaces that are not already a modal. */
export function ExercisePreviewSheet({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  const { c, spacing } = useTheme();

  return (
    <Modal
      visible={exercise !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        {exercise ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
              }}
            >
              <Txt variant="label">Exercise</Txt>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close exercise preview"
                style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{
                padding: spacing.lg,
                gap: spacing.lg,
                paddingBottom: spacing.xl * 2,
              }}
            >
              <ExercisePreviewBody exercise={exercise} />
            </ScrollView>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
