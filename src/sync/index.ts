import { create } from 'zustand';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { getDb } from '@/db';
import { queueCounts } from '@/db/repos';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { addDays, isoDate, num } from '@/lib/util';

type SyncState = { pending: number; failed: number; syncing: boolean; lastSyncAt: number | null };
export const useSyncStatus = create<SyncState>(() => ({ pending: 0, failed: 0, syncing: false, lastSyncAt: null }));

type QueueRow = { id: number; entity: string; op: string; entity_id: string; payload: string; attempts: number };

async function send(item: QueueRow) {
  const db = await getDb();
  const payload = JSON.parse(item.payload);
  const key = `${item.entity}:${item.op}:${item.entity_id}`;

  if (item.entity === 'food_log' && item.op === 'create') {
    const res = await endpoints.createLog(payload, key);
    if (res?.id != null) {
      await db.runAsync(
        `UPDATE food_logs SET server_id=?, kcal=?, protein=?, carbs=?, fat=? WHERE id=?`,
        String(res.id),
        num(res, ['kcal']) ?? 0,
        num(res, ['protein_g', 'protein']) ?? 0,
        num(res, ['carbs_g', 'carbs']) ?? 0,
        num(res, ['fat_g', 'fat']) ?? 0,
        item.entity_id,
      );
    }
  } else if (item.entity === 'food_log' && item.op === 'update') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(
      `SELECT server_id FROM food_logs WHERE id=?`, item.entity_id,
    );
    // A create queued earlier in the same run sets the server id first.
    if (row?.server_id) await endpoints.updateLog(row.server_id, payload);
  } else if (item.entity === 'food_log' && item.op === 'delete') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(
      `SELECT server_id FROM food_logs WHERE id=?`, item.entity_id,
    );
    if (row?.server_id) await endpoints.deleteLog(row.server_id);
    await db.runAsync(`DELETE FROM food_logs WHERE id=?`, item.entity_id);
  } else if (item.entity === 'weight' && item.op === 'create') {
    const res = await endpoints.createWeight(payload, key);
    if (res?.id != null) {
      await db.runAsync(`UPDATE weights SET server_id=? WHERE id=?`, String(res.id), item.entity_id);
    }
  } else if (item.entity === 'weight' && item.op === 'update') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(
      `SELECT server_id FROM weights WHERE id=?`, item.entity_id,
    );
    if (row?.server_id) await endpoints.updateWeight(row.server_id, payload);
  } else if (item.entity === 'weight' && item.op === 'delete') {
    const row = await db.getFirstAsync<{ server_id: string | null }>(
      `SELECT server_id FROM weights WHERE id=?`, item.entity_id,
    );
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
          continue; // keep going; failed items stay visible with a retry action
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

/** Upsert server log rows. Locally deleted rows stay hidden (deleted flag is untouched). */
async function upsertLogs(logs: any[], fallbackDay: string) {
  const db = await getDb();

  for (const r of logs) {
    const sid = String(r.id);
    const cid = r.client_uuid ? String(r.client_uuid) : null;
    const existing = await db.getFirstAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM food_logs WHERE server_id=? OR id=? LIMIT 1`, sid, cid ?? sid,
    );
    const values = [
      sid,
      r.food_id != null ? String(r.food_id) : null,
      r.serving_id != null ? String(r.serving_id) : null,
      r.food?.name ?? r.name ?? 'Food',
      r.meal ?? 'snack',
      num(r, ['qty', 'quantity']) ?? 1,
      num(r, ['kcal', 'calories']) ?? 0,
      num(r, ['protein_g', 'protein']) ?? 0,
      num(r, ['carbs_g', 'carbs']) ?? 0,
      num(r, ['fat_g', 'fat']) ?? 0,
      String(r.logged_on ?? r.date ?? fallbackDay).slice(0, 10),
    ] as const;

    if (existing) {
      // Keep optimistic local edits until their queued change reaches the server.
      const queued = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM sync_queue WHERE entity='food_log' AND entity_id=? AND status IN ('pending','sending') LIMIT 1`,
        existing.id,
      );
      if (queued) continue;

      await db.runAsync(
        `UPDATE food_logs SET server_id=?, food_id=?, serving_id=?, name=?, meal=?, quantity=?, kcal=?, protein=?, carbs=?, fat=?, logged_on=?
         WHERE id=?`,
        ...values, existing.id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO food_logs (server_id, food_id, serving_id, name, meal, quantity, kcal, protein, carbs, fat, logged_on, id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ...values, cid ?? `srv-${sid}`, r.created_at ?? new Date().toISOString(),
      );
    }
  }
}

/**
 * On-demand pull for one day (FOOD-5). Older dates fall outside the rolling
 * sync window, so opening them fetches that day explicitly.
 */
export async function pullDay(day: string) {
  const rows = await endpoints.listLogs(day);
  await upsertLogs(Array.isArray(rows) ? rows : [], day);
  queryClient.invalidateQueries({ queryKey: ['local', 'logs', day] });
}

/** Pull recent logs for date navigation and the full weight history. Server rows win. */
async function pull() {
  const db = await getDb();
  const to = isoDate();
  const from = addDays(to, -20);

  const [logs, weights] = await Promise.all([
    endpoints.listLogsRange(from, to),
    endpoints.listWeights(),
  ]);

  await upsertLogs(Array.isArray(logs) ? logs : [], to);

  const entries = Array.isArray(weights) ? weights : weights?.entries ?? [];
  for (const r of entries) {
    const sid = String(r.id);
    const cid = r.client_uuid ? String(r.client_uuid) : null;
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM weights WHERE server_id=? OR id=? LIMIT 1`, sid, cid ?? sid,
    );
    const kg = num(r, ['value_kg', 'weight_kg', 'kg', 'weight']) ?? 0;
    const day = String(r.measured_on ?? r.measured_at ?? to).slice(0, 10);
    if (existing) {
      const queued = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM sync_queue WHERE entity='weight' AND entity_id=? AND status IN ('pending','sending') LIMIT 1`,
        existing.id,
      );
      if (queued) continue;

      await db.runAsync(`UPDATE weights SET server_id=?, kg=?, measured_on=? WHERE id=?`, sid, kg, day, existing.id);
    } else {
      await db.runAsync(
        `INSERT INTO weights (server_id, kg, measured_on, id) VALUES (?,?,?,?)`,
        sid, kg, day, cid ?? `srv-${sid}`,
      );
    }
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
