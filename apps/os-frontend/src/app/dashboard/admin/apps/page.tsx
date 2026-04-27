'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { deleteApp, getApps, updateApp } from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Icons } from '@/components/shared/Icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface App {
  id: string;
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
  is_active: boolean;
}

export default function AdminAppsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;
    if (user && user.user_type !== 'admin') {
      router.push('/dashboard');
      return;
    }
    if (user) {
      getApps()
        .then(setApps)
        .finally(() => setLoading(false));
    }
  }, [user?.id, router]);

  async function toggleActive(app: App) {
    setToggling(app.id);
    try {
      await updateApp(app.id, { is_active: !app.is_active });
      setApps((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, is_active: !app.is_active } : a,
        ),
      );
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(app: App) {
    const confirmed = window.confirm(`Permanently remove ${app.name}? This will revoke access for all assigned users and departments.`);
    if (!confirmed) return;

    setDeleting(app.id);
    try {
      await deleteApp(app.id);
      setApps((prev) => prev.filter((item) => item.id !== app.id));
    } finally {
      setDeleting(null);
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
               <span className="text-slate-900 border-b border-brand-gold/30">Ecosystem</span>
            </nav>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Application Ecosystem</h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Provision and bridge decentralized operational software modules.</p>
            </div>
          </div>
          
          <Link href="/dashboard/admin/apps/new">
            <Button className="h-11 px-6 bg-brand-navy text-white font-black rounded-xl shadow-lg shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <Icons.Plus size={16} className="mr-2" />
              Add Application
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 md:hidden">
            {/* Mobile stacked list */}
            <div className="space-y-4">
              {apps.map(app => (
                <div key={app.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-slate-100">
                    {app.icon_url ? <img src={app.icon_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300"><Icons.Apps size={20} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{app.name}</p>
                    <p className="text-[12px] text-slate-500 truncate">{app.slug}</p>
                    <p className="text-xs text-indigo-600 truncate mt-1">{app.url}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={cn("text-xs font-bold", app.is_active ? "text-emerald-600" : "text-slate-400")}>{app.is_active ? 'Online' : 'Offline'}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <Link href={`/dashboard/admin/apps/${app.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 px-3 text-xs font-bold">Settings</Button>
                        </Link>
                        <button onClick={() => toggleActive(app)} className="text-xs text-slate-500">{app.is_active ? 'Make Offline' : 'Make Online'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {apps.length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Icons.Apps size={28} className="text-slate-200" />
                  </div>
                  <p className="text-slate-900 font-bold text-lg">Empty Ecosystem</p>
                  <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto mb-8 font-medium">
                    Register your first internal application to start bridging decentralized operations.
                  </p>
                  <Link href="/dashboard/admin/apps/new">
                    <Button className="h-10 px-6 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['Icon', 'Module Name', 'Service ID', 'Access Endpoint', 'Status', 'Configuration'].map((h, i) => (
                    <th key={h} className={cn(
                      "text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400",
                      i === 5 && "text-right"
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {apps.map(app => (
                  <tr key={app.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      {app.icon_url ? (
                        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-slate-100 group-hover:ring-primary/20 transition-all shadow-sm">
                          <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-primary/40 group-hover:border-primary/20 transition-all">
                          <Icons.Apps size={20} />
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{app.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Corporate Module</p>
                    </td>

                    <td className="px-6 py-5">
                      <code className="text-[11px] px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-mono">
                        {app.slug}
                      </code>
                    </td>

                    <td className="px-6 py-5">
                      <p className="text-xs text-indigo-600 font-medium hover:underline truncate max-w-[200px]">
                        {app.url}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse",
                          app.is_active ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className={cn(
                          "text-xs font-bold",
                          app.is_active ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {app.is_active ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/admin/apps/${app.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 px-4 text-xs font-bold text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg border border-slate-100 transition-all shadow-sm">
                            Settings
                          </Button>
                        </Link>
                        <div className="w-px h-3 bg-slate-200" />
                        <button 
                          onClick={() => toggleActive(app)}
                          disabled={!!toggling}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest px-2 disabled:opacity-50"
                        >
                          {app.is_active ? 'Offline' : 'Online'}
                        </button>
                        <button 
                          onClick={() => handleDelete(app)}
                          disabled={!!deleting}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Icons.Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
