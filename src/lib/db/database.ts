import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'renovation-tracker.db';

const SCHEMA_VERSION = 1;

/**
 * Runs on app start via <SQLiteProvider onInit={migrateDb}>. Versioned with
 * PRAGMA user_version so future releases can migrate existing devices.
 */
export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        zip TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        property_type TEXT NOT NULL DEFAULT 'single_family',
        status TEXT NOT NULL DEFAULT 'active',
        bedrooms REAL,
        bathrooms REAL,
        square_feet INTEGER,
        lot_size TEXT NOT NULL DEFAULT '',
        year_built INTEGER,
        purchase_price_cents INTEGER NOT NULL DEFAULT 0,
        purchase_date TEXT NOT NULL DEFAULT '',
        budget_cents INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        cover_photo_uri TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planned',
        budget_cents INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        room_type TEXT NOT NULL DEFAULT 'other',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        image_uri TEXT,
        vendor TEXT NOT NULL DEFAULT '',
        receipt_date TEXT NOT NULL DEFAULT '',
        total_cents INTEGER NOT NULL DEFAULT 0,
        ocr_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
        receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'materials',
        vendor TEXT NOT NULL DEFAULT '',
        amount_cents INTEGER NOT NULL DEFAULT 0,
        expense_date TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS property_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'other',
        description TEXT NOT NULL DEFAULT '',
        amount_cents INTEGER NOT NULL DEFAULT 0,
        cost_date TEXT NOT NULL DEFAULT '',
        recurrence TEXT NOT NULL DEFAULT 'one_time',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        lender TEXT NOT NULL,
        principal_cents INTEGER NOT NULL DEFAULT 0,
        interest_rate_pct REAL NOT NULL DEFAULT 0,
        term_months INTEGER,
        monthly_payment_cents INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS room_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        image_uri TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'before',
        caption TEXT NOT NULL DEFAULT '',
        taken_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_room ON expenses(room_id);
      CREATE INDEX IF NOT EXISTS idx_costs_property ON property_costs(property_id);
      CREATE INDEX IF NOT EXISTS idx_loans_property ON loans(property_id);
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
      CREATE INDEX IF NOT EXISTS idx_room_photos_room ON room_photos(room_id);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
