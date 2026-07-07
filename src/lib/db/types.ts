/**
 * Domain types shared across the app. All monetary amounts are stored as
 * integer cents to avoid floating point drift; dates are ISO `YYYY-MM-DD`
 * strings so SQLite can sort/group them lexicographically.
 */

export type PropertyStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'sold';
export type PropertyType = 'single_family' | 'multi_family' | 'condo' | 'townhouse' | 'land' | 'commercial' | 'other';
export type ProjectStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed';
export type ExpenseCategory = 'materials' | 'labor' | 'permits' | 'tools' | 'disposal' | 'delivery' | 'other';
export type CostCategory =
  | 'loan_payment'
  | 'interest'
  | 'insurance'
  | 'property_tax'
  | 'utilities'
  | 'hoa'
  | 'closing_costs'
  | 'inspection'
  | 'other';
export type CostRecurrence = 'one_time' | 'monthly' | 'quarterly' | 'annual';
export type RoomType =
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living_room'
  | 'dining_room'
  | 'basement'
  | 'attic'
  | 'garage'
  | 'laundry'
  | 'office'
  | 'hallway'
  | 'exterior'
  | 'yard'
  | 'other';
export type PhotoKind = 'before' | 'after' | 'progress';
export type ReceiptStatus = 'pending' | 'processed';

export interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  propertyType: PropertyType;
  status: PropertyStatus;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: string;
  yearBuilt: number | null;
  purchasePriceCents: number;
  purchaseDate: string;
  budgetCents: number;
  notes: string;
  coverPhotoUri: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  propertyId: number;
  name: string;
  description: string;
  status: ProjectStatus;
  budgetCents: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface RoomArea {
  id: number;
  propertyId: number;
  name: string;
  roomType: RoomType;
  notes: string;
  createdAt: string;
}

export interface Expense {
  id: number;
  propertyId: number;
  projectId: number | null;
  roomId: number | null;
  receiptId: number | null;
  description: string;
  category: ExpenseCategory;
  vendor: string;
  amountCents: number;
  expenseDate: string;
  notes: string;
  createdAt: string;
}

export interface PropertyCost {
  id: number;
  propertyId: number;
  category: CostCategory;
  description: string;
  amountCents: number;
  costDate: string;
  recurrence: CostRecurrence;
  notes: string;
  createdAt: string;
}

export interface Loan {
  id: number;
  propertyId: number;
  lender: string;
  principalCents: number;
  interestRatePct: number;
  termMonths: number | null;
  monthlyPaymentCents: number;
  startDate: string;
  notes: string;
  createdAt: string;
}

export interface Receipt {
  id: number;
  propertyId: number | null;
  projectId: number | null;
  imageUri: string | null;
  vendor: string;
  receiptDate: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  ocrText: string;
  status: ReceiptStatus;
  createdAt: string;
}

export interface ReceiptItem {
  id: number;
  receiptId: number;
  description: string;
  quantity: number;
  amountCents: number;
  taxCents: number;
  projectId: number | null;
  roomId: number | null;
  expenseId: number | null;
}

export interface RoomPhoto {
  id: number;
  roomId: number;
  propertyId: number;
  imageUri: string;
  kind: PhotoKind;
  caption: string;
  takenAt: string;
}

/* ---- Display labels ---- */

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  sold: 'Sold',
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: 'Single family',
  multi_family: 'Multi family',
  condo: 'Condo',
  townhouse: 'Townhouse',
  land: 'Land',
  commercial: 'Commercial',
  other: 'Other',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materials: 'Materials',
  labor: 'Labor',
  permits: 'Permits',
  tools: 'Tools',
  disposal: 'Disposal',
  delivery: 'Delivery',
  other: 'Other',
};

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  loan_payment: 'Loan payment',
  interest: 'Interest',
  insurance: 'Insurance',
  property_tax: 'Property tax',
  utilities: 'Utilities',
  hoa: 'HOA',
  closing_costs: 'Closing costs',
  inspection: 'Inspection',
  other: 'Other',
};

export const COST_RECURRENCE_LABELS: Record<CostRecurrence, string> = {
  one_time: 'One time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  bedroom: 'Bedroom',
  living_room: 'Living room',
  dining_room: 'Dining room',
  basement: 'Basement',
  attic: 'Attic',
  garage: 'Garage',
  laundry: 'Laundry',
  office: 'Office',
  hallway: 'Hallway',
  exterior: 'Exterior',
  yard: 'Yard',
  other: 'Other',
};

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
};

export function labelValues<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
