// ==============================================================================
// APPLICATION TYPE DEFINITIONS
// ==============================================================================

export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'deactivated';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  code: string; // e.g., 'CO1', 'CO2'
  google_sheet_id: string;
  sheet_tab_name: string;
  google_drive_folder_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryType =
  | 'Metro'
  | 'Food & Tea'
  | 'Rickshaw / Auto / Cab'
  | 'Travel'
  | 'Petty Cash'
  | 'Office & Operations'
  | 'Supplies & Materials'
  | 'Client Entertainment'
  | 'Fuel / Vehicle'
  | 'Misc';

export const EXPENSE_CATEGORIES: CategoryType[] = [
  'Metro',
  'Food & Tea',
  'Rickshaw / Auto / Cab',
  'Travel',
  'Petty Cash',
  'Office & Operations',
  'Supplies & Materials',
  'Client Entertainment',
  'Fuel / Vehicle',
  'Misc',
];

export type PaymentMethod =
  | 'Paytm / UPI'
  | 'Bank Transfer'
  | 'Credit / Debit Card'
  | 'Cash'
  | 'Petty Cash';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Paytm / UPI',
  'Bank Transfer',
  'Credit / Debit Card',
  'Cash',
  'Petty Cash',
];

export type PaidFromSource =
  | 'Personal Account'
  | 'Personal Cash'
  | 'Company Petty Cash'
  | 'Company Account';

export const PAID_FROM_SOURCES: PaidFromSource[] = [
  'Personal Account',
  'Personal Cash',
  'Company Petty Cash',
  'Company Account',
];

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface Expense {
  id: string;
  receipt_code: string;
  company_id: string;
  user_id: string;
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // HH:MM:SS or HH:MM
  expense_timestamp: string;
  category: CategoryType;
  payment_type: PaymentMethod;
  paid_from: PaidFromSource;
  merchant_or_payee: string;
  description: string;
  payment_id: string;
  amount: number;
  receipt_image_path?: string;
  drive_file_id?: string;
  drive_file_url?: string;
  sync_status: SyncStatus;
  sync_error?: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
  user?: Profile;
}

export interface AIParseResult {
  amount: number | null;
  expense_date: string | null;
  expense_time: string | null;
  payment_type: string;
  payment_id: string;
  merchant_or_payee: string;
  description: string;
  suggested_category: string;
  confidence_score: number;
  low_confidence_fields: string[];
}

export interface ExpenseFormData {
  company_id: string;
  expense_date: string;
  expense_time: string;
  category: CategoryType;
  payment_type: PaymentMethod;
  paid_from: PaidFromSource;
  merchant_or_payee: string;
  description: string;
  payment_id: string;
  amount: string | number;
  receipt_image_path?: string;
}

export interface ExpenseFilter {
  company_id?: string;
  user_id?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  payment_type?: string;
  paid_from?: string;
  search?: string;
  sync_status?: string;
}
