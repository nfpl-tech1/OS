'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, setAppAccess, getApplications } from '@/lib/api';
import api from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Icons } from '@/components/shared/Icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step = 1 | 2;

interface AppOption {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

type AppSelections = Record<string, { enabled: boolean; isAppAdmin: boolean }>;
type UserTypeValue = 'employee' | 'client';

export default function NewUserPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [departments, setDepartments] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [appSelections, setAppSelections] = useState<AppSelections>({});
  const [form, setForm] = useState({
    name: '',
    email: '',
    company_email: '',
    password: '',
    user_type: 'employee' as 'employee' | 'client',
    department_id: '',
    branch_id: '',
    org_id: '',
    is_team_lead: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/departments').then((r) => setDepartments(r.data));
    api.get('/users/branches').then((r) => setBranches(r.data));
    getApplications().then(setApps);
  }, []);

  useEffect(() => {
    if (form.user_type !== 'client') return;

    setAppSelections((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).map(([slug, selection]) => [
          slug,
          {
            ...selection,
            isAppAdmin: false,
          },
        ]),
      );

      return next;
    });
  }, [form.user_type]);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleApp(slug: string) {
    setAppSelections((prev) => {
      const current = prev[slug];
      if (current?.enabled) {
        return {
          ...prev,
          [slug]: {
            enabled: false,
            isAppAdmin: false,
          },
        };
      }

      return {
        ...prev,
        [slug]: {
          enabled: true,
          isAppAdmin: current?.isAppAdmin ?? false,
        },
      };
    });
  }

  function toggleAppAdmin(slug: string) {
    setAppSelections((prev) => ({
      ...prev,
      [slug]: {
        enabled: true,
        isAppAdmin: !(prev[slug]?.isAppAdmin ?? false),
      },
    }));
  }

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (form.user_type !== 'client' && !form.department_id) {
        setError('Please assign a department for internal users.');
        setLoading(false);
        return;
      }
      if (form.user_type !== 'client' && !form.branch_id) {
        setError('Please assign a branch for internal users.');
        setLoading(false);
        return;
      }

      // Validate email uniqueness
      const users = await api.get('/users').then(res => res.data);
      const isDuplicate = users.some((u: { email: string }) => u.email.toLowerCase() === form.email.toLowerCase());
      if (isDuplicate) {
        setError('Email already in use');
        setLoading(false);
        return;
      }

      // Pre-select Default Apps for the department and branch
      if (form.user_type !== 'client') {
        const defaultSlugs = new Set<string>();
        if (form.department_id) {
          const deptApps = await api.get(`/users/departments/${form.department_id}/default-apps`).then(res => res.data);
          deptApps.forEach((a: { slug: string }) => defaultSlugs.add(a.slug));
        }
        if (form.branch_id) {
          const branchApps = await api.get(`/users/branches/${form.branch_id}/default-apps`).then(res => res.data);
          branchApps.forEach((a: { slug: string }) => defaultSlugs.add(a.slug));
        }
        
        setAppSelections(prev => {
          const next = { ...prev };
          defaultSlugs.forEach(slug => {
            if (!next[slug]) {
              next[slug] = { enabled: true, isAppAdmin: false };
            } else {
              next[slug] = { ...next[slug], enabled: true };
            }
          });
          return next;
        });
      }

      setStep(2);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to validate user');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setError('');

    if (form.user_type !== 'client' && !form.department_id) {
      setError('Please assign a department for internal users.');
      return;
    }
    if (form.user_type !== 'client' && !form.branch_id) {
      setError('Please assign a branch for internal users.');
      return;
    }

    setLoading(true);
    try {
      const created = await createUser({
        ...form,
        company_email: form.company_email.trim() || undefined,
        department_id: form.department_id || undefined,
        branch_id: form.branch_id || undefined,
        org_id: form.org_id || undefined,
      });
      for (const [slug, selection] of Object.entries(appSelections)) {
        if (!selection.enabled) continue;
        await setAppAccess(
          created.id,
          slug,
          true,
          form.user_type === 'client' ? false : selection.isAppAdmin,
        );
      }
      router.push('/dashboard/admin');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  const selectedAppsCount = Object.values(appSelections).filter((selection) => selection.enabled).length;

  function StepIndicator() {
    return (
      <div className="flex items-center justify-center sm:justify-start gap-8 py-2 border-b border-slate-100 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3 group relative pb-2 overflow-visible">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ring-4",
                step === s ? "bg-brand-navy text-white ring-brand-navy/10" : step > s ? "bg-emerald-500 text-white ring-emerald-100" : "bg-white text-slate-300 ring-slate-50 border border-slate-200"
              )}
            >
              {step > s ? <Icons.Check size={14} /> : s}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-[10px] uppercase font-extrabold tracking-widest",
                step >= s ? "text-primary" : "text-slate-300"
              )}>
                Step {s}
              </span>
              <span className={cn(
                "text-xs font-bold",
                step >= s ? "text-slate-900" : "text-slate-400"
              )}>
                {s === 1 ? 'Basic Details' : 'Access Provisioning'}
              </span>
            </div>
            {step === s && <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-brand-navy animate-in slide-in-from-left duration-500" />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Add New User</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Add an employee and assign their department and access level.</p>
          </div>
          <Button variant="outline" onClick={() => router.back()} className="h-9 px-4 border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50">
            <Icons.Back size={14} className="mr-2" />
            Cancel Operation
          </Button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 lg:p-8">
          <StepIndicator />

          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                  {/* Basic Details Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-1 bg-brand-navy rounded-full" />
                       <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Employee Details</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">Full Name</Label>
                        <div className="relative group">
                          <Icons.Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input required value={form.name} onChange={(e) => set('name', e.target.value)}
                            placeholder="e.g. John Doe"
                            className="pl-9 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">Email Address</Label>
                        <div className="relative group">
                          <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
                            placeholder="j.doe@company.com"
                            className="pl-9 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-semibold text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">Notification Email <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <div className="relative group">
                          <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input type="email" value={form.company_email} onChange={(e) => set('company_email', e.target.value)}
                            placeholder="name@company.com"
                            className="pl-9 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-semibold text-slate-900"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium ml-1">Used for training notifications.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">User Type</Label>
                        <Select value={form.user_type} onValueChange={(val) => set('user_type', val as UserTypeValue)}>
                          <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-bold text-slate-900 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="employee">Employee (Internal)</SelectItem>
                            <SelectItem value="client">Client (External)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">Password</Label>
                        <div className="relative group">
                          <Icons.Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input type={showPassword ? 'text' : 'password'} required minLength={8}
                            value={form.password} onChange={(e) => set('password', e.target.value)}
                            placeholder="System generated password"
                            className="pl-9 pr-10 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-mono text-xs"
                          />
                          <button type="button" onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors">
                            {showPassword ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  {/* Organization Mapping Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-1 bg-primary rounded-full" />
                       <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Department & Access</h3>
                    </div>

                    {form.user_type !== 'client' ? (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-600 ml-1">Department</Label>
                          <Select value={form.department_id} onValueChange={(val) => set('department_id', val)}>
                            <SelectTrigger className="h-12 w-full max-w-md rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-bold text-slate-900 text-sm">
                              <SelectValue placeholder="Select Unit..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-white">
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-400 font-medium ml-1">Department assignment is required for internal users.</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-600 ml-1">Branch</Label>
                          <Select value={form.branch_id} onValueChange={(val) => set('branch_id', val)}>
                            <SelectTrigger className="h-12 w-full max-w-md rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-bold text-slate-900 text-sm">
                              <SelectValue placeholder="Select Branch..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-white">
                              {branches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-400 font-medium ml-1">Branch assignment is required for internal users.</p>
                        </div>

                        <div className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                          form.is_team_lead 
                            ? "bg-brand-navy/5 border-brand-navy/10 shadow-sm" 
                            : "bg-slate-50/50 border-slate-100"
                        )}>
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                              form.is_team_lead ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20" : "bg-slate-100 text-slate-400"
                            )}>
                              <Icons.Help size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Assign as Team Lead</p>
                              <p className="text-[10px] text-slate-500 font-medium leading-tight">This user can view progress reports for their department.</p>
                            </div>
                          </div>
                          <Switch 
                            checked={form.is_team_lead} 
                            onCheckedChange={(checked) => set('is_team_lead', checked)} 
                            className="bg-slate-200 data-[state=checked]:bg-brand-navy"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-600 ml-1">External Organization Identity</Label>
                        <div className="relative group">
                          <Icons.Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input value={form.org_id} onChange={(e) => set('org_id', e.target.value)}
                            placeholder="Enter UUID of the client entity"
                            className="pl-9 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-mono text-xs"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium ml-1">Specifically for client portals (e.g. freight tracking).</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Sidebar */}
                <div className="space-y-6">
                  <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-6 lg:p-8 space-y-6 sticky top-24">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                       <Icons.File size={14} />
                       <h3 className="text-[10px] font-extrabold uppercase tracking-widest">Preview</h3>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-4">
                      <Avatar className="w-20 h-20 ring-8 ring-white shadow-xl">
                        <AvatarFallback className="bg-brand-navy text-white text-2xl font-black">
                          {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 leading-tight truncate px-4">{form.name || 'Anonymous Profile'}</h4>
                        <div className="flex items-center justify-center gap-2">
                           <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-widest">{form.user_type}</Badge>
                           {form.is_team_lead && <Badge className="bg-brand-gold text-brand-navy border-brand-navy text-[9px] font-bold uppercase tracking-widest">Lead</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Email</p>
                        <p className="text-xs font-medium text-slate-600 break-all">{form.email || 'pending assignment...'}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Assignment</p>
                        <p className="text-xs font-medium text-slate-600 truncate">
                          {form.user_type === 'client' 
                            ? 'Client Organization' 
                            : (departments.find(d => d.id === form.department_id)?.name || 'Department required')}
                        </p>
                        {form.user_type !== 'client' && (
                          <p className="text-xs font-medium text-slate-600 truncate mt-1">
                            {branches.find(b => b.id === form.branch_id)?.name || 'Branch required'}
                          </p>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-in slide-in-from-top-2">
                  <Icons.Alert size={18} />
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-10 border-t border-slate-100">
                 <Link href="/dashboard/admin" className="text-slate-400 hover:text-slate-900 transition-colors">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-1">
                      <Icons.Back size={10} /> Account Vault
                    </p>
                 </Link>
                 
                 <div className="flex items-center gap-4 w-full sm:w-auto">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading} className="h-12 px-6 font-bold text-slate-500 hover:text-slate-900 rounded-xl transition-all">
                      Discard
                    </Button>
                    <Button type="submit" disabled={loading} className="h-12 w-full sm:w-auto sm:px-12 bg-brand-navy text-white font-black rounded-2xl shadow-xl shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      {loading ? <Icons.Sync size={16} className="animate-spin mr-2" /> : 'Initial Validation'}
                      {!loading && <Icons.ChevronRight size={18} className="ml-2" />}
                    </Button>
                 </div>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
                 <div className="lg:col-span-2 space-y-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-1 bg-primary rounded-full" />
                          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Application Access Pool</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {apps.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                                <Icons.Apps size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 font-medium">No active modules found in the ecosystem.</p>
                            </div>
                          )}
                          {apps.map((app) => {
                            const selection = appSelections[app.slug];
                            const isEnabled = selection?.enabled ?? false;
                            const isAppAdmin = selection?.isAppAdmin ?? false;

                            return (
                              <div
                                key={app.slug}
                                className={cn(
                                  "relative p-5 rounded-3xl border-2 transition-all duration-300 group overflow-hidden",
                                  isEnabled ? "bg-primary/5 border-primary shadow-lg shadow-primary/5" : "bg-white border-slate-100 hover:border-slate-200"
                                )}
                              >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                  <div className="flex items-center gap-4">
                                    <div className={cn(
                                       "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm overflow-hidden",
                                       isEnabled ? "bg-white ring-4 ring-white shadow-primary/10" : "bg-slate-50"
                                    )}>
                                      {app.icon_url ? (
                                        <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <Icons.Apps size={20} className="text-slate-300" />
                                      )}
                                    </div>
                                    <div>
                                       <h4 className="text-sm font-black text-slate-900 leading-tight">{app.name}</h4>
                                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{app.slug}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => toggleApp(app.slug)}
                                    className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                      isEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                    )}
                                  >
                                    <Icons.Check size={14} className={cn("transition-transform", isEnabled ? "scale-100 opacity-100" : "scale-0 opacity-0")} />
                                  </button>
                                </div>

                                {isEnabled && form.user_type !== 'client' && (
                                  <div className="pt-4 border-t border-primary/10 flex items-center justify-between">
                                     <div>
                                        <p className="text-[9px] font-extrabold text-primary uppercase tracking-widest">Assign as App Admin</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Allow user to manage app settings.</p>
                                     </div>
                                     <Switch 
                                        checked={isAppAdmin} 
                                        onCheckedChange={() => toggleAppAdmin(app.slug)} 
                                        className="data-[state=checked]:bg-primary"
                                     />
                                  </div>
                                )}

                                {isEnabled && (
                                   <div className="absolute top-0 right-0 p-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                   </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                    </div>
                 </div>

                 {/* Sidebar / Assignment Summary */}
                 <div className="space-y-6 lg:sticky lg:top-24">
                    <div className="bg-brand-navy rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-brand-navy/20 relative overflow-hidden">
                       <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                       
                       <div className="flex items-center gap-2 mb-2 opacity-50">
                          <Icons.Settings size={14} />
                          <h3 className="text-[10px] font-extrabold uppercase tracking-widest">Security Configuration</h3>
                       </div>

                       <div className="space-y-1">
                          <p className="text-4xl font-black">{selectedAppsCount}</p>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Provisioned Modules</p>
                       </div>

                       <Separator className="bg-white/10" />

                       <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                          {apps.filter(a => appSelections[a.slug]?.enabled).length === 0 ? (
                            <p className="text-xs font-medium text-white/40 italic">No access provisioned yet.</p>
                          ) : (
                            apps.filter(a => appSelections[a.slug]?.enabled).map(a => (
                              <div key={a.slug} className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                                 <span className="text-xs font-bold truncate">{a.name}</span>
                                 {form.user_type !== 'client' && (
                                   <Badge className={cn(
                                     "text-[8px] font-black uppercase tracking-widest shadow-none px-1.5",
                                     appSelections[a.slug]?.isAppAdmin ? "bg-brand-gold text-brand-navy" : "bg-white/10 text-white border-white/20"
                                   )}>
                                      {appSelections[a.slug]?.isAppAdmin ? 'Admin' : 'Member'}
                                   </Badge>
                                 )}
                              </div>
                            ))
                          )}
                       </div>

                       <div className="pt-4 text-center">
                          <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">
                            Access rights can be audited or revoked at any time via the User Vault.
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                  <Icons.Alert size={18} />
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 border-t border-slate-100">
                 <Button variant="ghost" onClick={() => { setStep(1); setError(''); }} className="text-slate-400 hover:text-slate-900 transition-colors font-bold uppercase tracking-widest text-[10px]">
                    ← Identity Definition
                 </Button>
                 
                 <div className="flex items-center gap-4 w-full sm:w-auto">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading} className="h-12 px-6 font-bold text-slate-500 hover:text-slate-900 rounded-xl transition-all">
                      Discard
                    </Button>
                    <Button onClick={handleFinish} disabled={loading} className="h-12 w-full sm:w-auto sm:px-12 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      {loading ? <Icons.Sync size={16} className="animate-spin mr-2" /> : <Icons.Check size={16} className="mr-2" />}
                      Add User
                    </Button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </AdminLayout>
  );
}
