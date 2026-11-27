// ==============================================================================
// ADMIN DASHBOARD
// 1. User Approval & Role Management (Pending, Approved, Rejected, Deactivated)
// 2. Dynamic Company Management (Code, Sheet ID, Tab, Drive Folder ID)
// 3. Historical CSV Bulk Import Utility (With automatic receipt code & live Sheets sync)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Profile,
  Company,
  CategoryType,
  PaymentMethod,
  PaidFromSource,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAID_FROM_SOURCES,
} from '../../types';
import { supabase, getNextReceiptCode, triggerExpenseSync } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import {
  ShieldCheck,
  Users,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  AlertCircle,
  RefreshCw,
  FolderSync,
  Save,
  Check,
} from 'lucide-react';

interface AdminPanelProps {
  companies: Company[];
  onCompaniesChanged: () => void;
  onExpensesChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  companies,
  onCompaniesChanged,
  onExpensesChanged,
}) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'companies' | 'csv'>('users');

  // Users State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState<string | null>(null);

  // Company Form State
  const [editingCompany, setEditingCompany] = useState<Partial<Company> | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyMsg, setCompanyMsg] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);

  // Load profiles
  const loadProfiles = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data as Profile[]) || []);
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Update user status
  const handleUpdateUserStatus = async (
    targetUserId: string,
    newStatus: 'approved' | 'rejected' | 'deactivated',
    newRole?: 'admin' | 'member'
  ) => {
    setUserActionMsg(null);
    try {
      const updatePayload: any = { status: newStatus };
      if (newRole) updatePayload.role = newRole;

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', targetUserId);

      if (error) throw error;

      setUserActionMsg(`User updated to ${newStatus}${newRole ? ` (${newRole})` : ''}.`);
      await loadProfiles();
    } catch (err: any) {
      setUserActionMsg(`Error: ${err.message}`);
    }
  };

  // Save / Update Company
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    if (!editingCompany.name?.trim() || !editingCompany.code?.trim()) {
      alert('Company Name and Code (e.g. CO1, CO2, CO3) are required.');
      return;
    }

    setIsSavingCompany(true);
    setCompanyMsg(null);

    try {
      const payload = {
        name: editingCompany.name.trim(),
        code: editingCompany.code.trim().toUpperCase(),
        google_sheet_id: (editingCompany.google_sheet_id || '').trim(),
        sheet_tab_name: (editingCompany.sheet_tab_name || 'Expenses').trim(),
        google_drive_folder_id: (editingCompany.google_drive_folder_id || '').trim(),
        is_active: editingCompany.is_active ?? true,
      };

      if (editingCompany.id) {
        // Update existing
        const { error } = await supabase
          .from('companies')
          .update(payload)
          .eq('id', editingCompany.id);
        if (error) throw error;
        setCompanyMsg('Company updated successfully.');
      } else {
        // Insert new
        const { error } = await supabase.from('companies').insert(payload);
        if (error) throw error;
        setCompanyMsg('New company added successfully.');
      }

      setEditingCompany(null);
      onCompaniesChanged();
    } catch (err: any) {
      setCompanyMsg(`Error saving company: ${err.message}`);
    } finally {
      setIsSavingCompany(false);
    }
  };

  // CSV Template Download
  const downloadSampleCSV = () => {
    const sampleHeaders = [
      'Company Code',
      'Date (YYYY-MM-DD)',
      'Time (HH:MM)',
      'Category',
      'Payment Type',
      'Paid From',
      'Merchant / Payee',
      'Description',
      'Payment ID / UTR',
      'Amount',
    ];

    const sampleRow = [
      'CO1',
      '2026-11-20',
      '14:30',
      'Food & Tea',
      'Paytm / UPI',
      'Personal Account',
      'Chai Point',
      'Client team refreshments',
      'UTR982348274',
      '450.00',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [sampleHeaders.join(','), sampleRow.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'historical_expenses_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV File
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setImportStatusMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        alert('CSV must contain a header and at least one data row.');
        return;
      }

      // Parse headers
      const dataRows = lines.slice(1).map((line) => {
        // Simple regex-safe split for CSV
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        return {
          companyCode: cols[0] || 'CO1',
          date: cols[1] || '2026-11-01',
          time: cols[2] || '12:00',
          category: (cols[3] || 'Misc') as CategoryType,
          paymentType: (cols[4] || 'Cash') as PaymentMethod,
          paidFrom: (cols[5] || 'Personal Cash') as PaidFromSource,
          merchant: cols[6] || '',
          description: cols[7] || 'Historical Expense',
          paymentId: cols[8] || '',
          amount: parseFloat(cols[9]) || 0,
        };
      });

      setCsvRows(dataRows);
    };

    reader.readAsText(file);
  };

  // Run Bulk Import
  const handleExecuteImport = async () => {
    if (!csvRows.length || !user) return;

    setIsImporting(true);
    setImportStatusMsg(null);
    setImportProgress({ current: 0, total: csvRows.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      setImportProgress({ current: i + 1, total: csvRows.length });

      try {
        // Find company by code
        const comp = companies.find(
          (c) => c.code.toUpperCase() === row.companyCode.toUpperCase()
        ) || companies[0];

        if (!comp) {
          failCount++;
          continue;
        }

        // Generate receipt code
        const receiptCode = await getNextReceiptCode(comp.code, row.date);
        const timestamp = `${row.date}T${row.time || '12:00'}:00Z`;

        const { data: newExp, error: insertError } = await supabase
          .from('expenses')
          .insert({
            receipt_code: receiptCode,
            company_id: comp.id,
            user_id: user.id,
            expense_date: row.date,
            expense_time: row.time ? `${row.time}:00` : '12:00:00',
            expense_timestamp: timestamp,
            category: EXPENSE_CATEGORIES.includes(row.category) ? row.category : 'Misc',
            payment_type: PAYMENT_METHODS.includes(row.paymentType) ? row.paymentType : 'Cash',
            paid_from: PAID_FROM_SOURCES.includes(row.paidFrom) ? row.paidFrom : 'Personal Cash',
            merchant_or_payee: row.merchant || row.description,
            description: row.description || 'Imported Expense',
            payment_id: row.paymentId || '',
            amount: row.amount,
            sync_status: 'pending',
          })
          .select()
          .single();

        if (insertError || !newExp) {
          failCount++;
        } else {
          successCount++;
          // Trigger live sync in background
          triggerExpenseSync(newExp.id);
        }
      } catch (err) {
        console.error('Row import error:', err);
        failCount++;
      }
    }

    setIsImporting(false);
    setImportStatusMsg(
      `CSV Import Completed! Successfully imported ${successCount} expenses (${failCount} failed). Live syncs to Google Sheets initiated.`
    );
    setCsvFile(null);
    setCsvRows([]);
    onExpensesChanged();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Sub Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 grid grid-cols-3 gap-1 shadow-lg">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'users'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Approvals</span>
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'companies'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Companies & Sheets</span>
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'csv'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Historical CSV Import</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: USER APPROVAL MANAGEMENT
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                Team Members & Approvals
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Approve new signups so team members can view & log expenses.
              </p>
            </div>
            <button
              onClick={loadProfiles}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {userActionMsg && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
              {userActionMsg}
            </div>
          )}

          {/* Pending Approvals Spotlight Section */}
          {profiles.filter((p) => p.status === 'pending').length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <h4 className="font-bold text-white text-sm">
                    {profiles.filter((p) => p.status === 'pending').length} User{profiles.filter((p) => p.status === 'pending').length > 1 ? 's' : ''} Awaiting Approval
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Action Required
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {profiles
                  .filter((p) => p.status === 'pending')
                  .map((u) => (
                    <div
                      key={u.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="truncate">
                        <div className="font-semibold text-white text-xs truncate">
                          {u.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {u.email}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Signed up: {formatDate(u.created_at)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleUpdateUserStatus(u.id, 'approved', 'member')}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleUpdateUserStatus(u.id, 'rejected')}
                          className="py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold text-xs transition-all active:scale-95 flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/50">
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Signed Up</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {profiles.map((p) => {
                  const isCurrentUser = p.id === user?.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 text-slate-200">
                      <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                        <span>{p.full_name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] text-sky-400 font-normal">(You)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">{p.email}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            p.role === 'admin'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {p.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                        ) : p.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" /> Pending Approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> {p.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{formatDate(p.created_at)}</td>
                      <td className="py-3 px-3 text-right">
                        {!isCurrentUser ? (
                          <div className="inline-flex items-center gap-1.5">
                            {p.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateUserStatus(p.id, 'approved', 'member')}
                                  className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleUpdateUserStatus(p.id, 'rejected')}
                                  className="py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white font-medium text-[11px] transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                            {p.status === 'approved' && p.role !== 'admin' && (
                              <button
                                onClick={() =>
                                  handleUpdateUserStatus(p.id, 'approved', 'admin')
                                }
                                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] transition-colors"
                                title="Promote to Admin"
                              >
                                Make Admin
                              </button>
                            )}

                            {p.status === 'approved' && (
                              <button
                                onClick={() => handleUpdateUserStatus(p.id, 'deactivated')}
                                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 text-[11px] transition-colors"
                              >
                                Deactivate
                              </button>
                            )}

                            {p.status !== 'approved' && p.status !== 'pending' && (
                              <button
                                onClick={() => handleUpdateUserStatus(p.id, 'approved')}
                                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-emerald-400 text-[11px] transition-colors"
                              >
                                Re-activate
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Admin (Self)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DYNAMIC COMPANY MANAGEMENT
         ========================================================================= */}
      {activeTab === 'companies' && (
        <div className="space-y-6">
          {/* Top Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                Company Configurations & Google Links
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each company syncs to its own Google Sheet and Google Drive folder. Add 3rd+ companies seamlessly.
              </p>
            </div>
            <button
              onClick={() =>
                setEditingCompany({
                  name: '',
                  code: `CO${companies.length + 1}`,
                  google_sheet_id: '',
                  sheet_tab_name: 'Expenses',
                  google_drive_folder_id: '',
                  is_active: true,
                })
              }
              className="py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Company
            </button>
          </div>

          {companyMsg && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
              {companyMsg}
            </div>
          )}

          {/* Edit / Create Company Form */}
          {editingCompany && (
            <form
              onSubmit={handleSaveCompany}
              className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4"
            >
              <h4 className="font-semibold text-white text-sm">
                {editingCompany.id ? 'Edit Company' : 'Add New Company'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gamma Logistics Pvt Ltd"
                    value={editingCompany.name || ''}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, name: e.target.value })
                    }
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Short Code (e.g. CO1, CO2, CO3) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CO3"
                    value={editingCompany.code || ''}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Google Sheet ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={editingCompany.google_sheet_id || ''}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        google_sheet_id: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Sheet Tab Name
                  </label>
                  <input
                    type="text"
                    placeholder="Expenses"
                    value={editingCompany.sheet_tab_name || 'Expenses'}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        sheet_tab_name: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Google Drive Folder ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j"
                    value={editingCompany.google_drive_folder_id || ''}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        google_drive_folder_id: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActiveComp"
                    checked={editingCompany.is_active ?? true}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="isActiveComp" className="text-slate-300 font-medium cursor-pointer">
                    Active Company
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingCompany ? 'Saving...' : 'Save Company'}
                </button>
              </div>
            </form>
          )}

          {/* Companies List Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-500/20 text-sky-400 font-mono">
                        {c.code}
                      </span>
                      <h4 className="font-bold text-white text-base">{c.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Receipt Code format: <span className="font-mono text-slate-300">{c.code}-YYYYMMDD-001</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingCompany(c)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    title="Edit Company"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Google Sheet:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[200px]">
                      {c.google_sheet_id ? `...${c.google_sheet_id.slice(-10)}` : 'Not connected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Sheet Tab:</span>
                    <span className="font-semibold text-slate-200">{c.sheet_tab_name || 'Expenses'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Drive Folder:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[200px]">
                      {c.google_drive_folder_id ? `...${c.google_drive_folder_id.slice(-10)}` : 'Not configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Status:</span>
                    <span
                      className={`font-semibold ${c.is_active ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HISTORICAL CSV BULK IMPORT
         ========================================================================= */}
      {activeTab === 'csv' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                Historical CSV Bulk Import
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload existing spreadsheets to backfill past expenses into Supabase and sync them directly to company Google Sheets.
              </p>
            </div>
            <button
              onClick={downloadSampleCSV}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700/60"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample CSV
            </button>
          </div>

          {importStatusMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{importStatusMsg}</span>
            </div>
          )}

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 text-center bg-slate-950/40">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
              id="csvInput"
            />
            <label
              htmlFor="csvInput"
              className="cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {csvFile ? csvFile.name : 'Choose CSV file to import'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Matches Company Code, Date, Category, Amount, and details
                </p>
              </div>
              <span className="py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium">
                Browse CSV File
              </span>
            </label>
          </div>

          {/* Preview Table */}
          {csvRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Loaded {csvRows.length} rows ready for import
                </span>
                <button
                  onClick={() => {
                    setCsvFile(null);
                    setCsvRows([]);
                  }}
                  className="text-rose-400 hover:underline"
                >
                  Clear
                </button>
              </div>

              <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-800 bg-slate-950/60 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2">Co</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Paid From</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {csvRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono font-bold text-sky-400">{r.companyCode}</td>
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.category}</td>
                        <td className="p-2">{r.paidFrom}</td>
                        <td className="p-2 truncate max-w-xs">{r.description}</td>
                        <td className="p-2 text-right font-mono text-emerald-400 font-bold">
                          ₹{r.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvRows.length > 10 && (
                <p className="text-[11px] text-slate-500">
                  Showing first 10 of {csvRows.length} rows...
                </p>
              )}

              {/* Import Progress & Action */}
              <div className="pt-2">
                {isImporting && importProgress && (
                  <div className="mb-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-sky-300">
                      <span>
                        Importing row {importProgress.current} of {importProgress.total}...
                      </span>
                      <span>
                        {Math.round((importProgress.current / importProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 transition-all"
                        style={{
                          width: `${(importProgress.current / importProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleExecuteImport}
                  disabled={isImporting}
                  className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 transition-all disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importing and Syncing to Google Sheets...
                    </>
                  ) : (
                    <>
                      <FolderSync className="w-4 h-4" />
                      Import {csvRows.length} Expenses & Sync to Google Sheets
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
