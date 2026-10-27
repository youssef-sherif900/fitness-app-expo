import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '@/config';
import { uuid } from '@/lib/util';

const K = { access: 'access_token', refresh: 'refresh_token', device: 'device_id' };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
    public retryAfter?: number,
  ) {
    super(message);
  }
  get isOffline() {
    return this.status === 0;
  }
}

export const tokenStore = {
  async get() {
    return {
      access: await SecureStore.getItemAsync(K.access),
      refresh: await SecureStore.getItemAsync(K.refresh),
    };
  },
  async set(access: string, refresh?: string | null) {
    await SecureStore.setItemAsync(K.access, access);
    if (refresh) await SecureStore.setItemAsync(K.refresh, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(K.access);
    await SecureStore.deleteItemAsync(K.refresh);
  },
  async deviceId() {
    let id = await SecureStore.getItemAsync(K.device);
    if (!id) {
      id = uuid();
      await SecureStore.setItemAsync(K.device, id);
    }
    return id;
  },
};

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

/** Laravel resources usually wrap payloads in { data }. */
export const unwrap = <T = any>(r: any): T =>
  r && typeof r === 'object' && !Array.isArray(r) && 'data' in r ? (r.data as T) : (r as T);

type Query = Record<string, string | number | boolean | undefined | null>;
type Opts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  idempotencyKey?: string;
  auth?: boolean;
  _retried?: boolean;
};

// ---- single shared refresh call -------------------------------------------
type RefreshResult = 'ok' | 'denied' | 'offline';
let inflight: Promise<RefreshResult> | null = null;

function refreshOnce(): Promise<RefreshResult> {
  if (!inflight) inflight = doRefresh().finally(() => (inflight = null));
  return inflight;
}

async function doRefresh(): Promise<RefreshResult> {
  const { refresh } = await tokenStore.get();
  if (!refresh) return 'denied';
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh, device_id: await tokenStore.deviceId() }),
    });
    if (res.status >= 500) return 'offline';
    if (!res.ok) return 'denied';
    const j = unwrap<any>(await res.json());
    const access = j.access_token ?? j.token;
    if (!access) return 'denied';
    await tokenStore.set(access, j.refresh_token ?? refresh);
    return 'ok';
  } catch {
    return 'offline';
  }
}

// ---- main wrapper -----------------------------------------------------------
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, query, idempotencyKey, auth = true } = opts;
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (auth) {
    const { access } = await tokenStore.get();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'You appear to be offline.');
  }

  if (res.status === 401 && auth && !opts._retried) {
    const r = await refreshOnce();
    if (r === 'ok') return api<T>(path, { ...opts, _retried: true });
    if (r === 'offline') throw new ApiError(0, 'You appear to be offline.');
    await tokenStore.clear();
    onSessionExpired?.();
    throw new ApiError(401, 'Your session ended. Please sign in again.');
  }

  const text = await res.text();
  let json: any = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
  }
  if (res.ok) return json as T;

  const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
  throw new ApiError(res.status, friendlyMessage(res.status, json), errorFields(json), retryAfter);
}

/** Error details live at `error.details` (API envelope) or the legacy top-level `errors`. */
function errorFields(json: any): Record<string, string[]> {
  const details = json?.error?.details ?? json?.errors;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(details)) {
    if (Array.isArray(value)) out[key] = value.map(String);
    else if (typeof value === 'string') out[key] = [value];
  }
  return out;
}

function friendlyMessage(status: number, json: any): string {
  if (status === 403) return "You don't have access to this yet.";
  if (status === 404) return "We couldn't find that.";
  if (status === 429) return 'Too many requests. Please try again shortly.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  const message = json?.error?.message ?? json?.message;
  return typeof message === 'string' && message ? message : 'Something went wrong.';
}
