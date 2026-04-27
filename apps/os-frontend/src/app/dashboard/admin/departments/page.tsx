'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import api, {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentDefaultApps,
  addDepartmentDefaultApp,
  removeDepartmentDefaultApp,
  getApps,
} from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Icons } from '@/components/shared/Icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Department {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

interface App {
  id: string;
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
  webhook_url: string | null;
  is_active: boolean;
}

interface DefaultApp {
  id: string;
  slug: string;
  name: string;
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allApps, setAllApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [defaultApps, setDefaultApps] = useState<Record<string, DefaultApp[]>>({});
  const [defaultAppsLoading, setDefaultAppsLoading] = useState<Record<string, boolean>>({});
  const [togglingApp, setTogglingApp] = useState<string | null>(null);

  // Add new department
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Edit department
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (user === undefined) return;
    if (user && user.user_type !== 'admin') { router.push('/dashboard'); return; }
    
    if (user) {
      Promise.all([
        api.get('/users/departments').then(r => r.data),
        getApps(),
      ]).then(([depts, apps]) => {
        setDepartments(depts);
        setAllApps(apps.filter((a: App) => a.is_active));
      }).finally(() => setLoading(false));
    }
  }, [user?.id, router]);

  useEffect(() => {
    if (adding) setTimeout(() => newInputRef.current?.focus(), 50);
  }, [adding]);

  async function handleExpand(deptId: string) {
    if (expandedId === deptId) { setExpandedId(null); return; }
    setExpandedId(deptId);
    if (defaultApps[deptId]) return;
    setDefaultAppsLoading(prev => ({ ...prev, [deptId]: true }));
    try {
      const apps = await getDepartmentDefaultApps(deptId);
      setDefaultApps(prev => ({ ...prev, [deptId]: apps }));
    } finally {
      setDefaultAppsLoading(prev => ({ ...prev, [deptId]: false }));
    }
  }

  async function handleToggleApp(deptId: string, app: App) {
    const current = defaultApps[deptId] ?? [];
    const isAssigned = current.some(a => a.id === app.id);
    const key = `${deptId}-${app.id}`;
    setTogglingApp(key);
    try {
      if (isAssigned) {
        await removeDepartmentDefaultApp(deptId, app.id);
        setDefaultApps(prev => ({
          ...prev,
          [deptId]: prev[deptId].filter(a => a.id !== app.id),
        }));
      } else {
        await addDepartmentDefaultApp(deptId, app.id);
        setDefaultApps(prev => ({
          ...prev,
          [deptId]: [...(prev[deptId] ?? []), { id: app.id, slug: app.slug, name: app.name }],
        }));
      }
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Assignment update failed');
    } finally {
      setTogglingApp(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError('');
    setAddLoading(true);
    try {
      const dept = await createDepartment(newName.trim());
      setDepartments(prev => [...prev, dept]);
      setNewName('');
      setAdding(false);
    } catch (err: any) {
      setAddError(err?.response?.data?.message ?? 'Failed to create department');
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditError('');
    setExpandedId(null);
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setEditError('');
    setEditLoading(true);
    try {
      const updated = await updateDepartment(id, editName.trim());
      setDepartments(prev => prev.map(d => (d.id === id ? { ...d, name: updated.name } : d)));
      setEditingId(null);
    } catch (err: any) {
      setEditError(err?.response?.data?.message ?? 'Update failed');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message ?? 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Icons.Sync size={24} className="animate-spin text-primary opacity-20" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4">
            <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
               <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
               <Icons.ChevronRight size={10} />
               <span className="text-slate-900 border-b border-brand-gold/30">Organization</span>
            </nav>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Departments</h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Standardize operational app sets across organizational units.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <Button 
               onClick={() => { setAdding(true); setAddError(''); }} 
               className="h-11 px-6 bg-brand-navy text-white font-black rounded-xl shadow-lg shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
               <Icons.Plus size={16} className="mr-2" />
               Add Department
             </Button>
          </div>
        </div>

        {adding && (
          <form onSubmit={handleAdd} className="bg-primary/5 rounded-3xl p-6 border border-primary/10 flex flex-col md:flex-row items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex-1 w-full space-y-1">
              <input
                ref={newInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Department name (e.g. Logistics Ops)"
                required
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
              {addError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider pl-1">{addError}</p>}
            </div>
            <div className="flex gap-2 shrink-0 self-end md:self-center">
              <Button type="submit" disabled={addLoading} className="h-11 px-6 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/10">
                {addLoading ? 'Creating...' : 'Create Unit'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setNewName(''); setAddError(''); }} className="h-11 px-4 text-slate-500 hover:text-slate-700 font-bold rounded-xl">
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {departments.length === 0 && !adding && (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 py-16 text-center">
              <Icons.Training size={32} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-900 font-bold">No organizational units registered</p>
              <p className="text-slate-400 text-xs mt-1 font-medium">Provision departments to automate member onboarding.</p>
            </div>
          )}

          {departments.map((dept) => {
            const isExpanded = expandedId === dept.id;
            const assigned = defaultApps[dept.id] ?? [];
            const assignedIds = new Set(assigned.map(a => a.id));

            return (
              <div key={dept.id} className={cn(
                "group bg-white rounded-3xl border border-slate-200 shadow-sm transition-all duration-300",
                isExpanded && "ring-2 ring-primary/5 border-primary/20 shadow-xl shadow-primary/5"
              )}>
                <div className="p-4 flex items-center justify-between gap-4">
                  {editingId === dept.id ? (
                    <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-3 w-full">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 w-full h-12 px-4 bg-slate-50 border border-primary/20 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={() => handleUpdate(dept.id)} disabled={editLoading} size="sm" className="flex-1 md:flex-none h-10 px-6 bg-primary text-white font-bold rounded-xl">
                          {editLoading ? 'Updating...' : 'Update'}
                        </Button>
                        <Button onClick={() => setEditingId(null)} size="sm" variant="outline" className="h-10 px-4 text-slate-500 border-slate-200 rounded-xl">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleExpand(dept.id)} className="flex-1 flex items-center gap-4 text-left min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                          isExpanded ? "bg-primary text-white" : "bg-slate-50 text-slate-400"
                        )}>
                          <Icons.Training size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{dept.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{dept.slug}</p>
                        </div>
                        
                        {!isExpanded && (
                          <div className="flex items-center gap-2">
                            {assigned.length > 0 ? (
                              <Badge variant="outline" className="hidden sm:inline-flex bg-white border-slate-100 text-slate-400 text-[10px] font-bold h-7 px-3 rounded-full hover:border-primary/20 hover:text-primary transition-colors">
                                <Icons.Check size={10} className="mr-1.5" />
                                {assigned.length} Apps Set
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="hidden sm:inline-flex bg-primary/5 border-primary/10 text-primary text-[10px] font-bold h-7 px-3 rounded-full animate-pulse">
                                Setup Apps
                              </Badge>
                            )}
                          </div>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        {deletingId === dept.id ? (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                             <span className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest px-2">Delete Entire Unit?</span>
                             <Button onClick={() => handleDelete(dept.id)} disabled={deleteLoading} size="sm" className="h-8 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg px-3">
                               Confirm
                             </Button>
                             <Button onClick={() => setDeletingId(null)} size="sm" variant="ghost" className="h-8 px-2 text-slate-400 font-bold hover:text-slate-600 rounded-lg">
                               Cancel
                             </Button>
                          </div>
                        ) : (
                          <>
                            <Button onClick={(e) => { e.stopPropagation(); startEdit(dept); }} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg border border-slate-100 transition-all shadow-sm">
                              <Icons.Edit size={14} />
                            </Button>
                            <Button onClick={(e) => { e.stopPropagation(); setDeletingId(dept.id); }} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-100 transition-all shadow-sm">
                              <Icons.Trash size={14} />
                            </Button>
                            <div className={cn(
                              "ml-1 transition-transform duration-300",
                              isExpanded && "rotate-180"
                            )}>
                              <Icons.ChevronRight size={14} className="text-slate-300" />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {isExpanded && editingId !== dept.id && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Provisioning Rules
                      </p>
                    </div>

                    {defaultAppsLoading[dept.id] ? (
                      <div className="flex items-center gap-2 text-slate-400 py-2">
                        <Icons.Sync size={12} className="animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Bridging Data...</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allApps.map(app => {
                          const isActive = assignedIds.has(app.id);
                          const isToggling = togglingApp === `${dept.id}-${app.id}`;
                          
                          return (
                            <button
                              key={app.id}
                              onClick={() => handleToggleApp(dept.id, app)}
                              disabled={isToggling}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ring-1 transition-all",
                                isActive 
                                  ? "bg-primary/10 ring-primary/20 text-primary shadow-sm" 
                                  : "bg-white ring-slate-100 text-slate-400 hover:ring-slate-300"
                              )}
                            >
                              {isToggling ? (
                                <Icons.Sync size={10} className="animate-spin mr-1" />
                              ) : isActive ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1" />
                              ) : (
                                <Icons.Plus size={10} className="mr-1" />
                              )}
                              {app.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="mt-6 flex items-start gap-3 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                      <Icons.Help size={16} className="text-primary/40 mt-0.5" />
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Automatic Onboarding: New accounts assigned to the <strong className="text-slate-900">{dept.name}</strong> unit will inherit access to all bridged modules above by default.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
