/**
 * All database reads/writes for the app, grouped by domain. Every function
 * takes the SQLiteDatabase from useSQLiteContext(). Row objects come back
 * snake_case from SQLite and are mapped to the camelCase domain types.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CostCategory,
  Expense,
  ExpenseCategory,
  Loan,
  Project,
  Property,
  PropertyCost,
  Receipt,
  ReceiptItem,
  RoomArea,
  RoomPhoto,
} from './types';

/* ------------------------------ row mapping ------------------------------ */

type Row = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? '' : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v));
const nOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const sOrNull = (v: unknown): string | null => (v == null ? null : String(v));

function mapProperty(r: Row): Property {
  return {
    id: n(r.id),
    name: s(r.name),
    address: s(r.address),
    city: s(r.city),
    state: s(r.state),
    zip: s(r.zip),
    latitude: nOrNull(r.latitude),
    longitude: nOrNull(r.longitude),
    propertyType: s(r.property_type) as Property['propertyType'],
    status: s(r.status) as Property['status'],
    bedrooms: nOrNull(r.bedrooms),
    bathrooms: nOrNull(r.bathrooms),
    squareFeet: nOrNull(r.square_feet),
    lotSize: s(r.lot_size),
    yearBuilt: nOrNull(r.year_built),
    purchasePriceCents: n(r.purchase_price_cents),
    purchaseDate: s(r.purchase_date),
    budgetCents: n(r.budget_cents),
    notes: s(r.notes),
    coverPhotoUri: sOrNull(r.cover_photo_uri),
    createdAt: s(r.created_at),
  };
}

function mapProject(r: Row): Project {
  return {
    id: n(r.id),
    propertyId: n(r.property_id),
    name: s(r.name),
    description: s(r.description),
    status: s(r.status) as Project['status'],
    budgetCents: n(r.budget_cents),
    startDate: s(r.start_date),
    endDate: s(r.end_date),
    createdAt: s(r.created_at),
  };
}

function mapRoom(r: Row): RoomArea {
  return {
    id: n(r.id),
    propertyId: n(r.property_id),
    name: s(r.name),
    roomType: s(r.room_type) as RoomArea['roomType'],
    notes: s(r.notes),
    createdAt: s(r.created_at),
  };
}

function mapExpense(r: Row): Expense {
  return {
    id: n(r.id),
    propertyId: n(r.property_id),
    projectId: nOrNull(r.project_id),
    roomId: nOrNull(r.room_id),
    receiptId: nOrNull(r.receipt_id),
    description: s(r.description),
    category: s(r.category) as Expense['category'],
    vendor: s(r.vendor),
    amountCents: n(r.amount_cents),
    expenseDate: s(r.expense_date),
    notes: s(r.notes),
    createdAt: s(r.created_at),
  };
}

function mapCost(r: Row): PropertyCost {
  return {
    id: n(r.id),
    propertyId: n(r.property_id),
    category: s(r.category) as PropertyCost['category'],
    description: s(r.description),
    amountCents: n(r.amount_cents),
    costDate: s(r.cost_date),
    recurrence: s(r.recurrence) as PropertyCost['recurrence'],
    notes: s(r.notes),
    createdAt: s(r.created_at),
  };
}

function mapLoan(r: Row): Loan {
  return {
    id: n(r.id),
    propertyId: n(r.property_id),
    lender: s(r.lender),
    principalCents: n(r.principal_cents),
    interestRatePct: n(r.interest_rate_pct),
    termMonths: nOrNull(r.term_months),
    monthlyPaymentCents: n(r.monthly_payment_cents),
    startDate: s(r.start_date),
    notes: s(r.notes),
    createdAt: s(r.created_at),
  };
}

function mapReceipt(r: Row): Receipt {
  return {
    id: n(r.id),
    propertyId: nOrNull(r.property_id),
    projectId: nOrNull(r.project_id),
    imageUri: sOrNull(r.image_uri),
    vendor: s(r.vendor),
    receiptDate: s(r.receipt_date),
    totalCents: n(r.total_cents),
    subtotalCents: n(r.subtotal_cents),
    taxCents: n(r.tax_cents),
    ocrText: s(r.ocr_text),
    status: s(r.status) as Receipt['status'],
    createdAt: s(r.created_at),
  };
}

function mapReceiptItem(r: Row): ReceiptItem {
  return {
    id: n(r.id),
    receiptId: n(r.receipt_id),
    description: s(r.description),
    quantity: n(r.quantity),
    amountCents: n(r.amount_cents),
    taxCents: n(r.tax_cents),
    projectId: nOrNull(r.project_id),
    roomId: nOrNull(r.room_id),
    expenseId: nOrNull(r.expense_id),
  };
}

function mapPhoto(r: Row): RoomPhoto {
  return {
    id: n(r.id),
    roomId: n(r.room_id),
    propertyId: n(r.property_id),
    imageUri: s(r.image_uri),
    kind: s(r.kind) as RoomPhoto['kind'],
    caption: s(r.caption),
    takenAt: s(r.taken_at),
  };
}

/* ------------------------------- properties ------------------------------ */

export type PropertyInput = Omit<Property, 'id' | 'createdAt'>;

export async function listProperties(db: SQLiteDatabase): Promise<Property[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM properties ORDER BY created_at DESC');
  return rows.map(mapProperty);
}

export async function getProperty(db: SQLiteDatabase, id: number): Promise<Property | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM properties WHERE id = ?', id);
  return row ? mapProperty(row) : null;
}

export async function insertProperty(db: SQLiteDatabase, p: PropertyInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO properties (name, address, city, state, zip, latitude, longitude, property_type, status,
       bedrooms, bathrooms, square_feet, lot_size, year_built, purchase_price_cents, purchase_date,
       budget_cents, notes, cover_photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.name, p.address, p.city, p.state, p.zip, p.latitude, p.longitude, p.propertyType, p.status,
    p.bedrooms, p.bathrooms, p.squareFeet, p.lotSize, p.yearBuilt, p.purchasePriceCents, p.purchaseDate,
    p.budgetCents, p.notes, p.coverPhotoUri
  );
  return res.lastInsertRowId;
}

export async function updateProperty(db: SQLiteDatabase, id: number, p: PropertyInput): Promise<void> {
  await db.runAsync(
    `UPDATE properties SET name = ?, address = ?, city = ?, state = ?, zip = ?, latitude = ?, longitude = ?,
       property_type = ?, status = ?, bedrooms = ?, bathrooms = ?, square_feet = ?, lot_size = ?,
       year_built = ?, purchase_price_cents = ?, purchase_date = ?, budget_cents = ?, notes = ?,
       cover_photo_uri = ?
     WHERE id = ?`,
    p.name, p.address, p.city, p.state, p.zip, p.latitude, p.longitude, p.propertyType, p.status,
    p.bedrooms, p.bathrooms, p.squareFeet, p.lotSize, p.yearBuilt, p.purchasePriceCents, p.purchaseDate,
    p.budgetCents, p.notes, p.coverPhotoUri, id
  );
}

export async function deleteProperty(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM properties WHERE id = ?', id);
}

/* -------------------------------- projects ------------------------------- */

export type ProjectInput = Omit<Project, 'id' | 'createdAt'>;

export async function listProjects(db: SQLiteDatabase, propertyId: number): Promise<Project[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM projects WHERE property_id = ? ORDER BY created_at DESC',
    propertyId
  );
  return rows.map(mapProject);
}

export async function listAllProjects(db: SQLiteDatabase): Promise<Project[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM projects ORDER BY created_at DESC');
  return rows.map(mapProject);
}

export async function getProject(db: SQLiteDatabase, id: number): Promise<Project | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM projects WHERE id = ?', id);
  return row ? mapProject(row) : null;
}

export async function insertProject(db: SQLiteDatabase, p: ProjectInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO projects (property_id, name, description, status, budget_cents, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    p.propertyId, p.name, p.description, p.status, p.budgetCents, p.startDate, p.endDate
  );
  return res.lastInsertRowId;
}

export async function updateProject(db: SQLiteDatabase, id: number, p: ProjectInput): Promise<void> {
  await db.runAsync(
    `UPDATE projects SET property_id = ?, name = ?, description = ?, status = ?, budget_cents = ?,
       start_date = ?, end_date = ? WHERE id = ?`,
    p.propertyId, p.name, p.description, p.status, p.budgetCents, p.startDate, p.endDate, id
  );
}

export async function deleteProject(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM projects WHERE id = ?', id);
}

/* --------------------------------- rooms --------------------------------- */

export type RoomInput = Omit<RoomArea, 'id' | 'createdAt'>;

export async function listRooms(db: SQLiteDatabase, propertyId: number): Promise<RoomArea[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM rooms WHERE property_id = ? ORDER BY name COLLATE NOCASE',
    propertyId
  );
  return rows.map(mapRoom);
}

export async function getRoom(db: SQLiteDatabase, id: number): Promise<RoomArea | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM rooms WHERE id = ?', id);
  return row ? mapRoom(row) : null;
}

export async function insertRoom(db: SQLiteDatabase, r: RoomInput): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO rooms (property_id, name, room_type, notes) VALUES (?, ?, ?, ?)',
    r.propertyId, r.name, r.roomType, r.notes
  );
  return res.lastInsertRowId;
}

export async function updateRoom(db: SQLiteDatabase, id: number, r: RoomInput): Promise<void> {
  await db.runAsync(
    'UPDATE rooms SET property_id = ?, name = ?, room_type = ?, notes = ? WHERE id = ?',
    r.propertyId, r.name, r.roomType, r.notes, id
  );
}

export async function deleteRoom(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}

/* -------------------------------- expenses ------------------------------- */

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

export async function listExpensesForProperty(db: SQLiteDatabase, propertyId: number): Promise<Expense[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM expenses WHERE property_id = ? ORDER BY expense_date DESC, id DESC',
    propertyId
  );
  return rows.map(mapExpense);
}

export async function listExpensesForProject(db: SQLiteDatabase, projectId: number): Promise<Expense[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC, id DESC',
    projectId
  );
  return rows.map(mapExpense);
}

export async function listExpensesForRoom(db: SQLiteDatabase, roomId: number): Promise<Expense[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM expenses WHERE room_id = ? ORDER BY expense_date DESC, id DESC',
    roomId
  );
  return rows.map(mapExpense);
}

export async function listRecentExpenses(db: SQLiteDatabase, limit: number): Promise<Expense[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT ?',
    limit
  );
  return rows.map(mapExpense);
}

export async function getExpense(db: SQLiteDatabase, id: number): Promise<Expense | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM expenses WHERE id = ?', id);
  return row ? mapExpense(row) : null;
}

export async function insertExpense(db: SQLiteDatabase, e: ExpenseInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO expenses (property_id, project_id, room_id, receipt_id, description, category, vendor,
       amount_cents, expense_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.propertyId, e.projectId, e.roomId, e.receiptId, e.description, e.category, e.vendor,
    e.amountCents, e.expenseDate, e.notes
  );
  return res.lastInsertRowId;
}

export async function updateExpense(db: SQLiteDatabase, id: number, e: ExpenseInput): Promise<void> {
  await db.runAsync(
    `UPDATE expenses SET property_id = ?, project_id = ?, room_id = ?, receipt_id = ?, description = ?,
       category = ?, vendor = ?, amount_cents = ?, expense_date = ?, notes = ? WHERE id = ?`,
    e.propertyId, e.projectId, e.roomId, e.receiptId, e.description, e.category, e.vendor,
    e.amountCents, e.expenseDate, e.notes, id
  );
}

export async function deleteExpense(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

/* ----------------------------- property costs ---------------------------- */

export type CostInput = Omit<PropertyCost, 'id' | 'createdAt'>;

export async function listCosts(db: SQLiteDatabase, propertyId: number): Promise<PropertyCost[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM property_costs WHERE property_id = ? ORDER BY cost_date DESC, id DESC',
    propertyId
  );
  return rows.map(mapCost);
}

export async function getCost(db: SQLiteDatabase, id: number): Promise<PropertyCost | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM property_costs WHERE id = ?', id);
  return row ? mapCost(row) : null;
}

export async function insertCost(db: SQLiteDatabase, c: CostInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO property_costs (property_id, category, description, amount_cents, cost_date, recurrence, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    c.propertyId, c.category, c.description, c.amountCents, c.costDate, c.recurrence, c.notes
  );
  return res.lastInsertRowId;
}

export async function updateCost(db: SQLiteDatabase, id: number, c: CostInput): Promise<void> {
  await db.runAsync(
    `UPDATE property_costs SET property_id = ?, category = ?, description = ?, amount_cents = ?,
       cost_date = ?, recurrence = ?, notes = ? WHERE id = ?`,
    c.propertyId, c.category, c.description, c.amountCents, c.costDate, c.recurrence, c.notes, id
  );
}

export async function deleteCost(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM property_costs WHERE id = ?', id);
}

/* ---------------------------------- loans -------------------------------- */

export type LoanInput = Omit<Loan, 'id' | 'createdAt'>;

export async function listLoans(db: SQLiteDatabase, propertyId: number): Promise<Loan[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM loans WHERE property_id = ? ORDER BY created_at DESC',
    propertyId
  );
  return rows.map(mapLoan);
}

export async function getLoan(db: SQLiteDatabase, id: number): Promise<Loan | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM loans WHERE id = ?', id);
  return row ? mapLoan(row) : null;
}

export async function insertLoan(db: SQLiteDatabase, l: LoanInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO loans (property_id, lender, principal_cents, interest_rate_pct, term_months,
       monthly_payment_cents, start_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    l.propertyId, l.lender, l.principalCents, l.interestRatePct, l.termMonths,
    l.monthlyPaymentCents, l.startDate, l.notes
  );
  return res.lastInsertRowId;
}

export async function updateLoan(db: SQLiteDatabase, id: number, l: LoanInput): Promise<void> {
  await db.runAsync(
    `UPDATE loans SET property_id = ?, lender = ?, principal_cents = ?, interest_rate_pct = ?,
       term_months = ?, monthly_payment_cents = ?, start_date = ?, notes = ? WHERE id = ?`,
    l.propertyId, l.lender, l.principalCents, l.interestRatePct, l.termMonths,
    l.monthlyPaymentCents, l.startDate, l.notes, id
  );
}

export async function deleteLoan(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM loans WHERE id = ?', id);
}

/* -------------------------------- receipts ------------------------------- */

export interface ReceiptDraftItem {
  description: string;
  quantity: number;
  amountCents: number;
}

/** A reviewed line item ready to become an expense. */
export interface ReceiptFinalItem {
  description: string;
  quantity: number;
  amountCents: number;
  taxCents: number;
  projectId: number | null;
  roomId: number | null;
}

export async function listReceiptsForProperty(db: SQLiteDatabase, propertyId: number): Promise<Receipt[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM receipts WHERE property_id = ? ORDER BY created_at DESC',
    propertyId
  );
  return rows.map(mapReceipt);
}

export async function listPendingReceipts(db: SQLiteDatabase): Promise<Receipt[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM receipts WHERE status = 'pending' ORDER BY created_at DESC"
  );
  return rows.map(mapReceipt);
}

export async function getReceipt(db: SQLiteDatabase, id: number): Promise<Receipt | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM receipts WHERE id = ?', id);
  return row ? mapReceipt(row) : null;
}

export async function listReceiptItems(db: SQLiteDatabase, receiptId: number): Promise<ReceiptItem[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id',
    receiptId
  );
  return rows.map(mapReceiptItem);
}

export async function insertReceiptDraft(
  db: SQLiteDatabase,
  draft: {
    imageUri: string | null;
    vendor: string;
    receiptDate: string;
    totalCents: number;
    subtotalCents: number;
    taxCents: number;
    ocrText: string;
    items: ReceiptDraftItem[];
  }
): Promise<number> {
  let receiptId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO receipts (image_uri, vendor, receipt_date, total_cents, subtotal_cents, tax_cents, ocr_text, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      draft.imageUri, draft.vendor, draft.receiptDate, draft.totalCents, draft.subtotalCents,
      draft.taxCents, draft.ocrText
    );
    receiptId = res.lastInsertRowId;
    for (const item of draft.items) {
      await db.runAsync(
        'INSERT INTO receipt_items (receipt_id, description, quantity, amount_cents) VALUES (?, ?, ?, ?)',
        receiptId, item.description, item.quantity, item.amountCents
      );
    }
  });
  return receiptId;
}

/**
 * Finalize a reviewed receipt: update its header, replace its items, create
 * one expense per item, and mark the receipt processed — atomically.
 *
 * Each item may point at its own project/room (split receipts); the expense
 * amount includes the item's allocated share of sales tax so property and
 * project totals reflect real money spent.
 */
export async function processReceipt(
  db: SQLiteDatabase,
  receiptId: number,
  header: {
    propertyId: number;
    projectId: number | null; // receipt-level default (whole-receipt mode)
    vendor: string;
    receiptDate: string;
    totalCents: number;
    subtotalCents: number;
    taxCents: number;
    category: ExpenseCategory;
  },
  items: ReceiptFinalItem[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE receipts SET property_id = ?, project_id = ?, vendor = ?, receipt_date = ?, total_cents = ?,
         subtotal_cents = ?, tax_cents = ?, status = 'processed' WHERE id = ?`,
      header.propertyId, header.projectId, header.vendor, header.receiptDate, header.totalCents,
      header.subtotalCents, header.taxCents, receiptId
    );
    await db.runAsync('DELETE FROM receipt_items WHERE receipt_id = ?', receiptId);
    for (const item of items) {
      const notes = item.taxCents !== 0 ? `Includes ${centsLabel(item.taxCents)} sales tax` : '';
      const expenseRes = await db.runAsync(
        `INSERT INTO expenses (property_id, project_id, room_id, receipt_id, description, category, vendor,
           amount_cents, expense_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        header.propertyId, item.projectId, item.roomId, receiptId, item.description, header.category,
        header.vendor, item.amountCents + item.taxCents, header.receiptDate, notes
      );
      await db.runAsync(
        `INSERT INTO receipt_items (receipt_id, description, quantity, amount_cents, tax_cents, project_id, room_id, expense_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        receiptId, item.description, item.quantity, item.amountCents, item.taxCents,
        item.projectId, item.roomId, expenseRes.lastInsertRowId
      );
    }
  });
}

function centsLabel(cents: number): string {
  const abs = Math.abs(cents);
  return `$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export async function deleteReceipt(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM receipts WHERE id = ?', id);
}

/* --------------------------------- photos -------------------------------- */

export async function listPhotosForRoom(db: SQLiteDatabase, roomId: number): Promise<RoomPhoto[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM room_photos WHERE room_id = ? ORDER BY taken_at DESC, id DESC',
    roomId
  );
  return rows.map(mapPhoto);
}

export async function countPhotosByRoom(db: SQLiteDatabase, propertyId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ room_id: number; cnt: number }>(
    'SELECT room_id, COUNT(*) AS cnt FROM room_photos WHERE property_id = ? GROUP BY room_id',
    propertyId
  );
  return new Map(rows.map((r) => [Number(r.room_id), Number(r.cnt)]));
}

export async function insertPhoto(
  db: SQLiteDatabase,
  p: Omit<RoomPhoto, 'id' | 'takenAt'>
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO room_photos (room_id, property_id, image_uri, kind, caption) VALUES (?, ?, ?, ?, ?)',
    p.roomId, p.propertyId, p.imageUri, p.kind, p.caption
  );
  return res.lastInsertRowId;
}

export async function updatePhoto(
  db: SQLiteDatabase,
  id: number,
  fields: { kind: RoomPhoto['kind']; caption: string }
): Promise<void> {
  await db.runAsync('UPDATE room_photos SET kind = ?, caption = ? WHERE id = ?', fields.kind, fields.caption, id);
}

export async function deletePhoto(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM room_photos WHERE id = ?', id);
}

/* ------------------------------- aggregates ------------------------------ */

export interface PropertyFinancials {
  propertyId: number;
  expensesCents: number;
  costsCents: number;
}

/** Renovation expenses + carrying costs per property, one round trip each. */
export async function getFinancialsByProperty(db: SQLiteDatabase): Promise<Map<number, PropertyFinancials>> {
  const expenseRows = await db.getAllAsync<{ property_id: number; total: number }>(
    'SELECT property_id, SUM(amount_cents) AS total FROM expenses GROUP BY property_id'
  );
  const costRows = await db.getAllAsync<{ property_id: number; total: number }>(
    'SELECT property_id, SUM(amount_cents) AS total FROM property_costs GROUP BY property_id'
  );
  const map = new Map<number, PropertyFinancials>();
  const entry = (id: number) => {
    let e = map.get(id);
    if (!e) {
      e = { propertyId: id, expensesCents: 0, costsCents: 0 };
      map.set(id, e);
    }
    return e;
  };
  for (const r of expenseRows) entry(Number(r.property_id)).expensesCents = Number(r.total ?? 0);
  for (const r of costRows) entry(Number(r.property_id)).costsCents = Number(r.total ?? 0);
  return map;
}

export interface CategoryTotal {
  key: string;
  totalCents: number;
}

export async function expenseTotalsByCategory(
  db: SQLiteDatabase,
  propertyId?: number
): Promise<CategoryTotal[]> {
  const rows = propertyId
    ? await db.getAllAsync<{ category: string; total: number }>(
        'SELECT category, SUM(amount_cents) AS total FROM expenses WHERE property_id = ? GROUP BY category ORDER BY total DESC',
        propertyId
      )
    : await db.getAllAsync<{ category: string; total: number }>(
        'SELECT category, SUM(amount_cents) AS total FROM expenses GROUP BY category ORDER BY total DESC'
      );
  return rows.map((r) => ({ key: String(r.category), totalCents: Number(r.total ?? 0) }));
}

export async function costTotalsByCategory(
  db: SQLiteDatabase,
  propertyId?: number
): Promise<CategoryTotal[]> {
  const rows = propertyId
    ? await db.getAllAsync<{ category: string; total: number }>(
        'SELECT category, SUM(amount_cents) AS total FROM property_costs WHERE property_id = ? GROUP BY category ORDER BY total DESC',
        propertyId
      )
    : await db.getAllAsync<{ category: string; total: number }>(
        'SELECT category, SUM(amount_cents) AS total FROM property_costs GROUP BY category ORDER BY total DESC'
      );
  return rows.map((r) => ({ key: String(r.category), totalCents: Number(r.total ?? 0) }));
}

export async function expenseTotalForProject(db: SQLiteDatabase, projectId: number): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT SUM(amount_cents) AS total FROM expenses WHERE project_id = ?',
    projectId
  );
  return Number(row?.total ?? 0);
}

export async function expenseTotalsByRoom(db: SQLiteDatabase, propertyId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ room_id: number; total: number }>(
    'SELECT room_id, SUM(amount_cents) AS total FROM expenses WHERE property_id = ? AND room_id IS NOT NULL GROUP BY room_id',
    propertyId
  );
  return new Map(rows.map((r) => [Number(r.room_id), Number(r.total ?? 0)]));
}

export async function expenseTotalsByProject(db: SQLiteDatabase, propertyId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ project_id: number; total: number }>(
    'SELECT project_id, SUM(amount_cents) AS total FROM expenses WHERE property_id = ? AND project_id IS NOT NULL GROUP BY project_id',
    propertyId
  );
  return new Map(rows.map((r) => [Number(r.project_id), Number(r.total ?? 0)]));
}

export interface MonthlySpend {
  month: string; // YYYY-MM
  totalCents: number;
}

export async function monthlySpend(db: SQLiteDatabase, months: number): Promise<MonthlySpend[]> {
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    `SELECT substr(expense_date, 1, 7) AS month, SUM(amount_cents) AS total
     FROM expenses WHERE length(expense_date) >= 7
     GROUP BY month ORDER BY month DESC LIMIT ?`,
    months
  );
  return rows
    .map((r) => ({ month: String(r.month), totalCents: Number(r.total ?? 0) }))
    .reverse();
}
