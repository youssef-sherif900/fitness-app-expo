import { create } from 'zustand';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { getDb } from '@/db';
import { queueCounts } from '@/db/repos';
import * as endpoints from '@/api/endpoints';
import { ApiError, unwrap } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { isoDate, num } from '@/lib/util';

type SyncState = { pending: number; failed: number; syncing: boolean; lastSyncAt: number | null };
export const useSyncStatus = create<SyncState>(() => ({ pending: 0, failed: 0, syncing: false, lastSyncAt: null }));

type QueueRow = { id: number; entity: string; op: string; entity_id: string; payload: string; attempts: number };

async function send(item: QueueRow) {
  const db = await getDb();
  const payload = JSON.parse(item.payload);
  const key = `${item.entity}:${item.op}:${item.entity_id}`;

  if (item.entity === 'food_log' && item.op === 'create') {
    const res = await endpoints.createLog(payload, key);
    const sid = res?.id ?? res?.log?.id;
    if (sid != null) await db.runAsync(`UPDATE food_logs SET server_id=? WHERE id=?`, String(sid), item.entity_id);
  } else if (item.entity === 'food_log' && item.op === 'delete') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(`SELECT server_id FROM food_logs WHERE id=?`, item.entity_id);
    if (row?.server_id) await endpoints.deleteLog(row.server_id);
    await db.runAsync(`DELETE FROM food_logs WHERE id=?`, item.entity_id);
  } else if (item.entity === 'weight' && item.op === 'create') {
    const res = await endpoints.createWeight(payload, key);
    const sid = res?.id;
    if (sid != null) await db.runAsync(`UPDATE weights SET server_id=? WHERE id=?`, String(sid), item.entity_id);
  } else if (item.entity === 'weight' && item.op === 'delete') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(`SELECT server_id FROM weights WHERE id=?`, item.entity_id);
    if (row?.server_id) await endpoints.deleteWeight(row.server_id);
    await db.runAsync(`DELETE FROM weights WHERE id=?`, item.entity_id);
  }
}

let running = false;

export async function runSync() {
  if (running) return;
  running = true;
  useSyncStatus.setState({ syncing: true });
  const db = await getDb();
  try {
    for (;;) {
      const item = await db.getFirstAsync<QueueRow>(
        `SELECT * FROM sync_queue WHERE status='pending' ORDER BY id LIMIT 1`,
      );
      if (!item) break;
      await db.runAsync(`UPDATE sync_queue SET status='sending' WHERE id=?`, item.id);
      try {
        await send(item);
        await db.runAsync(`DELETE FROM sync_queue WHERE id=?`, item.id);
      } catch (e) {
        const err = e as ApiError;
        const permanent = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429 && err.status !== 401;
        if (permanent) {
          await db.runAsync(`UPDATE sync_queue SET status='failed', last_error=? WHERE id=?`, err.message, item.id);
          continue; // keep going, failed item stays visible with a retry action
        }
        await db.runAsync(`UPDATE sync_queue SET status='pending', attempts=attempts+1 WHERE id=?`, item.id);
        break; // offline / 5xx / 401: stop and try again on the next trigger
      }
    }
    await pull().catch(() => {});
    useSyncStatus.setState({ lastSyncAt: Date.now() });
  } finally {
    running = false;
    useSyncStatus.setState({ ...(await queueCounts()), syncing: false });
    queryClient.invalidateQueries({ queryKey: ['local'] });
  }
}

export async function retryFailed() {
  const db = await getDb();
  await db.runAsync(`UPDATE sync_queue SET status='pending', attempts=0, last_error=NULL WHERE status='failed'`);
  return runSync();
}

export async function refreshCounts() {
  useSyncStatus.setState(await queueCounts());
}

export function requestSync() {
  void refreshCounts();
  void runSync();
}

/** Pull today's logs and the weights list. Replace with the batch/cursor endpoint once the backend has it. */
async function pull() {
  const db = await getDb();
  const today = isoDate();
  const [logs, weights] = await Promise.all([endpoints.listLogs(today), endpoints.listWeights()]);

  for (const r of logs ?? []) {
    const sid = String(r.id);
    const cid = r.client_uuid ? String(r.client_uuid) : null;
    const exists = await db.getFirstAsync(`SELECT id FROM food_logs WHERE server_id=? OR id=?`, sid, cid ?? sid);
    if (exists) continue;
    await db.runAsync(
      `INSERT INTO food_logs (id, server_id, food_id, name, meal, quantity, kcal, protein, carbs, fat, logged_on, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      cid ?? `srv-${sid}`, sid, r.food_id != null ? String(r.food_id) : null,
      r.food?.name ?? r.name ?? 'Food', r.meal ?? 'snack', num(r, ['quantity']) ?? 1,
      num(r, ['calories', 'kcal']) ?? 0, num(r, ['protein']) ?? 0, num(r, ['carbs']) ?? 0, num(r, ['fat']) ?? 0,
      String(r.logged_on ?? r.date ?? today).slice(0, 10), r.created_at ?? new Date().toISOString(),
    );
  }
  for (const r of weights ?? []) {
    const sid = String(r.id);
    const cid = r.client_uuid ? String(r.client_uuid) : null;
    const exists = await db.getFirstAsync(`SELECT id FROM weights WHERE server_id=? OR id=?`, sid, cid ?? sid);
    if (exists) continue;
    await db.runAsync(
      `INSERT INTO weights (id, server_id, kg, measured_on) VALUES (?,?,?,?)`,
      cid ?? `srv-${sid}`, sid, num(r, ['weight_kg', 'kg', 'weight']) ?? 0, String(r.measured_at ?? r.date ?? today).slice(0, 10),
    );
  }
}

/** Foreground, connectivity-regained and login triggers. */
export function useSyncTriggers(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    requestSync();
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && requestSync());
    const netUnsub = NetInfo.addEventListener((s) => s.isConnected && requestSync());
    return () => {
      appSub.remove();
      netUnsub();
    };
  }, [enabled]);
}
