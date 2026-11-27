// ==============================================================================
// DESKTOP SIDEBAR NAVIGATION
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from './BottomNav';
import { PlusCircle, History, FolderKanban, BarChart3, ShieldCheck, FileSpreadsheet, Building2, ExternalLink } from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingApprovalCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, pendingApprovalCount = 0 }) => {
  const { isAdmin, profile } = useAuth();

  const navItems = [
    { id: 'log' as NavTab, label: 'Log Expense', description: 'AI Scan & Manual Entry', icon: PlusCircle },
    { id: 'history' as NavTab, label: 'Expense History', description: 'All Records & Sync Status', icon: History },
    { id: 'projects' as NavTab, label: 'Projects', description: 'Clients, Budgets & Spending', icon: FolderKanban },
    { id: 'summary' as NavTab, label: 'Summary & Reports', description: 'Reimbursements & Breakdown', icon: BarChart3 },
    ...(isAdmin
      ? [{ id: 'admin' as NavTab, label: 'Admin Dashboard', description: 'Users, Companies & CSV', icon: ShieldCheck }]
      : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900/60 border-r border-slate-800/80 p-4 shrink-0">
      <div className="space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-start gap-3.5 p-3 rounded-xl transition-all text-left ${
                isActive
                  ? 'bg-sky-600/15 border border-sky-500/30 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className={`text-sm font-medium ${isActive ? 'text-sky-300' : 'text-slate-200'}`}>
                    {item.label}
                  </div>
                  {item.id === 'admin' && pendingApprovalCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                      {pendingApprovalCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  {item.id === 'admin' && pendingApprovalCount > 0
                    ? `${pendingApprovalCount} approval waiting`
                    : item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sync Status Banner & Direct Google Sheet Links */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 space-y-2.5 mt-4">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Google Sheets</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Live sync to company sheets:
        </p>
        <div className="space-y-1.5 pt-1">
          <a
            href="https://docs.google.com/spreadsheets/d/1hqdEGXo2GcsJrB49z_DKivLayQUzqq3x8hOzw8tc9Fk/edit"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-[11px] text-slate-200 transition-colors group"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="truncate group-hover:text-emerald-300">Ulpala Solution Sheet</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1" />
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/1VfqrI_tfr-FYQa4TGOcSHAG1BstIxY1H61bu-3i-p4Q/edit"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-[11px] text-slate-200 transition-colors group"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="truncate group-hover:text-emerald-300">Savana Force Sheet</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1" />
          </a>
        </div>
      </div>
    </aside>
  );
};
