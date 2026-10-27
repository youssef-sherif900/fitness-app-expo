import { api, unwrap, tokenStore } from './client';

// ---------- Auth ----------
export async function login(email: string, password: string) {
  return unwrap<any>(
    await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password, device_id: await tokenStore.deviceId(), device_name: 'Expo app' },
    }),
  );
}
export async function register(name: string, email: string, password: string) {
  return unwrap<any>(
    await api('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        name,
        email,
        password,
        password_confirmation: password,
        device_id: await tokenStore.deviceId(),
        device_name: 'Expo app',
      },
    }),
  );
}
export const socialLogin = async (provider: 'apple' | 'google', token: string) =>
  unwrap<any>(
    await api('/auth/social', {
      method: 'POST',
      auth: false,
      body: { provider, token, device_id: await tokenStore.deviceId() },
    }),
  );
export const logout = () => api('/auth/logout', { method: 'POST' });
export const resendVerification = () => api('/auth/email/resend', { method: 'POST' });
export const forgotPassword = (email: string) =>
  api('/auth/forgot-password', { method: 'POST', auth: false, body: { email } });
export const resetPassword = (body: Record<string, string>) =>
  api('/auth/reset-password', { method: 'POST', auth: false, body });
export const listSessions = async () => unwrap<any[]>(await api('/auth/sessions'));
export const revokeSession = (deviceId: string) =>
  api(`/auth/sessions/${deviceId}`, { method: 'DELETE' });

// ---------- Me ----------
export const getMe = async () => unwrap<any>(await api('/me'));
export const updateProfile = async (body: Record<string, unknown>) =>
  unwrap<any>(await api('/me/profile', { method: 'PUT', body }));
export const exportMyData = () => api('/me/export');
export const deleteAccount = () => api('/me', { method: 'DELETE' });

// ---------- Nutrition targets ----------
export const getCurrentTarget = async () => unwrap<any>(await api('/nutrition/targets/current'));
export const getTargetHistory = async () => unwrap<any[]>(await api('/nutrition/targets'));
export const recalculateTargets = async () =>
  unwrap<any>(await api('/nutrition/targets/recalculate', { method: 'POST' }));

// ---------- Foods ----------
/** Cursor-paginated search (FOOD-1). The API returns `{ data, next_cursor }`. */
export const searchFoods = async (q: string, cursor?: string | null) => {
  const r: any = await api('/foods', { query: { q, cursor: cursor ?? undefined } });
  return {
    items: (Array.isArray(r?.data) ? r.data : []) as any[],
    nextCursor: (r?.next_cursor ?? null) as string | null,
  };
};
/** Empty-state suggestions: foods logged most often, with verified staples as a fallback. */
export const popularFoods = async (limit = 8) => {
  const r: any = await api('/foods/popular', { query: { limit } });
  return (Array.isArray(r?.data) ? r.data : []) as any[];
};
export const getFood = async (id: string | number) => unwrap<any>(await api(`/foods/${id}`));
export const getFoodByBarcode = async (code: string) =>
  unwrap<any>(await api(`/foods/barcode/${encodeURIComponent(code)}`));
export const createFood = async (body: Record<string, unknown>) =>
  unwrap<any>(await api('/foods', { method: 'POST', body }));
export const updateFood = async (id: string | number, body: Record<string, unknown>) =>
  unwrap<any>(await api(`/foods/${id}`, { method: 'PATCH', body }));
export const reportFood = (id: string | number, reason: string) =>
  api(`/foods/${id}/report`, { method: 'POST', body: { reason } });

// ---------- Saved meals (LOG-2) ----------
export type SavedMeal = {
  id: string;
  name: string;
  items: {
    food_id?: string | null;
    serving_id?: string | null;
    name: string;
    qty: number;
    meal?: string | null;
    kcal: number;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
  }[];
  created_at?: string;
};

export const listSavedMeals = async () => unwrap<SavedMeal[]>(await api('/nutrition/saved-meals'));
export const createSavedMeal = async (body: { name: string; items: unknown[] }) =>
  unwrap<SavedMeal>(await api('/nutrition/saved-meals', { method: 'POST', body }));
export const updateSavedMeal = async (id: string, body: Record<string, unknown>) =>
  unwrap<SavedMeal>(await api(`/nutrition/saved-meals/${id}`, { method: 'PATCH', body }));
export const deleteSavedMeal = (id: string) =>
  api(`/nutrition/saved-meals/${id}`, { method: 'DELETE' });

// ---------- Logs ----------
export const listLogs = async (date: string) => unwrap<any[]>(await api('/logs', { query: { date } }));
export const listLogsRange = async (from: string, to: string) =>
  unwrap<any[]>(await api('/logs', { query: { from, to } }));
export const logsSummary = async (from?: string, to?: string) =>
  unwrap<any>(await api('/logs/summary', { query: { from, to } }));
export const createLog = async (body: Record<string, unknown>, key: string) =>
  unwrap<any>(await api('/logs', { method: 'POST', body, idempotencyKey: key }));
export const updateLog = (id: string | number, body: Record<string, unknown>) =>
  api(`/logs/${id}`, { method: 'PATCH', body });
export const deleteLog = (id: string | number) => api(`/logs/${id}`, { method: 'DELETE' });
export const copyLogs = (body: Record<string, unknown>) => api('/logs/copy', { method: 'POST', body });

// ---------- Body ----------
/** BODY-1: `{ entries, trend, slope_kg_per_week }` (not a bare array). */
export type WeightHistory = {
  entries: any[];
  trend: { date: string; weight: number }[];
  slope_kg_per_week: number | null;
};
export const listWeights = async (from?: string, to?: string) =>
  unwrap<WeightHistory>(await api('/body/weights', { query: { from, to } }));
export const createWeight = async (body: Record<string, unknown>, key: string) =>
  unwrap<any>(await api('/body/weights', { method: 'POST', body, idempotencyKey: key }));
export const updateWeight = (id: string | number, body: Record<string, unknown>) =>
  api(`/body/weights/${id}`, { method: 'PATCH', body });
export const deleteWeight = (id: string | number) => api(`/body/weights/${id}`, { method: 'DELETE' });

// ---------- Exercises ----------
type Page<T> = { data: T[]; meta?: { next_cursor: string | null; has_more: boolean } };
/** `unwrap` already removes the outer `{ data, meta }`, so accept both shapes. */
const pageItems = <T = any>(page: any): T[] =>
  Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : [];

export const listExercises = async (query?: Record<string, string | number>) => {
  const page = unwrap<Page<any>>(
    await api('/exercises', { query: { per_page: 100, ...query } }),
  );
  return pageItems<any>(page);
};
export const getExercise = async (id: string | number) => unwrap<any>(await api(`/exercises/${id}`));

// ---------- Training ----------
export const listPrograms = async (query?: Record<string, string>) => {
  const page = unwrap<Page<any>>(await api('/training/programs', { query }));
  return pageItems<any>(page);
};
export const getCurrentProgram = async () =>
  unwrap<any>(await api('/training/programs/current'));
export const getProgram = async (id: string | number) =>
  unwrap<any>(await api(`/training/programs/${id}`));
export const createProgram = async (body: Record<string, unknown>) =>
  unwrap<any>(await api('/training/programs', { method: 'POST', body }));
export const updateProgramDays = async (id: string | number, body: Record<string, unknown>) =>
  unwrap<any>(await api(`/training/programs/${id}/days`, { method: 'PUT', body }));
export const publishProgram = async (id: string | number) =>
  unwrap<any>(await api(`/training/programs/${id}/publish`, { method: 'POST' }));
export const archiveProgram = async (id: string | number) =>
  unwrap<any>(await api(`/training/programs/${id}/archive`, { method: 'POST' }));
export const listTemplates = async (query?: Record<string, string | number>) => {
  const page = unwrap<Page<any>>(await api('/training/templates', { query }));
  return pageItems<any>(page);
};
export const copyTemplate = async (id: string | number, body?: Record<string, unknown>) =>
  unwrap<any>(await api(`/training/templates/${id}/copy`, { method: 'POST', body }));

// ---------- Workouts ----------
export const listWorkouts = async () => unwrap<any[]>(await api('/workouts'));
export const startWorkout = async (body: Record<string, unknown>) =>
  unwrap<any>(await api('/workouts', { method: 'POST', body }));
export const getWorkout = async (id: string | number) => unwrap<any>(await api(`/workouts/${id}`));
export const completeWorkout = (id: string | number) =>
  api(`/workouts/${id}/complete`, { method: 'POST' });
export const cancelWorkout = (id: string | number) => api(`/workouts/${id}/cancel`, { method: 'POST' });
export const lastPerformance = async (exerciseId: string | number) =>
  unwrap<any>(await api(`/workouts/exercises/${exerciseId}/last-performance`));

// ---------- Progress ----------
export const personalRecords = async () => unwrap<any[]>(await api('/progress/personal-records'));
export const weeklyVolume = async () => unwrap<any>(await api('/progress/weekly-volume'));

// ---------- Misc ----------
export const health = () => api('/health', { auth: false });



// ---------- Trainer Clients ----------
export type TrainerClient = {
  relationship_id: string;
  id: string;
  name: string;
  email: string;
  relationship_status: string;
  scopes: string[];
  connected_at: string;
};

export const getTrainerClients = async () =>
  unwrap<TrainerClient[]>(await api('/trainer/clients'));