// ==============================================================================
// ACCOUNT BLOCKED / REJECTED SCREEN
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { XCircle, LogOut } from 'lucide-react';

export const AccountBlocked: React.FC = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/40">
      <div className="w-full max-w-md bg-slate-900/90 border border-rose-500/20 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-5 shadow-inner">
          <XCircle className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access Disabled</h1>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Your account for <span className="font-semibold text-white">{profile?.email}</span> is currently{' '}
          <span className="font-medium text-rose-400">{profile?.status}</span>.
          Please contact the workspace administrator if you believe this is in error.
        </p>

        <button
          onClick={signOut}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
