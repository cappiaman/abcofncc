// ==============================================================================
// SUMMARY & ANALYTICS DASHBOARD
// Personal Reimbursement Tracker, Company Breakdown, Cash vs Digital, Category Bars
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { Expense, Company, Profile } from '../../types';
import { formatINR } from '../../lib/utils';
import {
  TrendingUp,
  Building2,
  Users,
  Coins,
  CreditCard,
  Calendar,
  Download,
  Filter,
  PieChart,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';

interface SummaryDashboardProps {
  expenses: Expense[];
  companies: Company[];
  selectedCompanyId?: string;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  expenses,
  companies,
  selectedCompanyId,
}) => {
  // Period filter: 'this-month' | 'last-month' | 'all' | 'custom'
  const [period, setPeriod] = useState<'this-month' | 'last-month' | 'all' | 'custom'>('this-month');
  const [companyFilter, setCompanyFilter] = useState<string>(selectedCompanyId || '');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Date filtering logic
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based

  const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const nextMonthStart = new Date(currentYear, currentMonth + 1, 1);
  const thisMonthEnd = new Date(nextMonthStart.getTime() - 1)
    .toISOString()
    .substring(0, 10);

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const lastMonthEnd = new Date(new Date(currentYear, currentMonth, 1).getTime() - 1)
    .toISOString()
    .substring(0, 10);

  // Filtered dataset
  const filtered = useMemo(() => {
    return expenses.filter((exp) => {
      // Company filter
      const comp = companyFilter || selectedCompanyId;
      if (comp && exp.company_id !== comp) return false;

      // Period filter
      if (period === 'this-month') {
        if (exp.expense_date < thisMonthStart || exp.expense_date > thisMonthEnd) return false;
      } else if (period === 'last-month') {
        if (exp.expense_date < lastMonthStart || exp.expense_date > lastMonthEnd) return false;
      } else if (period === 'custom') {
        if (customStart && exp.expense_date < customStart) return false;
        if (customEnd && exp.expense_date > customEnd) return false;
      }
      return true;
    });
  }, [expenses, companyFilter, selectedCompanyId, period, customStart, customEnd, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd]);

  // Overall Total
  const totalAmount = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [filtered]);

  // Breakdown by Company
  const companyBreakdown = useMemo(() => {
    const map: Record<string, { name: string; code: string; total: number; count: number }> = {};

    companies.forEach((c) => {
      map[c.id] = { name: c.name, code: c.code, total: 0, count: 0 };
    });

    filtered.forEach((exp) => {
      const cId = exp.company_id;
      if (!map[cId]) {
        map[cId] = {
          name: exp.company?.name || 'Unknown',
          code: exp.company?.code || 'CO',
          total: 0,
          count: 0,
        };
      }
      map[cId].total += Number(exp.amount);
      map[cId].count += 1;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered, companies]);

  // Personal Reimbursement Breakdown by User
  // (Expenses paid from 'Personal Account' or 'Personal Cash' that the company owes back)
  const userReimbursements = useMemo(() => {
    const map: Record<string, { name: string; email: string; personalTotal: number; companyPaidTotal: number; count: number }> = {};

    filtered.forEach((exp) => {
      const uId = exp.user_id;
      const uName = exp.user?.full_name || 'Team Member';
      const uEmail = exp.user?.email || '';

      if (!map[uId]) {
        map[uId] = { name: uName, email: uEmail, personalTotal: 0, companyPaidTotal: 0, count: 0 };
      }

      const amt = Number(exp.amount);
      map[uId].count += 1;

      if (exp.paid_from === 'Personal Account' || exp.paid_from === 'Personal Cash') {
        map[uId].personalTotal += amt;
      } else {
        map[uId].companyPaidTotal += amt;
      }
    });

    return Object.values(map).sort((a, b) => b.personalTotal - a.personalTotal);
  }, [filtered]);

  // Total Reimbursement Owed to Team Members
  const totalOwedReimbursements = useMemo(() => {
    return userReimbursements.reduce((acc, u) => acc + u.personalTotal, 0);
  }, [userReimbursements]);

  // Cash vs Digital Split
  const split = useMemo(() => {
    let cash = 0;
    let digital = 0;
    filtered.forEach((exp) => {
      const amt = Number(exp.amount);
      if (exp.payment_type === 'Cash' || exp.payment_type === 'Petty Cash') {
        cash += amt;
      } else {
        digital += amt;
      }
    });
    const total = cash + digital;
    return {
      cash,
      digital,
      cashPct: total > 0 ? Math.round((cash / total) * 100) : 0,
      digitalPct: total > 0 ? Math.round((digital / total) * 100) : 0,
    };
  }, [filtered]);

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(map)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        pct: totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, totalAmount]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert('No expenses to export.');
      return;
    }

    const headers = [
      'Receipt Code',
      'Date',
      'Time',
      'Company',
      'Logged By',
      'Category',
      'Type of Payment',
      'Paid From',
      'Description / Reason',
      'Payment ID / UTR',
      'Amount (INR)',
      'Receipt Link',
      'Sync Status',
    ];

    const rows = filtered.map((e) => [
      e.receipt_code,
      e.expense_date,
      e.expense_time,
      e.company?.name || '',
      e.user?.full_name || '',
      e.category,
      e.payment_type,
      e.paid_from,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.payment_id || '').replace(/"/g, '""')}"`,
      e.amount,
      e.drive_file_url || 'Cash / No Receipt',
      e.sync_status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_Export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs font-medium">
            <button
              onClick={() => setPeriod('this-month')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                period === 'this-month' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('last-month')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                period === 'last-month' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                period === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`py-1.5 px-3 rounded-lg transition-all col-span-3 sm:col-span-1 ${
                period === 'custom' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Pickers */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>

        {/* Export to CSV Action */}
        <button
          onClick={handleExportCSV}
          className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700/60"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          Export CSV
        </button>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {formatINR(totalAmount)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {filtered.length} logged {filtered.length === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        {/* Personal Reimbursement Owed */}
        <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Reimbursement Owed</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
            {formatINR(totalOwedReimbursements)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Paid from personal UPI / accounts & cash
          </div>
        </div>

        {/* Cash vs Digital Split */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Digital vs Cash</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">UPI / Digital:</span>
              <span className="font-mono font-bold text-sky-400">
                {formatINR(split.digital)} ({split.digitalPct}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Cash / Petty:</span>
              <span className="font-mono font-bold text-amber-400">
                {formatINR(split.cash)} ({split.cashPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Active Companies */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Entities</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {companies.filter((c) => c.is_active).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Company-specific Google Sheets live
          </div>
        </div>
      </div>

      {/* Grid: Personal Reimbursements Owed & Company Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Reimbursement Tracker (CRITICAL for personal account tracking) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">
                Personal Reimbursements by Team Member
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Amount owed to pay back</span>
          </div>

          <p className="text-xs text-slate-400">
            Expenses paid out-of-pocket via personal UPI, credit card, or cash that need company settlement:
          </p>

          <div className="space-y-3">
            {userReimbursements.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No personal reimbursement entries in this period.
              </div>
            ) : (
              userReimbursements.map((u, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-white text-xs">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.count} expenses logged</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {formatINR(u.personalTotal)}
                    </div>
                    {u.companyPaidTotal > 0 && (
                      <div className="text-[10px] text-slate-500">
                        + {formatINR(u.companyPaidTotal)} via petty cash
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Company Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-white text-sm">Breakdown by Company</h3>
            </div>
            <span className="text-[11px] text-slate-400">Sheets Sync Target</span>
          </div>

          <div className="space-y-3">
            {companyBreakdown.map((c, idx) => {
              const pct = totalAmount > 0 ? Math.round((c.total / totalAmount) * 100) : 0;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 font-mono">
                        {c.code}
                      </span>
                      <span className="font-semibold text-white">{c.name}</span>
                    </div>
                    <div className="font-mono font-bold text-white">
                      {formatINR(c.total)}{' '}
                      <span className="text-[11px] text-slate-400 font-normal">({pct}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Breakdown with Progress Bars */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Category Spending</h3>
          </div>
          <span className="text-xs text-slate-400">Sorted by highest volume</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categoryBreakdown.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">{item.category}</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatINR(item.amount)}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">({item.pct}%)</span>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
