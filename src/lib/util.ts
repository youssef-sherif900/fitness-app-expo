import * as Crypto from 'expo-crypto';

export const uuid = () => Crypto.randomUUID();

export function isoDate(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** First numeric value found under any of the given keys (backend field names are not final). */
export function num(obj: any, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

export const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Parse a YYYY-MM-DD day in local time (avoids UTC date shifts). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Monday-first start of the week containing `day`. */
export function startOfWeek(day: string): string {
  const d = parseDay(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}

export const isToday = (day: string) => day === isoDate();

export const weekdayShort = (day: string) =>
  parseDay(day).toLocaleDateString(undefined, { weekday: 'short' });

export const monthDay = (day: string) =>
  parseDay(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const longDate = (day: string) =>
  parseDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
