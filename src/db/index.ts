import * as SQLite from 'expo-sqlite';

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;
export const getDb = () => (dbp ??= open());

async function open() {
  const db = await SQLite.openDatabaseAsync('fitness.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY NOT NULL,          -- client UUID
      server_id TEXT,
      food_id TEXT,
      name TEXT NOT NULL,
      meal TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      kcal REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      logged_on TEXT NOT NULL,               -- YYYY-MM-DD
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_day ON food_logs(logged_on);
    CREATE TABLE IF NOT EXISTS weights (
      id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT,
      kg REAL NOT NULL,
      measured_on TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,                  -- food_log | weight
      op TEXT NOT NULL,                      -- create | delete
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',-- pending | sending | failed
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // A crash mid-send leaves rows in 'sending'; replays are safe (Idempotency-Key + client UUID).
  await db.runAsync(`UPDATE sync_queue SET status='pending' WHERE status='sending'`);
  return db;
}

/** Called on logout and account deletion. */
export async function resetDb() {
  const db = await getDb();
  await db.execAsync('DELETE FROM food_logs; DELETE FROM weights; DELETE FROM sync_queue;');
}
