import { parseDay } from '@/lib/util';

export type TrendPoint = { date: string; weight: number; trend: number };

/**
 * BODY-1: mirror of the API's smoothed trend (exponentially weighted moving
 * average, alpha 0.1, gap-adjusted) so the line still draws offline.
 */
export function smoothedTrend(entries: { measured_on: string; kg: number }[], alpha = 0.1): TrendPoint[] {
  // Several weigh-ins on one day: the latest wins, like the API.
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.measured_on, e.kg);

  const days = [...byDay.keys()].sort();
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  let prev: string | null = null;

  for (const date of days) {
    const weight = byDay.get(date)!;
    if (trend == null) {
      trend = weight;
    } else {
      const gap = Math.max(1, (parseDay(date).getTime() - parseDay(prev!).getTime()) / 86_400_000);
      const a = 1 - (1 - alpha) ** gap;
      trend += a * (weight - trend);
    }
    prev = date;
    out.push({ date, weight, trend: Math.round(trend * 100) / 100 });
  }

  return out;
}

/** kg per week across the trend series (null when it cannot be estimated). */
export function weeklySlope(series: TrendPoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const days = (parseDay(last.date).getTime() - parseDay(first.date).getTime()) / 86_400_000;
  if (days < 1) return null;
  return Math.round(((last.trend - first.trend) / days) * 7 * 100) / 100;
}

/** Plain-language direction of the trend, e.g. "losing about 0.3 kg a week". */
export function describeSlope(slope: number | null): string {
  if (slope == null) return 'Log a few more weigh-ins to see a rate.';
  if (Math.abs(slope) < 0.1) return 'Your weight is holding steady.';
  const rate = Math.abs(slope).toFixed(1);
  return slope < 0 ? `Losing about ${rate} kg a week.` : `Gaining about ${rate} kg a week.`;
}
