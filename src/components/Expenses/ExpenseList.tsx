// ==============================================================================
// EXPENSE LIST & HISTORY COMPONENT
// Features: Search, Multi-Filter, Mobile Cards, Desktop Table, Sync Badges, Retries
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Expense,
  Company,
  Project,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAID_FROM_SOURCES,
  DEFAULT_COMPANIES,
} from '../../types';
import { supabase, triggerExpenseSync, getReceiptImageUrl } from '../../lib/supabase';
import { formatINR, formatDate, formatTime12 } from '../../lib/utils';
import { ExpenseModal } from './ExpenseModal';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Building2,
  Calendar,
  X,
  CreditCard,
  Coins,
} from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  companies: Company[];
  projects?: Project[];
  onRefresh: () => void;
  selectedCompanyId?: string;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  companies,
  projects = [],
  onRefresh,
  selectedCompanyId,
}) => {
  const { user, isAdmin } = useAuth();
  const effectiveCompanies = companies && companies.length > 0 ? companies : DEFAULT_COMPANIES;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>(selectedCompanyId || '');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPaymentType, setFilterPaymentType] = useState<string>('');
  const [filterPaidFrom, setFilterPaidFrom] = useState<string>('');
  const [filterSyncStatus, setFilterSyncStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Sync Retry handler
  const handleRetrySync = async (expense: Expense) => {
    setRetryingId(expense.id);
    try {
      await triggerExpenseSync(expense.id);
      onRefresh();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setTimeout(() => setRetryingId(null), 800);
    }
  };

  // Delete Expense handler
  const handleDelete = async (expense: Expense) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete expense ${expense.receipt_code} (${formatINR(expense.amount)})?`
    );
    if (!confirmDelete) return;

    setIsDeletingId(expense.id);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    // Company
    const compFilter = filterCompany || selectedCompanyId;
    if (compFilter && exp.company_id !== compFilter) return false;

    // Search term (Receipt Code, Merchant, Description, Payment ID)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const codeMatch = exp.receipt_code.toLowerCase().includes(term);
      const merchantMatch = (exp.merchant_or_payee || '').toLowerCase().includes(term);
      const descMatch = exp.description.toLowerCase().includes(term);
      const paymentIdMatch = (exp.payment_id || '').toLowerCase().includes(term);
      if (!codeMatch && !merchantMatch && !descMatch && !paymentIdMatch) {
        return false;
      }
    }

    // Category
    if (filterCategory && exp.category !== filterCategory) return false;

    // Payment Type
    if (filterPaymentType && exp.payment_type !== filterPaymentType) return false;

    // Paid From
    if (filterPaidFrom && exp.paid_from !== filterPaidFrom) return false;

    // Sync Status
    if (filterSyncStatus && exp.sync_status !== filterSyncStatus) return false;

    // Date Range
    if (startDate && exp.expense_date < startDate) return false;
    if (endDate && exp.expense_date > endDate) return false;

    return true;
  });

  // Calculate filtered totals
  const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCompany('');
    setFilterCategory('');
    setFilterPaymentType('');
    setFilterPaidFrom('');
    setFilterSyncStatus('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    filterCompany ||
    filterCategory ||
    filterPaymentType ||
    filterPaidFrom ||
    filterSyncStatus ||
    startDate ||
    endDate
  );

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Search and Filters Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Receipt Code (e.g. CO1-20261127-001), Merchant, Description, or UTR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-3 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Company */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Company</label>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Payment Method</label>
            <select
              value={filterPaymentType}
              onChange={(e) => setFilterPaymentType(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Paid From */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Paid From</label>
            <select
              value={filterPaidFrom}
              onChange={(e) => setFilterPaidFrom(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Sources</option>
              {PAID_FROM_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Sync Status */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Sync Status</label>
            <select
              value={filterSyncStatus}
              onChange={(e) => setFilterSyncStatus(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Sync States</option>
              <option value="synced">Synced (Live)</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed / Retry</option>
            </select>
          </div>

          {/* Reset Filters button */}
          <div className="flex items-end">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Stats Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Showing <span className="font-semibold text-white">{filteredExpenses.length}</span>{' '}
              {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
            </span>
            <a
              href={`https://docs.google.com/spreadsheets/d/${(effectiveCompanies.find((c) => c.id === (filterCompany || selectedCompanyId)) || effectiveCompanies[0]).google_sheet_id}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Filtered:</span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {formatINR(totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Expenses Content: Mobile Cards + Desktop Table */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center mb-3">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No expenses found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search query or removing filters.'
              : 'Start logging daily expenses using the AI Scan or Cash tabs.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (hidden on lg screens) */}
          <div className="space-y-3 lg:hidden">
            {filteredExpenses.map((exp) => {
              const hasReceipt = Boolean(exp.receipt_image_path);
              const thumbUrl = getReceiptImageUrl(exp.receipt_image_path);
              const isOwner = user?.id === exp.user_id;
              const canEdit = isAdmin || isOwner;

              return (
                <div
                  key={exp.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3"
                >
                  {/* Top Bar: Code, Date & Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {exp.receipt_code}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {exp.company?.code || 'CO'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{formatDate(exp.expense_date)}</span>
                        <span>•</span>
                        <span>{formatTime12(exp.expense_time)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold text-emerald-400 font-mono">
                        {formatINR(exp.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        by {exp.user?.full_name || 'Member'}
                      </div>
                    </div>
                  </div>

                  {/* Description & Payee */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                    <div className="font-medium text-white">{exp.description}</div>
                    {exp.merchant_or_payee && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="text-slate-500">Payee:</span>
                        <span>{exp.merchant_or_payee}</span>
                      </div>
                    )}
                    {exp.payment_id && (
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        Ref/UTR: {exp.payment_id}
                      </div>
                    )}
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60">
                      {exp.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60">
                      {exp.payment_type}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60">
                      {exp.paid_from}
                    </span>
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Sync Status Badge */}
                    <div>
                      {exp.sync_status === 'synced' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Synced to Sheets
                        </span>
                      ) : exp.sync_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3 animate-spin" />
                          Sync Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRetrySync(exp)}
                          disabled={retryingId === exp.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                        >
                          <RotateCw
                            className={`w-3 h-3 ${retryingId === exp.id ? 'animate-spin' : ''}`}
                          />
                          Retry Sync
                        </button>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {hasReceipt && (
                        <button
                          onClick={() => setPreviewExpense(exp)}
                          className="p-1.5 rounded-lg bg-slate-800 text-sky-400 hover:bg-slate-700 transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={() => setEditingExpense(exp)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={() => handleDelete(exp)}
                          disabled={isDeletingId === exp.id}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (visible on lg screens) */}
          <div className="hidden lg:block bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Receipt Code</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Company</th>
                    <th className="py-3 px-3">Logged By</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Paid From</th>
                    <th className="py-3 px-4">Description / Payee</th>
                    <th className="py-3 px-4 text-right">Amount (INR)</th>
                    <th className="py-3 px-3 text-center">Receipt</th>
                    <th className="py-3 px-3 text-center">Live Sync</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredExpenses.map((exp) => {
                    const hasReceipt = Boolean(exp.receipt_image_path);
                    const isOwner = user?.id === exp.user_id;
                    const canEdit = isAdmin || isOwner;

                    return (
                      <tr
                        key={exp.id}
                        className="hover:bg-slate-800/40 transition-colors text-slate-200"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-sky-400 whitespace-nowrap">
                          {exp.receipt_code}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-medium text-white">{formatDate(exp.expense_date)}</div>
                          <div className="text-[10px] text-slate-500">
                            {formatTime12(exp.expense_time)}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-300">
                          {exp.company?.code || 'CO'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                          {exp.user?.full_name || 'Member'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {exp.payment_type}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {exp.paid_from}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-white truncate">{exp.description}</div>
                          {exp.merchant_or_payee && (
                            <div className="text-[11px] text-slate-400 truncate">
                              To: {exp.merchant_or_payee}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatINR(exp.amount)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {hasReceipt ? (
                            <button
                              onClick={() => setPreviewExpense(exp)}
                              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          ) : (
                            <span className="text-slate-500">Cash / No file</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {exp.sync_status === 'synced' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Synced
                            </span>
                          ) : exp.sync_status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3 animate-spin" />
                              Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRetrySync(exp)}
                              disabled={retryingId === exp.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                              title={exp.sync_error || 'Sync failed, click to retry'}
                            >
                              <RotateCw
                                className={`w-3 h-3 ${retryingId === exp.id ? 'animate-spin' : ''}`}
                              />
                              Retry
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => setEditingExpense(exp)}
                                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDelete(exp)}
                                disabled={isDeletingId === exp.id}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <ExpenseModal
        expense={editingExpense}
        companies={companies}
        projects={projects}
        onClose={() => setEditingExpense(null)}
        onSaved={onRefresh}
      />

      <ReceiptPreviewModal
        expense={previewExpense}
        onClose={() => setPreviewExpense(null)}
      />
    </div>
  );
};
