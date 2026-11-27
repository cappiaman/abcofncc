// ==============================================================================
// APPLICATION LAYOUT (DESKTOP SIDEBAR + MOBILE BOTTOM BAR)
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav, NavTab } from './BottomNav';
import { Company } from '../../types';
import { Users, AlertTriangle } from 'lucide-react';

interface AppLayoutProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingApprovalCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  activeTab,
  onTabChange,
  pendingApprovalCount = 0,
  children,
}) => {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <Header
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
        pendingApprovalCount={pendingApprovalCount}
        onTabChange={onTabChange}
      />

      {/* Admin Action Notification Banner */}
      {isAdmin && pendingApprovalCount > 0 && activeTab !== 'admin' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              <strong>{pendingApprovalCount} team member{pendingApprovalCount > 1 ? 's' : ''}</strong> waiting for admin approval.
            </span>
          </div>
          <button
            onClick={() => onTabChange('admin')}
            className="py-1 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shrink-0 active:scale-95"
          >
            Review & Approve →
          </button>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} pendingApprovalCount={pendingApprovalCount} />

        {/* Main View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} pendingApprovalCount={pendingApprovalCount} />
    </div>
  );
};
