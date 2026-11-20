import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme/tokens';
import { SLUG_BY_NAME, stillsFor } from './exerciseMedia.generated';
import type { Exercise } from './types';

type Props = {
  exercise: Pick<Exercise, 'name' | 'slug'>;
  size?: number;
  /** Circular by default; square thumbs suit dense tables. */
  shape?: 'circle' | 'rounded';
  /** Peak frame for anything that should read as a still (print, PDF, reduce motion). */
  staticPeak?: boolean;
  style?: object;
};

/**
 * Exercise still with the free-tier start → peak dissolve.
 *
 * The licence gives us two frames, not a clip, so this is an honest crossfade
 * rather than fake motion. Reduce Motion turns it into a single frame.
 */
export function ExerciseThumb({ exercise, size = 56, shape = 'circle', staticPeak = false, style }: Props) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [peak, setPeak] = useState(false);

  const stills = stillsFor(exercise.slug ?? SLUG_BY_NAME[exercise.name]);
  const animating = Boolean(stills?.peak) && !reduceMotion && !staticPeak;

  useEffect(() => {
    if (!animating) return;

    // 1.1 s per pose: close to a controlled rep tempo, slow enough to read.
    const timer = setInterval(() => setPeak((value) => !value), 1100);
    return () => clearInterval(timer);
  }, [animating]);

  const showPeak = animating ? peak : staticPeak;

  const radius = shape === 'circle' ? size / 2 : 12;

  if (!stills) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Ionicons name="barbell-outline" size={Math.round(size * 0.44)} color={c.muted} />
      </View>
    );
  }

  return (
    <Image
      source={showPeak && stills.peak ? stills.peak : stills.start}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: c.surface,
        },
        style,
      ]}
      contentFit="cover"
      // expo-image crossfades when the source changes, which is exactly the
      // dissolve between the two licensed frames.
      transition={animating ? 700 : 0}
      accessible={false}
    />
  );
}
