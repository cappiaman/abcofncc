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
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_COMPANIES: Company[] = [
  {
    id: '0e316086-dad1-47e0-af2c-d990315bdb14',
    name: 'Ulpala Solution Pvt Ltd',
    code: 'CO1',
    google_sheet_id: '1hqdEGXo2GcsJrB49z_DKivLayQUzqq3x8hOzw8tc9Fk',
    sheet_tab_name: 'Sheet1',
    google_drive_folder_id: '',
    is_active: true,
  },
  {
    id: '1cd41612-1f8b-403d-8335-0e08cff291c6',
    name: 'Savana Force LLP',
    code: 'CO2',
    google_sheet_id: '1VfqrI_tfr-FYQa4TGOcSHAG1BstIxY1H61bu-3i-p4Q',
    sheet_tab_name: 'Sheet1',
    google_drive_folder_id: '',
    is_active: true,
  },
];

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'planned';

export interface Project {
  id: string;
  name: string;
  code?: string;
  company_id?: string;
  client_name?: string;
  description?: string;
  project_value?: number; // Total approximate project cost/value in INR
  budget?: number;        // Expense budget in INR
  people_count?: number;  // Number of people involved
  people_involved?: string; // Names / roles of people utilized
  project_location?: string; // Place of project
  manufacturing_unit?: string; // Manufacturing unit utilized
  communication?: string;   // Communication details, POC, contacts
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
  company?: Company;
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
  project_id?: string;
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
  project?: Project;
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
  project_id?: string;
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
  project_id?: string;
  user_id?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  payment_type?: string;
  paid_from?: string;
  search?: string;
  sync_status?: string;
}
