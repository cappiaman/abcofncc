// ==============================================================================
// APPLICATION LAYOUT (DESKTOP SIDEBAR + MOBILE BOTTOM BAR)
// ==============================================================================

import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav, NavTab } from './BottomNav';
import { Company } from '../../types';

interface AppLayoutProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  activeTab,
  onTabChange,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <Header
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

        {/* Main View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
};
