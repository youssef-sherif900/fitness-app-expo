import { getDb } from './index';
import { uuid, isoDate } from '@/lib/util';
import type { Food, FoodServing, Meal } from '@/api/types';

export type LogRow = {
  id: string;
  server_id: string | null;
  food_id: string | null;
  serving_id: string | null;
  serving_label: string | null;
  name: string;
  meal: Meal;
  quantity: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_on: string;
  created_at: string;
  deleted: number;
};

export type WeightRow = {
  id: string;
  server_id: string | null;
  kg: number;
  measured_on: string;
  deleted: number;
};

export type RecentFoodRow = {
  food_id: string;
  serving_id: string | null;
  serving_label: string | null;
  name: string;
  quantity: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  uses?: number;
  last_used: string;
};

/** A saved-meal item as stored by the API (nutrients are the logged totals, not per serving). */
export type SavedMealItem = {
  food_id?: string | null;
  serving_id?: string | null;
  name: string;
  qty: number;
  meal?: string | null;
  kcal: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

const now = () => new Date().toISOString();

async function enqueue(entity: string, op: string, entityId: string, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (entity, op, entity_id, payload, created_at) VALUES (?,?,?,?,?)`,
    entity, op, entityId, JSON.stringify(payload), now(),
  );
}

async function rewriteQueuedCreate(entity: string, entityId: string, patch: Record<string, unknown>) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue WHERE entity=? AND op='create' AND entity_id=? AND status='pending' ORDER BY id DESC LIMIT 1`,
    entity, entityId,
  );
  if (!row) return false;
  await db.runAsync(
    `UPDATE sync_queue SET payload=? WHERE id=?`,
    JSON.stringify({ ...JSON.parse(row.payload), ...patch }), row.id,
  );
  return true;
}

// ---------------- food logs ----------------

function macros(food: Food, serving: FoodServing | undefined) {
  return serving
    ? { kcal: serving.kcal, protein: serving.protein, carbs: serving.carbs, fat: serving.fat }
    : { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat };
}

function logPayload(row: {
  food_id: string | null; serving_id: string | null; name: string; meal: Meal;
  quantity: number; kcal: number; protein: number; carbs: number; fat: number; logged_on: string;
}, id: string) {
  const common = {
    client_uuid: id,
    qty: row.quantity,
    meal: row.meal,
    logged_on: row.logged_on,
    kcal: row.kcal,
    protein_g: row.protein,
    carbs_g: row.carbs,
    fat_g: row.fat,
  };
  // LOG-1: catalog entries are validated against food + serving; quick adds carry their own snapshot.
  return row.food_id && row.serving_id
    ? { ...common, food_id: row.food_id, serving_id: row.serving_id }
    : { ...common, name: row.name };
}

async function insertLog(row: Omit<LogRow, 'id' | 'server_id' | 'deleted' | 'created_at'>) {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO food_logs (id, food_id, serving_id, serving_label, name, meal, quantity, kcal, protein, carbs, fat, logged_on, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, row.food_id, row.serving_id, row.serving_label, row.name, row.meal,
    row.quantity, row.kcal, row.protein, row.carbs, row.fat, row.logged_on, now(),
  );
  await enqueue('food_log', 'create', id, logPayload(row, id));
  return id;
}

/**
 * FOOD-1: add a catalog food or a quick entry. Nutrients come from the selected
 * serving and are stored as the snapshot for the logged quantity.
 */
export async function addFoodLog(
  food: Food,
  meal: Meal,
  quantity = 1,
  day = isoDate(),
  serving?: FoodServing,
) {
  const chosen =
    serving ??
    food.servings?.find((s) => s.id === food.servingId) ??
    food.servings?.[0] ??
    (food.servingId
      ? {
          id: food.servingId,
          label: food.serving || '1 serving',
          kcal: food.kcal,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        }
      : undefined);

  const per = macros(food, chosen);
  const qty = quantity > 0 ? quantity : 1;

  return insertLog({
    food_id: food.id != null && chosen ? String(food.id) : null,
    serving_id: chosen?.id ?? null,
    serving_label: chosen?.label ?? (food.serving || null),
    name: food.name,
    meal,
    quantity: qty,
    kcal: per.kcal * qty,
    protein: per.protein * qty,
    carbs: per.carbs * qty,
    fat: per.fat * qty,
    logged_on: day,
  });
}

/** Quick add without a catalog food (FOOD-3 / the "can't find it" path). */
export async function addQuickLog(
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  meal: Meal,
  day = isoDate(),
) {
  return insertLog({
    food_id: null,
    serving_id: null,
    serving_label: null,
    name: name.trim().slice(0, 255) || 'Quick add',
    meal,
    quantity: 1,
    kcal: Math.max(0, kcal),
    protein: Math.max(0, protein),
    carbs: Math.max(0, carbs),
    fat: Math.max(0, fat),
    logged_on: day,
  });
}

export async function listLogs(day: string) {
  const db = await getDb();
  return db.getAllAsync<LogRow>(
    `SELECT * FROM food_logs WHERE logged_on = ? AND deleted = 0 ORDER BY created_at, rowid`, day,
  );
}

/** Recent foods, newest first. Values are per single serving so they can be relogged. */
export async function recentFoods(limit = 10) {
  const db = await getDb();
  return db.getAllAsync<RecentFoodRow>(
    `SELECT food_id, serving_id, serving_label, name, quantity, kcal, protein, carbs, fat,
            MAX(created_at) AS last_used
     FROM food_logs
     WHERE deleted = 0 AND food_id IS NOT NULL
     GROUP BY food_id
     ORDER BY last_used DESC
     LIMIT ?`, limit,
  );
}

/** Frequent foods, most logged first. */
export async function frequentFoods(limit = 6) {
  const db = await getDb();
  return db.getAllAsync<RecentFoodRow>(
    `SELECT food_id, serving_id, serving_label, name, quantity, kcal, protein, carbs, fat,
            COUNT(*) AS uses, MAX(created_at) AS last_used
     FROM food_logs
     WHERE deleted = 0 AND food_id IS NOT NULL
     GROUP BY food_id
     ORDER BY uses DESC, last_used DESC
     LIMIT ?`, limit,
  );
}

/** FOOD-5: edit quantity, meal or day. The snapshot scales with the quantity. */
export async function updateFoodLog(
  id: string,
  patch: { meal?: Meal; quantity?: number; day?: string },
) {
  const db = await getDb();
  const row = await db.getFirstAsync<LogRow>(`SELECT * FROM food_logs WHERE id = ?`, id);
  if (!row) return;

  const qty = patch.quantity ?? row.quantity;
  if (!(qty > 0)) return;
  const ratio = qty / (row.quantity > 0 ? row.quantity : 1);
  const next = {
    meal: patch.meal ?? row.meal,
    quantity: qty,
    logged_on: patch.day ?? row.logged_on,
    kcal: row.kcal * ratio,
    protein: row.protein * ratio,
    carbs: row.carbs * ratio,
    fat: row.fat * ratio,
  };

  await db.runAsync(
    `UPDATE food_logs SET meal=?, quantity=?, logged_on=?, kcal=?, protein=?, carbs=?, fat=? WHERE id=?`,
    next.meal, next.quantity, next.logged_on, next.kcal, next.protein, next.carbs, next.fat, id,
  );

  const payload = {
    qty: next.quantity,
    meal: next.meal,
    logged_on: next.logged_on,
    // Sent for completeness; the API recomputes catalog values and scales quick adds server-side.
    kcal: next.kcal,
    protein_g: next.protein,
    carbs_g: next.carbs,
    fat_g: next.fat,
  };

  if (row.server_id) {
    await enqueue('food_log', 'update', id, payload);
  } else if (!(await rewriteQueuedCreate('food_log', id, payload))) {
    // The create was already in flight; it runs before this update, so the server id will exist.
    await enqueue('food_log', 'update', id, payload);
  }
}

export async function deleteFoodLog(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<LogRow>(`SELECT * FROM food_logs WHERE id = ?`, id);
  if (!row) return;

  if (!row.server_id) {
    // Never reached the server (or was rejected): cancel the whole local history.
    await db.runAsync(
      `DELETE FROM sync_queue WHERE entity='food_log' AND entity_id=? AND status IN ('pending','failed')`, id,
    );
    await db.runAsync(`DELETE FROM food_logs WHERE id = ?`, id);
    return;
  }

  await db.runAsync(`DELETE FROM sync_queue WHERE entity='food_log' AND entity_id=? AND op='update' AND status='pending'`, id);
  await db.runAsync(`UPDATE food_logs SET deleted = 1 WHERE id = ?`, id);
  await enqueue('food_log', 'delete', id, {});
}

/**
 * LOG-2: copy a meal (or the whole day) to another date. Works offline: every
 * copied row queues its own create with a fresh client UUID.
 */
export async function copyLogs(fromDay: string, toDay: string, meal?: Meal) {
  const db = await getDb();
  const rows = await db.getAllAsync<LogRow>(
    `SELECT * FROM food_logs WHERE logged_on = ? AND deleted = 0${meal ? ' AND meal = ?' : ''} ORDER BY created_at`,
    ...(meal ? [fromDay, meal] : [fromDay]),
  );

  for (const row of rows) {
    await insertLog({
      food_id: row.food_id,
      serving_id: row.serving_id,
      serving_label: row.serving_label,
      name: row.name,
      meal: row.meal,
      quantity: row.quantity,
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      logged_on: toDay,
    });
  }

  return rows.length;
}

/** LOG-2: log a saved meal (all snapshot items) into one meal slot. Returns the new local ids. */
export async function addSavedItems(items: SavedMealItem[], meal: Meal, day = isoDate()) {
  const ids: string[] = [];
  for (const item of items) {
    const qty = item.qty > 0 ? item.qty : 1;
    ids.push(await insertLog({
      food_id: item.food_id ?? null,
      serving_id: item.serving_id ?? null,
      serving_label: null,
      name: item.name,
      meal,
      quantity: qty,
      kcal: item.kcal,
      protein: item.protein_g ?? 0,
      carbs: item.carbs_g ?? 0,
      fat: item.fat_g ?? 0,
      logged_on: day,
    }));
  }
  return ids;
}

// ---------------- weights ----------------

export async function addWeight(kg: number, day = isoDate()) {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(`INSERT INTO weights (id, kg, measured_on) VALUES (?,?,?)`, id, kg, day);
  // Noon UTC keeps the weigh-in on the intended local date.
  await enqueue('weight', 'create', id, {
    client_uuid: id,
    value_kg: kg,
    measured_at: `${day}T12:00:00Z`,
  });
  return id;
}

export async function listWeightRows() {
  const db = await getDb();
  // row_id keeps same-day weigh-ins in insertion order for the trend.
  return db.getAllAsync<WeightRow & { row_id: number }>(
    `SELECT rowid AS row_id, * FROM weights WHERE deleted = 0 ORDER BY measured_on DESC, rowid DESC`,
  );
}

/** BODY-1: correct a weigh-in value. The day stays the same, so the trend keeps its shape. */
export async function updateWeightRow(id: string, kg: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<WeightRow>(`SELECT * FROM weights WHERE id = ?`, id);
  if (!row) return;

  await db.runAsync(`UPDATE weights SET kg = ? WHERE id = ?`, kg, id);
  const payload = { value_kg: kg };

  if (row.server_id) {
    await enqueue('weight', 'update', id, payload);
  } else if (!(await rewriteQueuedCreate('weight', id, payload))) {
    // The create is already in flight; it runs first, so the server id will exist.
    await enqueue('weight', 'update', id, payload);
  }
}

export async function deleteWeightRow(id: string) {  const db = await getDb();
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
