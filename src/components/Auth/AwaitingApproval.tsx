// ==============================================================================
// AWAITING APPROVAL SCREEN
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

export const AwaitingApproval: React.FC = () => {
  const { profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refreshProfile();
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40">
      <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/20 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-5 shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Awaiting Admin Approval</h1>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Hello <span className="font-semibold text-white">{profile?.full_name || 'there'}</span>,
          your account has been created and is waiting for an administrator to review and activate your access.
        </p>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-left mb-6 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Registered Email:</span>
            <span className="text-slate-200 font-mono">{profile?.email}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Account Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Pending Review
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-medium rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking Status...' : 'Check Approval Status'}
          </button>

          <button
            onClick={signOut}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium rounded-xl border border-slate-700/60 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <div className="mt-6 text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Expenses, Google Sheets, and Drive sync are restricted until approved.</span>
        </div>
      </div>
    </div>
  );
};
