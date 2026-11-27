// ==============================================================================
// MAIN APP COMPONENT
// Orchestrates Auth, Gatekeeping, Realtime updates, and Tab Routing
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/Auth/AuthScreen';
import { AwaitingApproval } from './components/Auth/AwaitingApproval';
import { AccountBlocked } from './components/Auth/AccountBlocked';
import { AppLayout } from './components/Layout/AppLayout';
import { NavTab } from './components/Layout/BottomNav';
import { ExpenseLogger } from './components/Expenses/ExpenseLogger';
import { ExpenseList } from './components/Expenses/ExpenseList';
import { ProjectManager } from './components/Projects/ProjectManager';
import { SummaryDashboard } from './components/Summary/SummaryDashboard';
import { AdminPanel } from './components/Admin/AdminPanel';
import { Company, Expense, Project } from './types';
import { supabase, isConfigured } from './lib/supabase';
import { AlertCircle, RefreshCw } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, profile, isLoading, isAdmin, isApproved } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>('log');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Load Companies
  const loadCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies((data as Company[]) || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  }, []);

  // Load Projects
  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, []);

  // Load Expenses with joins
  const loadExpenses = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          company:companies(*),
          project:projects(name, code),
          user:profiles(full_name, email)
        `)
        .order('expense_date', { ascending: false })
        .order('expense_time', { ascending: false });

      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user && isApproved) {
      loadCompanies();
      loadProjects();
      loadExpenses();

      // Listen for realtime expense changes
      const channel = supabase
        .channel('expenses-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          () => {
            loadExpenses();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isApproved, loadCompanies, loadExpenses]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Loading ExpenseTracker...</p>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return <AuthScreen />;
  }

  // Gatekeeping: Pending Approval
  if (profile?.status === 'pending') {
    return <AwaitingApproval />;
  }

  // Gatekeeping: Rejected or Deactivated
  if (profile?.status === 'rejected' || profile?.status === 'deactivated') {
    return <AccountBlocked />;
  }

  return (
    <AppLayout
      companies={companies}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={setSelectedCompanyId}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'log' && (
        <ExpenseLogger
          companies={companies}
          projects={projects}
          onExpenseCreated={() => {
            loadExpenses();
            setActiveTab('history');
          }}
          defaultCompanyId={selectedCompanyId}
        />
      )}

      {activeTab === 'history' && (
        <ExpenseList
          expenses={expenses}
          companies={companies}
          projects={projects}
          onRefresh={loadExpenses}
          selectedCompanyId={selectedCompanyId}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectManager
          projects={projects}
          companies={companies}
          expenses={expenses}
          onProjectsChanged={loadProjects}
          selectedCompanyId={selectedCompanyId}
        />
      )}

      {activeTab === 'summary' && (
        <SummaryDashboard
          expenses={expenses}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
        />
      )}

      {activeTab === 'admin' && isAdmin && (
        <AdminPanel
          companies={companies}
          onCompaniesChanged={loadCompanies}
          onExpensesChanged={loadExpenses}
        />
      )}
    </AppLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
