import { ApiError } from '@/api/client';

/** Turn API validation fields into calm, readable lines for an InfoCard. */
export function trainingErrorLines(error: unknown): string[] {
  if (error instanceof ApiError) {
    const fieldLines = Object.values(error.fields ?? {})
      .flat()
      .filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
    if (fieldLines.length) return [...new Set(fieldLines)];
    if (error.status === 409) return [error.message];
    return [error.message];
  }
  if (error instanceof Error && error.message) return [error.message];
  return ['Something went wrong. Please try again.'];
}
