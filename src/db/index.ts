import * as SQLite from 'expo-sqlite';

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = () => (dbp ??= open());

async function open() {
  const db = await SQLite.openDatabaseAsync('fitness.db');

  // Step A1: Create tables without creating the logged_on index yet.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT,
      food_id TEXT,
      name TEXT NOT NULL,
      meal TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      kcal REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      logged_on TEXT NOT NULL DEFAULT '',
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weights (
      id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT,
      kg REAL NOT NULL,
      measured_on TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      op TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Step A2: Migrate existing databases that lack logged_on.
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(food_logs)`
  );

  if (!columns.some((column) => column.name === 'logged_on')) {
    await db.execAsync(`
      ALTER TABLE food_logs
      ADD COLUMN logged_on TEXT NOT NULL DEFAULT '';
    `);
  }

  // Step A3: Create the index only after ensuring the column exists.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_logs_day
    ON food_logs(logged_on);
  `);

  // Step B: Recover queue items left sending after an app crash.
  await db.runAsync(
    `UPDATE sync_queue SET status = 'pending' WHERE status = 'sending'`
  );

  return db;
}

/** Called on logout and account deletion. */
export async function resetDb() {
  const db = await getDb();

  await db.execAsync(`
    DELETE FROM food_logs;
    DELETE FROM weights;
    DELETE FROM sync_queue;
  `);
}
