// ==============================================================================
// TOP APPLICATION HEADER
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Company, DEFAULT_COMPANIES } from '../../types';
import { Wallet, Building2, LogOut, Shield, FileSpreadsheet, ExternalLink, ChevronDown } from 'lucide-react';

interface HeaderProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
}) => {
  const { profile, signOut, isAdmin } = useAuth();
  const [isSheetMenuOpen, setIsSheetMenuOpen] = useState(false);
  const sheetMenuRef = useRef<HTMLDivElement>(null);

  // Close sheet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sheetMenuRef.current && !sheetMenuRef.current.contains(event.target as Node)) {
        setIsSheetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectiveCompanies = companies && companies.length > 0 ? companies : DEFAULT_COMPANIES;

  // Active company or first default company
  const currentCompany = effectiveCompanies.find((c) => c.id === selectedCompanyId) || effectiveCompanies[0];
  const targetSheetId = currentCompany?.google_sheet_id || '1hqdEGXo2GcsJrB49z_DKivLayQUzqq3x8hOzw8tc9Fk';
  const primarySheetUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`;

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* App Title & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">ExpenseTracker</span>
              {isAdmin && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Shield className="w-3 h-3" />
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Ulpala Solution & Savana Force
            </p>
          </div>
        </div>

        {/* Global Company Filter, Google Sheet Button & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Permanent "Take me to Google Sheet" button with Dropdown */}
          <div className="relative" ref={sheetMenuRef}>
            <div className="flex items-center">
              <a
                href={primarySheetUrl}
                target="_blank"
                rel="noreferrer"
                title={`Open ${currentCompany?.name || 'Company'} Google Sheet`}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-l-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/40 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                <span className="hidden sm:inline">
                  {selectedCompanyId ? `${currentCompany?.code} Sheet` : 'Google Sheet'}
                </span>
                <span className="sm:hidden">Sheet</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => setIsSheetMenuOpen(!isSheetMenuOpen)}
                className="py-1.5 px-1.5 rounded-r-xl bg-emerald-700 hover:bg-emerald-600 border-y border-r border-emerald-500/40 text-emerald-100 text-xs font-semibold shadow-md transition-all"
                title="Choose Google Sheet"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSheetMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Google Sheets Dropdown Menu */}
            {isSheetMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                  Live Google Sheets
                </div>
                {effectiveCompanies.map((c) => {
                  const url = `https://docs.google.com/spreadsheets/d/${c.google_sheet_id}/edit`;
                  return (
                    <a
                      key={c.id}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsSheetMenuOpen(false)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 text-xs text-slate-200 transition-colors group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate font-medium group-hover:text-emerald-300">
                          {c.name}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-2" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Company Selector */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200">
              <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <select
                aria-label="Filter expenses by company"
                value={selectedCompanyId}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer pr-1 max-w-[110px] sm:max-w-[180px] truncate"
              >
                <option value="" className="bg-slate-900 text-slate-300">
                  All Companies
                </option>
                {effectiveCompanies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Profile & Logout (Desktop) */}
          <div className="flex items-center gap-2 border-l border-slate-800/80 pl-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-white truncate max-w-[130px]">
                {profile?.full_name || 'Admin'}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                {profile?.email}
              </div>
            </div>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
