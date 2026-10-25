import { getDb } from './index';
import { uuid, isoDate } from '@/lib/util';
import type { Food, Meal } from '@/api/types';

export type LogRow = {
  id: string;
  server_id: string | null;
  food_id: string | null;
  name: string;
  meal: Meal;
  quantity: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_on: string;
  deleted: number;
};
export type WeightRow = { id: string; server_id: string | null; kg: number; measured_on: string; deleted: number };

const now = () => new Date().toISOString();

async function enqueue(entity: string, op: string, entityId: string, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (entity, op, entity_id, payload, created_at) VALUES (?,?,?,?,?)`,
    entity, op, entityId, JSON.stringify(payload), now(),
  );
}

// ---------------- food logs ----------------
export async function addFoodLog(food: Food, meal: Meal, quantity = 1, day = isoDate()) {
  const db = await getDb();
  const id = uuid();
  const row = {
    id,
    food_id: String(food.id),
    name: food.name,
    meal,
    quantity,
    kcal: food.kcal * quantity,
    protein: food.protein * quantity,
    carbs: food.carbs * quantity,
    fat: food.fat * quantity,
    logged_on: day,
  };
  await db.runAsync(
    `INSERT INTO food_logs (id, food_id, name, meal, quantity, kcal, protein, carbs, fat, logged_on, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, row.food_id, row.name, row.meal, row.quantity, row.kcal, row.protein, row.carbs, row.fat, row.logged_on, now(),
  );
  // Field names are the assumed API contract; adjust once confirmed in docs/api.json.
  await enqueue('food_log', 'create', id, {
    client_uuid: id,
    food_id: food.id,
    meal,
    quantity,
    logged_on: day,
    calories: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  });
  return id;
}

export async function listLogs(day: string) {
  const db = await getDb();
  return db.getAllAsync<LogRow>(
    `SELECT * FROM food_logs WHERE logged_on = ? AND deleted = 0 ORDER BY created_at`, day,
  );
}

export async function recentFoods(limit = 15) {
  const db = await getDb();
  return db.getAllAsync<{ food_id: string; name: string; kcal: number; protein: number; carbs: number; fat: number; quantity: number }>(
    `SELECT food_id, name, kcal, protein, carbs, fat, quantity FROM food_logs
     WHERE deleted = 0 AND food_id IS NOT NULL GROUP BY food_id ORDER BY MAX(created_at) DESC LIMIT ?`, limit,
  );
}

export async function deleteFoodLog(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<LogRow>(`SELECT * FROM food_logs WHERE id = ?`, id);
  if (!row) return;
  if (!row.server_id) {
    // never reached the server: cancel the pending create and drop the row
    const pending = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM sync_queue WHERE entity='food_log' AND op='create' AND entity_id=? AND status IN ('pending','failed')`, id,
    );
    if (pending) {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, pending.id);
      await db.runAsync(`DELETE FROM food_logs WHERE id = ?`, id);
      return;
    }
  }
  await db.runAsync(`UPDATE food_logs SET deleted = 1 WHERE id = ?`, id);
  await enqueue('food_log', 'delete', id, {});
}

// ---------------- weights ----------------
export async function addWeight(kg: number, day = isoDate()) {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(`INSERT INTO weights (id, kg, measured_on) VALUES (?,?,?)`, id, kg, day);
  await enqueue('weight', 'create', id, { client_uuid: id, weight_kg: kg, measured_at: day });
  return id;
}

export async function listWeightRows() {
  const db = await getDb();
  return db.getAllAsync<WeightRow>(`SELECT * FROM weights WHERE deleted = 0 ORDER BY measured_on DESC, rowid DESC`);
}

export async function deleteWeightRow(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<WeightRow>(`SELECT * FROM weights WHERE id = ?`, id);
  if (!row) return;
  if (!row.server_id) {
    await db.runAsync(`DELETE FROM sync_queue WHERE entity='weight' AND entity_id=?`, id);
    await db.runAsync(`DELETE FROM weights WHERE id = ?`, id);
    return;
  }
  await db.runAsync(`UPDATE weights SET deleted = 1 WHERE id = ?`, id);
  await enqueue('weight', 'delete', id, {});
}

// ---------------- queue info ----------------
export async function queueCounts() {
  const db = await getDb();
  const r = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT SUM(status != 'failed') AS pending, SUM(status = 'failed') AS failed FROM sync_queue`,
  );
  return { pending: r?.pending ?? 0, failed: r?.failed ?? 0 };
}
