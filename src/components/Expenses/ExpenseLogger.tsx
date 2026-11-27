// ==============================================================================
// EXPENSE LOGGER COMPONENT
// Dual Mode: AI Vision Screenshot Scan & Manual/Cash Quick Entry
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Company,
  Project,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAID_FROM_SOURCES,
  CategoryType,
  PaymentMethod,
  PaidFromSource,
  AIParseResult,
  DEFAULT_COMPANIES,
} from '../../types';
import {
  uploadReceiptFile,
  getNextReceiptCode,
  triggerExpenseSync,
  parseReceiptWithAI,
  supabase,
} from '../../lib/supabase';
import { getTodayDateStr, getCurrentTimeStr, formatINR } from '../../lib/utils';
import {
  Sparkles,
  Camera,
  Upload,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  FileText,
  IndianRupee,
  RefreshCw,
  X,
  CreditCard,
  Tag,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface ExpenseLoggerProps {
  companies: Company[];
  projects?: Project[];
  onExpenseCreated: () => void;
  defaultCompanyId?: string;
}

export const ExpenseLogger: React.FC<ExpenseLoggerProps> = ({
  companies,
  projects = [],
  onExpenseCreated,
  defaultCompanyId,
}) => {
  const { user } = useAuth();

  // Mode: 'ai' (Screenshot scan) or 'manual' (Cash / Petty Cash / Historical)
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);
  const [detectedRemarkNote, setDetectedRemarkNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const effectiveCompanies = companies && companies.length > 0 ? companies : DEFAULT_COMPANIES;

  // Form Fields
  const [companyId, setCompanyId] = useState<string>(
    defaultCompanyId || effectiveCompanies[0].id
  );
  const [projectId, setProjectId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayDateStr());
  const [expenseTime, setExpenseTime] = useState<string>(getCurrentTimeStr());
  const [category, setCategory] = useState<CategoryType>('Food & Tea');
  const [paymentType, setPaymentType] = useState<PaymentMethod>('Paytm / UPI');
  const [paidFrom, setPaidFrom] = useState<PaidFromSource>('Personal Account');
  const [merchantOrPayee, setMerchantOrPayee] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');

  // Update default company when available
  useEffect(() => {
    if (!companyId || !effectiveCompanies.some((c) => c.id === companyId)) {
      setCompanyId(defaultCompanyId || effectiveCompanies[0].id);
    }
  }, [effectiveCompanies, defaultCompanyId, companyId]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setErrorMessage(null);
      // Auto analyze when uploaded
      handleAIAnalyze(file);
    }
  };

  // Run AI Vision Parsing
  const handleAIAnalyze = async (fileToAnalyze?: File) => {
    const file = fileToAnalyze || selectedFile;
    if (!file) {
      setErrorMessage('Please select or capture a receipt screenshot first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setLowConfidenceFields([]);
    setDetectedRemarkNote(null);

    try {
      const result: AIParseResult = await parseReceiptWithAI(file);

      if (result.amount !== null && result.amount !== undefined) {
        setAmount(result.amount.toString());
      }
      if (result.expense_date) {
        setExpenseDate(result.expense_date);
      }
      if (result.expense_time) {
        setExpenseTime(result.expense_time);
      }
      if (result.merchant_or_payee) {
        setMerchantOrPayee(result.merchant_or_payee);
      }
      if (result.description) {
        setDescription(result.description);
        setDetectedRemarkNote(result.description);
      }
      if (result.payment_id) {
        setPaymentId(result.payment_id);
      }
      if (result.payment_type && PAYMENT_METHODS.includes(result.payment_type as PaymentMethod)) {
        setPaymentType(result.payment_type as PaymentMethod);
      }
      if (result.suggested_category && EXPENSE_CATEGORIES.includes(result.suggested_category as CategoryType)) {
        setCategory(result.suggested_category as CategoryType);
      }
      if (result.low_confidence_fields && Array.isArray(result.low_confidence_fields)) {
        setLowConfidenceFields(result.low_confidence_fields);
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setErrorMessage(
        `AI Auto-parse Notice: ${err.message || 'Could not auto-extract fields. Please fill in manually.'}`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Quick Preset buttons for Cash / Petty Cash mode
  const applyCashPreset = (
    cat: CategoryType,
    payFrom: PaidFromSource,
    defaultDesc: string
  ) => {
    setCategory(cat);
    setPaymentType('Cash');
    setPaidFrom(payFrom);
    setDescription(defaultDesc);
    setMerchantOrPayee(defaultDesc);
  };

  // Reset form
  const handleReset = () => {
    setSelectedFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAmount('');
    setExpenseDate(getTodayDateStr());
    setExpenseTime(getCurrentTimeStr());
    setCategory('Food & Tea');
    setPaymentType(mode === 'ai' ? 'Paytm / UPI' : 'Cash');
    setPaidFrom(mode === 'ai' ? 'Personal Account' : 'Personal Cash');
    setMerchantOrPayee('');
    setDescription('');
    setPaymentId('');
    setProjectId('');
    setLowConfidenceFields([]);
    setDetectedRemarkNote(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      setErrorMessage('You must be signed in to log expenses.');
      return;
    }

    if (!companyId) {
      setErrorMessage('Please select a company for this expense.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a short description or reason for this expense.');
      return;
    }

    const selectedCompany = effectiveCompanies.find((c) => c.id === companyId) || effectiveCompanies[0];
    if (!selectedCompany) {
      setErrorMessage('Selected company does not exist.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Generate unique receipt code: {COMPANY_CODE}-{YYYYMMDD}-{SEQUENCE}
      const receiptCode = await getNextReceiptCode(selectedCompany.code, expenseDate);

      // 2. Upload image to Supabase Storage if present (named strictly by receipt code)
      let storagePath = '';
      if (selectedFile) {
        storagePath = await uploadReceiptFile(selectedFile, selectedCompany.code, receiptCode);
      }

      // 3. Insert expense row into Supabase
      const expenseTimestamp = `${expenseDate}T${expenseTime || '12:00'}:00Z`;

      const { data: newExpense, error: insertError } = await supabase
        .from('expenses')
        .insert({
          receipt_code: receiptCode,
          company_id: companyId,
          user_id: user.id,
          project_id: projectId || null,
          expense_date: expenseDate,
          expense_time: expenseTime || '12:00:00',
          expense_timestamp: expenseTimestamp,
          category,
          payment_type: paymentType,
          paid_from: paidFrom,
          merchant_or_payee: merchantOrPayee.trim() || description.trim(),
          description: description.trim(),
          payment_id: paymentId.trim(),
          amount: numAmount,
          receipt_image_path: storagePath || null,
          sync_status: 'pending',
        })
        .select()
        .single();

      if (insertError || !newExpense) {
        throw new Error(insertError?.message || 'Failed to save expense record.');
      }

      // 4. Trigger Google Sheets & Drive live sync Edge Function in background
      triggerExpenseSync(newExpense.id);

      setSuccessMessage(
        `Expense successfully logged! Receipt Code: ${receiptCode}. Live sync to Google Sheets & Drive initiated.`
      );

      // Notify parent & reset form after a brief delay
      onExpenseCreated();
      setTimeout(() => {
        handleReset();
      }, 1500);
    } catch (err: any) {
      console.error('Error logging expense:', err);
      setErrorMessage(err.message || 'An error occurred while saving the expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFieldLowConfidence = (field: string) => lowConfidenceFields.includes(field);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-6">
      {/* Mode Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 grid grid-cols-2 gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setMode('ai');
            setPaymentType('Paytm / UPI');
            setPaidFrom('Personal Account');
          }}
          className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'ai'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-sky-300" />
          <span>AI Screenshot Scan</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('manual');
            setPaymentType('Cash');
            setPaidFrom('Personal Cash');
          }}
          className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'manual'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-300" />
          <span>Cash / Manual Entry</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm flex items-start gap-3 shadow-md">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Expense Logged</p>
            <p className="text-xs text-emerald-300/90 leading-relaxed">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm flex items-start gap-3 shadow-md">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Action Required</p>
            <p className="text-xs text-rose-300/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Quick Presets for Cash Mode */}
      {mode === 'manual' && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-slate-300 mb-2.5">
            ⚡ Quick Cash Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => applyCashPreset('Metro', 'Personal Cash', 'Metro Card Recharge / Token')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 text-left text-xs transition-all hover:bg-slate-800/50"
            >
              <div className="font-medium text-white">🚇 Metro</div>
              <div className="text-[10px] text-slate-400">Card / Token</div>
            </button>
            <button
              type="button"
              onClick={() => applyCashPreset('Rickshaw / Auto / Cab', 'Personal Cash', 'Auto Rickshaw / Cab Fare')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 text-left text-xs transition-all hover:bg-slate-800/50"
            >
              <div className="font-medium text-white">🛺 Auto / Rickshaw</div>
              <div className="text-[10px] text-slate-400">Daily Travel</div>
            </button>
            <button
              type="button"
              onClick={() => applyCashPreset('Food & Tea', 'Personal Cash', 'Chai & Snacks')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 text-left text-xs transition-all hover:bg-slate-800/50"
            >
              <div className="font-medium text-white">☕ Food & Tea</div>
              <div className="text-[10px] text-slate-400">Street / Refreshment</div>
            </button>
            <button
              type="button"
              onClick={() => applyCashPreset('Petty Cash', 'Company Petty Cash', 'Office Petty Expense')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 text-left text-xs transition-all hover:bg-slate-800/50"
            >
              <div className="font-medium text-white">💼 Petty Cash</div>
              <div className="text-[10px] text-slate-400">Company Cash</div>
            </button>
          </div>
        </div>
      )}

      {/* Main Upload / Review Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        {/* Upload Box (Mandatory in AI mode, Optional in Manual mode) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {mode === 'ai' ? 'Payment Screenshot (Paytm / UPI / Bill)' : 'Receipt Photo (Optional)'}
              </span>
            </label>
            {imagePreview && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {!imagePreview ? (
            <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 text-center bg-slate-950/50 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {mode === 'ai' ? 'Upload Payment Screenshot' : 'Upload Receipt Photo (Optional)'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paytm, PhonePe, GPay, Bank Transfer, or Physical Bill
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Browse Gallery
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 p-3 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                <img
                  src={imagePreview}
                  alt="Receipt Preview"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="text-xs text-slate-400 font-mono truncate max-w-[260px]">
                  {selectedFile?.name || 'receipt-image.jpg'}
                </div>
                <div className="text-xs text-emerald-400 flex items-center justify-center sm:justify-start gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Image ready for Google Drive archiving
                </div>

                {mode === 'ai' && (
                  <button
                    type="button"
                    onClick={() => handleAIAnalyze()}
                    disabled={isAnalyzing}
                    className="mt-2 py-2 px-3.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-medium flex items-center justify-center sm:justify-start gap-2 transition-all disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    {isAnalyzing ? 'Re-analyzing with AI Vision...' : 'Re-run AI Vision Scan'}
                  </button>
                )}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="mt-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center gap-2.5 animate-pulse">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Gemini AI is reading receipt details, remarks, amount, and dates...</span>
            </div>
          )}

          {detectedRemarkNote && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Detected Payment Note: </span>
                <span className="italic">"{detectedRemarkNote}"</span> (Pre-filled as description)
              </div>
            </div>
          )}
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Company & Project Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Target Company *</span>
                </label>
                {companyId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${effectiveCompanies.find((c) => c.id === companyId)?.google_sheet_id || '1hqdEGXo2GcsJrB49z_DKivLayQUzqq3x8hOzw8tc9Fk'}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    title="Open company Google Sheet"
                  >
                    <span>Google Sheet</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {effectiveCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>Assign to Project (Optional)</span>
                </label>
              </div>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">No Project (General Operations)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `(${p.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount (INR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                <span>Amount (INR ₹) *</span>
              </label>
              {isFieldLowConfidence('amount') && (
                <span className="text-[10px] text-amber-400 font-medium">Verify Amount</span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm font-semibold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full bg-slate-950/70 border rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-mono font-medium focus:outline-none transition-colors ${
                  isFieldLowConfidence('amount')
                    ? 'border-amber-500/60 focus:border-amber-400'
                    : 'border-slate-800 focus:border-sky-500'
                }`}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-sky-400" />
                <span>Expense Category *</span>
              </label>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryType)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker (Supports past dates & times) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Date (Historical Supported) *</span>
              </label>
            </div>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Time Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Time *</span>
              </label>
            </div>
            <input
              type="time"
              required
              value={expenseTime}
              onChange={(e) => setExpenseTime(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Payment Type */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                <span>Type of Payment *</span>
              </label>
            </div>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Paid From (Personal vs Petty Cash) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-sky-400" />
                <span>Paid From *</span>
              </label>
              <span className="text-[11px] text-slate-500">For reimbursement tracking</span>
            </div>
            <select
              value={paidFrom}
              onChange={(e) => setPaidFrom(e.target.value as PaidFromSource)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              {PAID_FROM_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {/* Merchant / Payee */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Merchant / Person Paid
              </label>
              {isFieldLowConfidence('merchant_or_payee') && (
                <span className="text-[10px] text-amber-400 font-medium">Verify</span>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. Chai Wala, Uber, DMRC, Stationer"
              value={merchantOrPayee}
              onChange={(e) => setMerchantOrPayee(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Payment ID / UTR / Order ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Payment ID / UTR / Ref No.
              </label>
              {isFieldLowConfidence('payment_id') && (
                <span className="text-[10px] text-amber-400 font-medium">Optional</span>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. 433123891024 or Order ID"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Description / Reason (Span 2) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Description / Reason *</span>
              </label>
              <span className="text-[11px] text-slate-500">
                Scanned from Paytm notes or enter purpose
              </span>
            </div>
            <textarea
              required
              rows={2}
              placeholder="e.g. Auto fare to client office, Metro recharge for site visit, Team lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isAnalyzing}
            className="w-full py-3.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-semibold text-sm shadow-xl shadow-sky-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving & Syncing to Google Sheets...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Expense & Sync to Google Sheets</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
