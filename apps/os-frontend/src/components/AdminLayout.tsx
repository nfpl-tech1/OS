'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { syncAllApps } from '@/lib/api';
import { Icons } from '@/components/shared/Icons';
import { SIDEBAR_W, HEADER_H, ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

function NavItem({ icon, label, href, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active 
          ? "bg-primary text-white shadow-sm shadow-primary/20" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <div className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </div>
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.user_type === 'admin';
  const [syncing, setSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSync() {
    try {
      setSyncing(true);
      const res = await syncAllApps();
      alert(`Success: ${res.departments} departments synced successfully.`);
    } catch (err) {
      alert('Sync failed. Please check your connection.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:fixed md:top-0 md:left-0 md:bottom-0 md:bg-white md:border-r md:border-slate-200 md:z-40 md:transition-all md:duration-300 md:ease-in-out md:block md:w-60"
      >
        <div className="flex items-center px-6 border-b border-slate-100" style={{ height: HEADER_H }}>
          <img src="/logo.png" alt="Nagarkot" className="h-8 w-auto object-contain" />
        </div>

        <nav className="flex flex-col gap-1 p-4 flex-1">
          <NavItem 
            icon={<Icons.Dashboard size={18} />} 
            label="Dashboard" 
            href="/dashboard" 
            active={pathname === '/dashboard'} 
          />
          {isAdmin && (
            <div className="space-y-1 mt-4">
              <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Administration</p>
              <NavItem 
                icon={<Icons.Apps size={18} />} 
                label="Applications" 
                href="/dashboard/admin/apps" 
                active={pathname.startsWith('/dashboard/admin/apps')} 
              />
              <NavItem 
                icon={<Icons.Departments size={18} />} 
                label="Departments" 
                href="/dashboard/admin/departments" 
                active={pathname.startsWith('/dashboard/admin/departments')} 
              />
              <NavItem 
                icon={<Icons.Users size={18} />} 
                label="User Management" 
                href="/dashboard/admin" 
                active={pathname === '/dashboard/admin' || (pathname.startsWith('/dashboard/admin/') && !pathname.startsWith('/dashboard/admin/apps') && !pathname.startsWith('/dashboard/admin/departments') && !pathname.startsWith('/dashboard/admin/audit-logs'))} 
              />
              <NavItem 
                icon={<Icons.Logs size={18} />} 
                label="System Logs" 
                href="/dashboard/admin/audit-logs" 
                active={pathname.startsWith('/dashboard/admin/audit-logs')} 
              />
            </div>
          )}
        </nav>

        <div className="mt-auto p-4 flex flex-col gap-2">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <Icons.Logout size={18} />
            Sign Out
          </button>
          
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100 mt-2">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Systems Online</span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full bg-white border-r border-slate-200 shadow-lg p-4">
            <div className="mb-4">
              <img src="/logo.png" alt="Nagarkot" className="h-8 w-auto object-contain" />
            </div>
            <nav className="flex flex-col gap-1">
              <NavItem icon={<Icons.Dashboard size={18} />} label="Dashboard" href="/dashboard" active={pathname === '/dashboard'} />
              {isAdmin && (
                <div className="space-y-1 mt-4">
                  <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Administration</p>
                  <NavItem icon={<Icons.Apps size={18} />} label="Applications" href="/dashboard/admin/apps" active={pathname.startsWith('/dashboard/admin/apps')} />
                  <NavItem icon={<Icons.Departments size={18} />} label="Departments" href="/dashboard/admin/departments" active={pathname.startsWith('/dashboard/admin/departments')} />
                  <NavItem icon={<Icons.Users size={18} />} label="User Management" href="/dashboard/admin" active={pathname === '/dashboard/admin' || (pathname.startsWith('/dashboard/admin/') && !pathname.startsWith('/dashboard/admin/apps') && !pathname.startsWith('/dashboard/admin/departments') && !pathname.startsWith('/dashboard/admin/audit-logs'))} />
                  <NavItem icon={<Icons.Logs size={18} />} label="System Logs" href="/dashboard/admin/audit-logs" active={pathname.startsWith('/dashboard/admin/audit-logs')} />
                </div>
              )}
            </nav>
          </aside>
          {/* Close button positioned on the overlay (outside the sidebar) to avoid overlapping logo */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm hover:bg-slate-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col flex-1",
        // apply left margin on md+ to account for the desktop sidebar width (240px = 60)
        "md:ml-60"
      )}>
        <header
          className="flex items-center justify-between px-6 sm:px-8 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30"
          style={{ height: HEADER_H }}
        >
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-md hover:bg-slate-100"
              aria-label="Open menu"
              style={{ marginLeft: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            {isAdmin && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="minimal-button flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
              >
                <Icons.Sync size={14} className={cn("text-primary", syncing && "animate-spin")} />
                {syncing ? 'Broadcasting...' : 'Broadcast Sync'}
              </button>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-4" style={{ marginRight: 0 }}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{ROLE_LABELS[user.user_type] || 'Member'}</p>
              </div>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary/20 overflow-hidden border-2 border-white ring-2 ring-primary/5">
                  {user.name.charAt(0).toUpperCase()}
                </div>
            </div>
          )}
        </header>

        <main className={cn(
          "flex-1 p-4 sm:p-8 transition-all duration-700 opacity-0 transform translate-y-4",
          mounted && "opacity-100 translate-y-0"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
