'use client';

import { useAuth } from '@/context/AuthContext';
import { getSsoToken } from '@/lib/api';
import { AppTile } from '@/lib/auth.types';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { Icons } from '@/components/shared/Icons';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

const APP_META: Record<string, { icon: React.ReactNode; bg: string; fg: string }> = {
  shakti:       { icon: <Icons.Shakti size={24} />,   bg: '#F5F3FF', fg: '#7C3AED' },
  superfreight: { icon: <Icons.Freight size={24} />,  bg: '#EFF6FF', fg: '#1D4ED8' },
  tez:          { icon: <Icons.Check size={24} />,    bg: '#F0F9FF', fg: '#0C4A6E' },
  trainings:    { icon: <Icons.Training size={24} />, bg: '#ECFDF5', fg: '#065F46' },
};

function AppCard({ app, onClick, loading }: { app: AppTile; onClick: () => void; loading: boolean }) {
  const meta = APP_META[app.slug] ?? { icon: <Icons.Apps size={24} />, bg: '#F8FAFC', fg: '#1B3A6C' };
  
  return (
    <Card className="group relative overflow-hidden border-slate-200/60 hover:border-primary/30 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(27,58,108,0.12)] pt-0 bg-white rounded-[2rem]">
      {/* Visual Workspace Identity */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-slate-900">
        {/* Scrim/Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        
        {app.icon_url ? (
          <img 
            src={app.icon_url} 
            alt={app.name} 
            className="relative z-0 w-full h-full object-cover transition-all duration-1000 group-hover:scale-110" 
          />
        ) : (
          <div 
            className="relative z-0 w-full h-full flex items-center justify-center transition-all duration-1000 group-hover:scale-110"
            style={{ 
              background: `linear-gradient(135deg, ${meta.bg} 0%, #ffffff 100%)`, 
              color: meta.fg 
            }}
          >
            <div className="p-4 rounded-3xl bg-white/90 backdrop-blur-md shadow-2xl shadow-black/5 ring-1 ring-black/5 group-hover:scale-105 transition-all duration-500">
              {meta.icon}
            </div>
          </div>
        )}

        {/* Status Indicator Overlays */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
           <Badge className="bg-white/90 backdrop-blur-sm text-slate-900 border-none text-[9px] font-black uppercase tracking-tighter px-2 h-5 shadow-sm">
             {app.slug}
           </Badge>
        </div>

        <div className="absolute top-4 right-4 z-20">
           <div className="flex items-center gap-1.5 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[8px] font-black text-white uppercase tracking-widest">Live</span>
           </div>
        </div>
      </div>

      <CardHeader className="p-6 pb-0">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black text-slate-900 tracking-tight group-hover:text-primary transition-colors duration-300">
            {app.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Icons.Globe size={10} className="text-slate-300" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">
              {app.url.replace(/^https?:\/\//, '')}
            </span>
          </div>
        </div>
        {/* <CardDescription className="text-xs font-medium text-slate-500 leading-relaxed mt-3 line-clamp-2">
          Enterprise modular interface for {app.name} operations and secure data synchronization.
        </CardDescription> */}
      </CardHeader>

      <CardFooter className="p-6">
        <Button 
          className="w-full h-12 text-xs font-black bg-slate-900 hover:bg-primary text-white shadow-2xl shadow-slate-200 hover:shadow-primary/30 transition-all duration-300 rounded-xl active:scale-[0.98] group/btn"
          onClick={onClick}
          disabled={loading}
        >
          {loading ? (
            <Icons.Sync size={16} className="animate-spin" />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="tracking-tight">Open App</span>
              <Icons.ChevronRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
            </div>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, allowed_apps, loading } = useAuth();
  const [launchingSlug, setLaunchingSlug] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  async function handleTileClick(app: AppTile) {
    if (launchingSlug) return;
    if (app.slug === 'shakti') { window.open(app.url, '_blank'); return; }
    setLaunchingSlug(app.slug);
    try {
      const sso_token = await getSsoToken(app.slug);
      window.location.assign(`${app.url}/sso?token=${sso_token}`);
    } catch (err) {
      console.error('SSO launch failed', err);
      setLaunchingSlug(null);
    }
  }

  if (loading || !user) return null;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, <span className="text-primary">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Manage your workspace and access synchronized operational tools.
          </p>
        </header>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Available Applications</h2>
            <div className="h-px flex-1 bg-slate-200 ml-6" />
          </div>

          {allowed_apps.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allowed_apps.map(app => (
                <AppCard 
                  key={app.slug} 
                  app={app} 
                  onClick={() => handleTileClick(app)} 
                  loading={launchingSlug === app.slug} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Apps size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-900 font-bold">No Applications Assigned</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                Your account hasn't been granted access to any operational modules yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
