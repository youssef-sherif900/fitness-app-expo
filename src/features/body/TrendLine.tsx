import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/tokens';
import { round } from '@/lib/util';
import type { TrendPoint } from './trend';

/** BODY-1: thin line chart of the smoothed trend, drawn with rotated segments so no chart library is needed. */
export function TrendLine({ points, height = 120 }: { points: TrendPoint[]; height?: number }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);

  const values = points.map((p) => p.trend);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;
  const pad = 8;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const x = (i: number) => (points.length < 2 ? width / 2 : (i / (points.length - 1)) * width);

  const summary =
    points.length > 0
      ? `Weight trend from ${round(points[0].trend, 1)} to ${round(points[points.length - 1].trend, 1)} kilograms`
      : 'No weight trend yet';

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={{ height, justifyContent: 'center' }}
    >
      {width > 0 && points.length > 1
        ? points.slice(1).map((p, i) => {
            const x1 = x(i);
            const y1 = y(points[i].trend);
            const x2 = x(i + 1);
            const y2 = y(p.trend);
            const length = Math.hypot(x2 - x1, y2 - y1);
            const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return (
              <View
                key={p.date}
                style={{
                  position: 'absolute',
                  left: (x1 + x2) / 2 - length / 2,
                  top: (y1 + y2) / 2 - 1,
                  width: length,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: c.primary,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })
        : null}

      {width > 0 && points.length === 1 ? (
        <View
          style={{
            position: 'absolute',
            left: width / 2 - 3,
            top: y(points[0].trend) - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.primary,
          }}
        />
      ) : null}
    </View>
  );
}
