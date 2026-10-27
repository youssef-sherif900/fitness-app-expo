import * as SQLite from 'expo-sqlite';

const DB_NAME = 'fitness.db';

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Lazily open and migrate the local database. A failed open must not be cached:
 * the next access retries (and the schema repair runs again) instead of leaving
 * the whole app stuck with a rejected promise until it is restarted.
 */
export const getDb = () => {
  if (!dbp) {
    dbp = open().catch((error) => {
      dbp = null;
      throw error;
    });
  }
  return dbp;
};

type Column = { name: string; ddl: string };

type Table = {
  name: string;
  columns: Column[];
  create: string;
  /** `drop` for ephemeral tables whose rows cannot be migrated. */
  rebuild: 'preserve' | 'drop';
  /** sync_queue uses an INTEGER AUTOINCREMENT primary key. */
  integerId?: boolean;
};

// Step A1: the canonical schema. Column defaults keep ALTER TABLE migrations simple.
const FOOD_LOGS: Table = {
  name: 'food_logs',
  rebuild: 'preserve',
  create: `CREATE TABLE IF NOT EXISTS food_logs (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT,
    food_id TEXT,
    serving_id TEXT,
    serving_label TEXT,
    name TEXT NOT NULL DEFAULT 'Food',
    meal TEXT NOT NULL DEFAULT 'snack',
    quantity REAL NOT NULL DEFAULT 1,
    kcal REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    logged_on TEXT NOT NULL DEFAULT '',
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );`,
  columns: [
    { name: 'id', ddl: 'id TEXT PRIMARY KEY NOT NULL' },
    { name: 'server_id', ddl: 'server_id TEXT' },
    { name: 'food_id', ddl: 'food_id TEXT' },
    { name: 'serving_id', ddl: 'serving_id TEXT' },
    { name: 'serving_label', ddl: 'serving_label TEXT' },
    { name: 'name', ddl: "name TEXT NOT NULL DEFAULT 'Food'" },
    { name: 'meal', ddl: "meal TEXT NOT NULL DEFAULT 'snack'" },
    { name: 'quantity', ddl: 'quantity REAL NOT NULL DEFAULT 1' },
    { name: 'kcal', ddl: 'kcal REAL NOT NULL DEFAULT 0' },
    { name: 'protein', ddl: 'protein REAL NOT NULL DEFAULT 0' },
    { name: 'carbs', ddl: 'carbs REAL NOT NULL DEFAULT 0' },
    { name: 'fat', ddl: 'fat REAL NOT NULL DEFAULT 0' },
    { name: 'logged_on', ddl: "logged_on TEXT NOT NULL DEFAULT ''" },
    { name: 'deleted', ddl: 'deleted INTEGER NOT NULL DEFAULT 0' },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT ''" },
  ],
};

const WEIGHTS: Table = {
  name: 'weights',
  rebuild: 'preserve',
  create: `CREATE TABLE IF NOT EXISTS weights (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT,
    kg REAL NOT NULL DEFAULT 0,
    measured_on TEXT NOT NULL DEFAULT '',
    deleted INTEGER NOT NULL DEFAULT 0
  );`,
  columns: [
    { name: 'id', ddl: 'id TEXT PRIMARY KEY NOT NULL' },
    { name: 'server_id', ddl: 'server_id TEXT' },
    { name: 'kg', ddl: 'kg REAL NOT NULL DEFAULT 0' },
    { name: 'measured_on', ddl: "measured_on TEXT NOT NULL DEFAULT ''" },
    { name: 'deleted', ddl: 'deleted INTEGER NOT NULL DEFAULT 0' },
  ],
};

const SYNC_QUEUE: Table = {
  name: 'sync_queue',
  rebuild: 'drop',
  integerId: true,
  create: `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL DEFAULT '',
    op TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );`,
  columns: [
    { name: 'id', ddl: 'id INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'entity', ddl: "entity TEXT NOT NULL DEFAULT ''" },
    { name: 'op', ddl: "op TEXT NOT NULL DEFAULT ''" },
    { name: 'entity_id', ddl: "entity_id TEXT NOT NULL DEFAULT ''" },
    { name: 'payload', ddl: "payload TEXT NOT NULL DEFAULT '{}'" },
    { name: 'status', ddl: "status TEXT NOT NULL DEFAULT 'pending'" },
    { name: 'attempts', ddl: 'attempts INTEGER NOT NULL DEFAULT 0' },
    { name: 'last_error', ddl: 'last_error TEXT' },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT ''" },
  ],
};

type PragmaColumn = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

async function tableInfo(db: SQLite.SQLiteDatabase, table: string): Promise<PragmaColumn[]> {
  return db.getAllAsync<PragmaColumn>(`PRAGMA table_info(${table})`);
}

/**
 * Step A2: repair legacy databases. Older builds created `food_logs` without some
 * of today's columns (for example `food_id`), and `CREATE TABLE IF NOT EXISTS`
 * silently keeps that old shape, which breaks every read and write. Add missing
 * columns, and rebuild the table when the primary key or a legacy NOT NULL column
 * makes the old shape unusable.
 */
async function reconcile(db: SQLite.SQLiteDatabase, table: Table): Promise<void> {
  const info = await tableInfo(db, table.name);

  if (info.length === 0) {
    await db.execAsync(table.create);
    return;
  }

  const expected = new Set(table.columns.map((c) => c.name));
  const idColumn = info.find((c) => c.name === 'id');
  const idIsUsable = table.integerId
    ? !!idColumn && /int/i.test(idColumn.type) && idColumn.pk === 1
    : !!idColumn && idColumn.pk === 1 && !/int/i.test(idColumn.type);

  // A legacy column that is NOT NULL without a default would reject every insert.
  const blockingColumn = info.some(
    (c) => c.notnull === 1 && c.dflt_value === null && c.pk === 0 && !expected.has(c.name),
  );

  if (!idIsUsable || blockingColumn) {
    await rebuild(db, table, info);
    return;
  }

  for (const column of table.columns) {
    if (!info.some((c) => c.name === column.name)) {
      await db.execAsync(`ALTER TABLE ${table.name} ADD COLUMN ${column.ddl};`);
    }
  }
}

/** Replace an unusable table, copying whatever columns still line up. */
async function rebuild(db: SQLite.SQLiteDatabase, table: Table, info: PragmaColumn[]): Promise<void> {
  const existing = new Set(info.map((c) => c.name));

  if (table.rebuild === 'drop') {
    await db.execAsync(`DROP TABLE ${table.name};`);
    await db.execAsync(table.create);
    return;
  }

  const legacy = `${table.name}_legacy`;
  await db.execAsync(`DROP TABLE IF EXISTS ${legacy};`);
  await db.execAsync(`ALTER TABLE ${table.name} RENAME TO ${legacy};`);
  await db.execAsync(table.create);

  const kept = table.columns
    .map((c) => c.name)
    .filter((name) => name !== 'id' && existing.has(name));

  if (kept.length > 0 || existing.has('id')) {
    // Keep the existing client UUID when there is one (queued sync items reference it);
    // generate fresh IDs only when the old table had no id column at all.
    const hasId = existing.has('id');
    const columns = ['id', ...kept].join(', ');
    const values = [hasId ? 'id' : 'lower(hex(randomblob(16)))', ...kept].join(', ');
    await db.execAsync(`INSERT INTO ${table.name} (${columns}) SELECT ${values} FROM ${legacy};`);
  }

  await db.execAsync(`DROP TABLE ${legacy};`);
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL;');
  await reconcile(db, FOOD_LOGS);
  await reconcile(db, WEIGHTS);
  await reconcile(db, SYNC_QUEUE);

  // Step A3: the indexes can only be created once every column exists.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_logs_day ON food_logs(logged_on);
    CREATE INDEX IF NOT EXISTS idx_logs_food ON food_logs(food_id);
    CREATE INDEX IF NOT EXISTS idx_weights_day ON weights(measured_on);
  `);

  // Step B: recover queue items left sending after an app crash.
  await db.runAsync(`UPDATE sync_queue SET status = 'pending' WHERE status = 'sending'`);

  return db;
}

async function closeDb() {
  const pending = dbp;
  dbp = null;
  if (!pending) return;
  try {
    const db = await pending;
    await db.closeAsync();
  } catch {
    // The handle was never opened (or is already closed): nothing to close.
  }
}

/**
 * Called on logout and account deletion. Removing the file is both faster and
 * safer than deleting rows, and it also discards any half-migrated schema.
 */
export async function resetDb() {
  await closeDb();
  await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {});
}

/** Settings escape hatch: recreate the local schema, then re-pull from the server. */
export async function resetLocalDatabase() {
  await resetDb();
  await getDb();
}
