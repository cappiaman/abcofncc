// ==============================================================================
// EXPENSE EDIT MODAL
// Allows updating expense fields and re-syncs to Google Sheets & Drive
// ==============================================================================

import React, { useState } from 'react';
import {
  Expense,
  Company,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAID_FROM_SOURCES,
  CategoryType,
  PaymentMethod,
  PaidFromSource,
} from '../../types';
import { supabase, triggerExpenseSync } from '../../lib/supabase';
import { X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface ExpenseModalProps {
  expense: Expense | null;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  expense,
  companies,
  onClose,
  onSaved,
}) => {
  if (!expense) return null;

  const [companyId, setCompanyId] = useState<string>(expense.company_id);
  const [amount, setAmount] = useState<string>(expense.amount.toString());
  const [expenseDate, setExpenseDate] = useState<string>(expense.expense_date);
  const [expenseTime, setExpenseTime] = useState<string>(
    expense.expense_time ? expense.expense_time.substring(0, 5) : '12:00'
  );
  const [category, setCategory] = useState<CategoryType>(expense.category);
  const [paymentType, setPaymentType] = useState<PaymentMethod>(expense.payment_type);
  const [paidFrom, setPaidFrom] = useState<PaidFromSource>(expense.paid_from);
  const [merchantOrPayee, setMerchantOrPayee] = useState<string>(expense.merchant_or_payee);
  const [description, setDescription] = useState<string>(expense.description);
  const [paymentId, setPaymentId] = useState<string>(expense.payment_id);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setIsSaving(true);
    const oldCompanyId = expense.company_id;

    try {
      const expenseTimestamp = `${expenseDate}T${expenseTime || '12:00'}:00Z`;

      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          company_id: companyId,
          amount: numAmount,
          expense_date: expenseDate,
          expense_time: expenseTime || '12:00:00',
          expense_timestamp: expenseTimestamp,
          category,
          payment_type: paymentType,
          paid_from: paidFrom,
          merchant_or_payee: merchantOrPayee.trim(),
          description: description.trim(),
          payment_id: paymentId.trim(),
          sync_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', expense.id);

      if (updateError) {
        throw updateError;
      }

      // Re-trigger live sync to Google Sheets (and handle company change if necessary)
      triggerExpenseSync(expense.id, oldCompanyId);

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update expense:', err);
      setErrorMsg(err.message || 'Error updating expense.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Edit Expense:</span>
              <span className="font-mono text-sky-400">{expense.receipt_code}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Updates will automatically sync to the matching Google Sheet row
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Company */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Company *
              </label>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) - {c.sheet_tab_name || 'Expenses'}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount (INR ₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 text-sm font-semibold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Time *
              </label>
              <input
                type="time"
                required
                value={expenseTime}
                onChange={(e) => setExpenseTime(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Type *
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Paid From */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Paid From *
              </label>
              <select
                value={paidFrom}
                onChange={(e) => setPaidFrom(e.target.value as PaidFromSource)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {PAID_FROM_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Merchant / Payee */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Merchant / Payee
              </label>
              <input
                type="text"
                value={merchantOrPayee}
                onChange={(e) => setMerchantOrPayee(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Payment ID / UTR */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment ID / UTR
              </label>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Description / Reason */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description / Reason *
              </label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="py-2.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving & Re-syncing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
