// ==============================================================================
// DESKTOP SIDEBAR NAVIGATION
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from './BottomNav';
import { PlusCircle, History, BarChart3, ShieldCheck, FileSpreadsheet, Building2 } from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { isAdmin, profile } = useAuth();

  const navItems = [
    { id: 'log' as NavTab, label: 'Log Expense', description: 'AI Scan & Manual Entry', icon: PlusCircle },
    { id: 'history' as NavTab, label: 'Expense History', description: 'All Records & Sync Status', icon: History },
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
              <div>
                <div className={`text-sm font-medium ${isActive ? 'text-sky-300' : 'text-slate-200'}`}>
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sync Status Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 space-y-2 mt-4">
        <div className="flex items-center gap-2 text-sky-400 font-medium">
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Live Google Sheets Sync</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Logged expenses automatically sync to each company's Google Sheet & Drive folder.
        </p>
      </div>
    </aside>
  );
};
