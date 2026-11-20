import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { SLUG_BY_NAME, stillsFor } from './exerciseMedia.generated';
import type { Exercise } from './types';

type Props = {
  exercise: Pick<Exercise, 'name' | 'slug'>;
  /** Optional caption under the stage (e.g. "Barbell · Bench"). */
  caption?: string;
};

/**
 * Large exercise visual.
 *
 * The free tier ships two frames, so this is a real dissolve between start and
 * peak, not invented motion. Start/Peak can be pinned for form study, and
 * Reduce Motion never auto-plays.
 */
export function ExerciseVisual({ exercise, caption }: Props) {
  const { c, spacing } = useTheme();
  const reduceMotion = useReducedMotion();
  const stills = stillsFor(exercise.slug ?? SLUG_BY_NAME[exercise.name]);

  const [phase, setPhase] = useState<'start' | 'peak'>('start');
  const [playing, setPlaying] = useState(false);
  const canPlay = Boolean(stills?.peak) && !reduceMotion;

  useEffect(() => {
    if (!playing || !canPlay) return;
    const timer = setInterval(
      () => setPhase((p) => (p === 'start' ? 'peak' : 'start')),
      1100,
    );
    return () => clearInterval(timer);
  }, [playing, canPlay]);

  const shown = canPlay ? phase : 'start';
  const source = shown === 'peak' && stills?.peak ? stills.peak : stills?.start;

  if (!stills) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: 16,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <Ionicons name="barbell-outline" size={40} color={c.muted} />
        <Txt variant="muted">No illustration for custom exercises yet</Txt>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          transition={700}
          accessible
          accessibilityLabel={`${exercise.name}, ${shown === 'peak' ? 'peak' : 'start'} position`}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderRadius: 10,
            padding: 3,
            gap: 3,
          }}
        >
          {(['start', 'peak'] as const).map((key) => {
            const selected = shown === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setPlaying(false);
                  setPhase(key);
                }}
                disabled={key === 'peak' && !stills.peak}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${key} position`}
                style={{
                  minHeight: 36,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: selected ? c.primary : 'transparent',
                  opacity: key === 'peak' && !stills.peak ? 0.4 : 1,
                }}
              >
                <Txt
                  variant="label"
                  style={{ color: selected ? c.onPrimary : c.muted, fontWeight: '600' }}
                >
                  {key === 'start' ? 'Start' : 'Peak'}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {canPlay ? (
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause demonstration' : 'Play demonstration'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 42,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={15} color={c.text} />
            <Txt variant="label" style={{ fontWeight: '600' }}>
              {playing ? 'Pause' : 'Play'}
            </Txt>
          </Pressable>
        ) : null}

        {caption ? (
          <Txt variant="muted" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
            {caption}
          </Txt>
        ) : null}
      </View>

      {reduceMotion && stills.peak ? (
        <Txt variant="muted">Reduce Motion is on, so the two positions are frozen.</Txt>
      ) : null}
    </View>
  );
}
