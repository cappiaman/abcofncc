// ==============================================================================
// MOBILE BOTTOM NAVIGATION (Fast thumb-friendly PWA bar)
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, History, FolderKanban, BarChart3, Shield } from 'lucide-react';

export type NavTab = 'log' | 'history' | 'projects' | 'summary' | 'admin';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingApprovalCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, pendingApprovalCount = 0 }) => {
  const { isAdmin } = useAuth();

  const tabs = [
    { id: 'log' as NavTab, label: 'Log', icon: PlusCircle },
    { id: 'history' as NavTab, label: 'History', icon: History },
    { id: 'projects' as NavTab, label: 'Projects', icon: FolderKanban },
    { id: 'summary' as NavTab, label: 'Summary', icon: BarChart3 },
    ...(isAdmin ? [{ id: 'admin' as NavTab, label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 md:hidden safe-area-pb">
      <div className={`grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} max-w-lg mx-auto h-16`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {tab.id === 'admin' && pendingApprovalCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                    {pendingApprovalCount}
                  </span>
                )}
              </div>
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
