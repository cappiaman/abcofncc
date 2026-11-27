// ==============================================================================
// MOBILE BOTTOM NAVIGATION (Fast thumb-friendly PWA bar)
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, History, BarChart3, Shield } from 'lucide-react';

export type NavTab = 'log' | 'history' | 'summary' | 'admin';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { isAdmin } = useAuth();

  const tabs = [
    { id: 'log' as NavTab, label: 'Log', icon: PlusCircle },
    { id: 'history' as NavTab, label: 'History', icon: History },
    { id: 'summary' as NavTab, label: 'Summary', icon: BarChart3 },
    ...(isAdmin ? [{ id: 'admin' as NavTab, label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 md:hidden safe-area-pb">
      <div className="grid grid-cols-3 md:grid-cols-4 max-w-lg mx-auto h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
