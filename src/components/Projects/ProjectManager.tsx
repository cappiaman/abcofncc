// ==============================================================================
// PROJECT MANAGEMENT COMPONENT
// View, Add, Edit, Delete Projects (Admin only for modifications)
// Tracks Project Budgets, Expenses, Client information, and Timelines
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Project, Company, Expense, ProjectStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate } from '../../lib/utils';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  Building2,
  User,
  Calendar,
  IndianRupee,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Save,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

interface ProjectManagerProps {
  projects: Project[];
  companies: Company[];
  expenses: Expense[];
  onProjectsChanged: () => void;
  selectedCompanyId?: string;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  companies,
  expenses,
  onProjectsChanged,
  selectedCompanyId,
}) => {
  const { isAdmin } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState(selectedCompanyId || '');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate expenses spent per project
  const projectSpending = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((exp) => {
      if (exp.project_id) {
        map[exp.project_id] = (map[exp.project_id] || 0) + Number(exp.amount);
      }
    });
    return map;
  }, [expenses]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProject(null);
    setName('');
    setCode(`PRJ-${projects.length + 1}`);
    setCompanyId(selectedCompanyId || companies[0]?.id || '');
    setClientName('');
    setDescription('');
    setBudget('');
    setStatus('active');
    setStartDate(new Date().toISOString().substring(0, 10));
    setEndDate('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setCode(project.code || '');
    setCompanyId(project.company_id || companies[0]?.id || '');
    setClientName(project.client_name || '');
    setDescription(project.description || '');
    setBudget(project.budget ? project.budget.toString() : '');
    setStatus(project.status || 'active');
    setStartDate(project.start_date || '');
    setEndDate(project.end_date || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // Save Project (Create / Update)
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Project Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      company_id: companyId || null,
      client_name: clientName.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : 0,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingProject?.id) {
        // Update
        const { error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', editingProject.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from('projects').insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      onProjectsChanged();
    } catch (err: any) {
      console.error('Error saving project:', err);
      setErrorMessage(err.message || 'Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Project (Admin only)
  const handleDeleteProject = async (project: Project) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete project "${project.name}"? Expenses linked to this project will remain in the database.`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      onProjectsChanged();
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message}`);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const comp = filterCompany || selectedCompanyId;
      if (comp && p.company_id !== comp) return false;

      if (filterStatus && p.status !== filterStatus) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(term);
        const codeMatch = (p.code || '').toLowerCase().includes(term);
        const clientMatch = (p.client_name || '').toLowerCase().includes(term);
        const descMatch = (p.description || '').toLowerCase().includes(term);
        if (!nameMatch && !codeMatch && !clientMatch && !descMatch) return false;
      }

      return true;
    });
  }, [projects, filterCompany, selectedCompanyId, filterStatus, searchTerm]);

  // Status Badge Helper
  const getStatusBadge = (st: ProjectStatus) => {
    switch (st) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            On Hold
          </span>
        );
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Planned
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Header & Action */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-sky-400" />
            Projects & Client Accounts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track business projects, client accounts, budgets, and operational spending.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sky-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects by name, code, client, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="planned">Planned</option>
        </select>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No projects found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin
              ? 'Click "Add Project" above to create your first business project.'
              : 'No projects have been added by the administrator yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const company = companies.find((c) => c.id === p.company_id);
            const spent = projectSpending[p.id] || 0;
            const budgetVal = Number(p.budget || 0);
            const utilization = budgetVal > 0 ? Math.round((spent / budgetVal) * 100) : 0;

            return (
              <div
                key={p.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {p.code && (
                        <span className="font-mono text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                          {p.code}
                        </span>
                      )}
                      <h3 className="font-bold text-white text-base leading-tight mt-0.5">
                        {p.name}
                      </h3>
                    </div>
                    <div>{getStatusBadge(p.status)}</div>
                  </div>

                  {company && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="font-medium text-slate-300">{company.name}</span>
                    </div>
                  )}

                  {p.client_name && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Client: <strong className="text-slate-300">{p.client_name}</strong></span>
                    </div>
                  )}

                  {p.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 pt-1 border-t border-slate-800/60">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Financials & Timeline */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
                  {/* Budget & Spend */}
                  <div className="space-y-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Expenses Spent:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatINR(spent)}
                      </span>
                    </div>
                    {budgetVal > 0 && (
                      <>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Budget:</span>
                          <span className="font-mono text-slate-300">
                            {formatINR(budgetVal)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization > 100
                                ? 'bg-rose-500'
                                : utilization > 80
                                ? 'bg-amber-400'
                                : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-right text-slate-500">
                          {utilization}% budget utilized
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dates */}
                  {(p.start_date || p.end_date) && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {p.start_date ? formatDate(p.start_date) : 'Start'}
                      </span>
                      <span>→</span>
                      <span>{p.end_date ? formatDate(p.end_date) : 'Ongoing'}</span>
                    </div>
                  )}

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProject(p)}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Project Modal (Admin Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-sky-400" />
                {editingProject ? 'Edit Project' : 'Add New Project'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Redesign & SEO"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Project Code
                  </label>
                  <input
                    type="text"
                    placeholder="PRJ-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Assigned Company *
                  </label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Client / Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Budget (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">₹</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="50000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Project Description / Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Details about client requirements, scope, or delivery milestones..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
