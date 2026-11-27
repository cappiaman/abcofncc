// ==============================================================================
// TOP APPLICATION HEADER
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Company } from '../../types';
import { Wallet, Building2, LogOut, Shield } from 'lucide-react';

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

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
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
              Multi-Company & Personal Sync
            </p>
          </div>
        </div>

        {/* Global Company Filter / Active Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200">
              <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <select
                aria-label="Filter expenses by company"
                value={selectedCompanyId}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer pr-2"
              >
                <option value="" className="bg-slate-900 text-slate-300">
                  All Companies
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Profile & Logout (Desktop) */}
          <div className="flex items-center gap-2 border-l border-slate-800/80 pl-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-white truncate max-w-[130px]">
                {profile?.full_name}
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
