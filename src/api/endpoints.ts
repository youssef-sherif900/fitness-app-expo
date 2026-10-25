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
export const searchFoods = async (q: string) =>
  unwrap<any[]>(await api('/foods', { query: { q, search: q } }));
export const getFood = async (id: string | number) => unwrap<any>(await api(`/foods/${id}`));
export const getFoodByBarcode = async (code: string) =>
  unwrap<any>(await api(`/foods/barcode/${encodeURIComponent(code)}`));
export const createFood = async (body: Record<string, unknown>) =>
  unwrap<any>(await api('/foods', { method: 'POST', body }));
export const reportFood = (id: string | number, reason: string) =>
  api(`/foods/${id}/report`, { method: 'POST', body: { reason } });

// ---------- Logs ----------
export const listLogs = async (date: string) => unwrap<any[]>(await api('/logs', { query: { date } }));
export const logsSummary = async (from?: string, to?: string) =>
  unwrap<any>(await api('/logs/summary', { query: { from, to } }));
export const createLog = async (body: Record<string, unknown>, key: string) =>
  unwrap<any>(await api('/logs', { method: 'POST', body, idempotencyKey: key }));
export const updateLog = (id: string | number, body: Record<string, unknown>) =>
  api(`/logs/${id}`, { method: 'PATCH', body });
export const deleteLog = (id: string | number) => api(`/logs/${id}`, { method: 'DELETE' });
export const copyLogs = (body: Record<string, unknown>) => api('/logs/copy', { method: 'POST', body });

// ---------- Body ----------
export const listWeights = async () => unwrap<any[]>(await api('/body/weights'));
export const createWeight = async (body: Record<string, unknown>, key: string) =>
  unwrap<any>(await api('/body/weights', { method: 'POST', body, idempotencyKey: key }));
export const deleteWeight = (id: string | number) => api(`/body/weights/${id}`, { method: 'DELETE' });

// ---------- Exercises ----------
export const listExercises = async (query?: Record<string, string>) =>
  unwrap<any[]>(await api('/exercises', { query }));
export const getExercise = async (id: string | number) => unwrap<any>(await api(`/exercises/${id}`));

// ---------- Training ----------
export const listPrograms = async () => unwrap<any[]>(await api('/training/programs'));
export const getCurrentProgram = async () => unwrap<any>(await api('/training/programs/current'));
export const getProgram = async (id: string | number) =>
  unwrap<any>(await api(`/training/programs/${id}`));
export const listTemplates = async () => unwrap<any[]>(await api('/training/templates'));
export const copyTemplate = async (id: string | number) =>
  unwrap<any>(await api(`/training/templates/${id}/copy`, { method: 'POST' }));

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
