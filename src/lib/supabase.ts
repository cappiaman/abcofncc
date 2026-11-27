// ==============================================================================
// SUPABASE CLIENT & CLOUD API HELPERS
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import { Expense, ExpenseFormData } from '../types';
import { generateFallbackReceiptCode } from './utils';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Upload receipt image to Supabase Storage bucket 'receipts'
 * Stored under {companyCode}/{receiptCode}.{ext}
 */
export async function uploadReceiptFile(
  file: File,
  folderPrefix = 'raw',
  receiptCode?: string
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanReceiptCode = receiptCode ? receiptCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : null;
  const fileName = cleanReceiptCode
    ? `${folderPrefix}/${cleanReceiptCode}.${fileExt}`
    : `${folderPrefix}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  return data.path;
}

/**
 * Get public or signed URL for a receipt image path
 */
export function getReceiptImageUrl(path: string | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Call parse-receipt Supabase Edge Function with an image
 */
export async function parseReceiptWithAI(file: File) {
  // If Edge function is deployed, call it directly
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || 'AI Receipt parsing failed');
  }

  return data;
}

/**
 * Generate unique receipt code using database procedure
 */
export async function getNextReceiptCode(companyCode: string, expenseDate: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_receipt_code', {
      p_company_code: companyCode,
      p_expense_date: expenseDate,
    });

    if (error || !data) {
      console.warn('RPC generate_receipt_code error, using fallback:', error);
      return generateFallbackReceiptCode(companyCode, expenseDate);
    }

    return data as string;
  } catch (err) {
    console.warn('Fallback receipt code generator used:', err);
    return generateFallbackReceiptCode(companyCode, expenseDate);
  }
}

/**
 * Trigger sync-expense Supabase Edge Function
 */
export async function triggerExpenseSync(expenseId: string, oldCompanyId?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('sync-expense', {
      body: { expense_id: expenseId, old_company_id: oldCompanyId },
    });

    if (error) {
      console.error('Edge function sync-expense error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Failed to trigger expense sync:', err);
    return { success: false, error: err.message };
  }
}
