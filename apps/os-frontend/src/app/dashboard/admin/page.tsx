'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, updateUser, deleteUser, getApplications, getDepartments, getBranches } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import BulkImportModal from '@/components/BulkImportModal';
import { Icons } from '@/components/shared/Icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled' | 'deleted';
  created_at: string;
  userType: { slug: string; label: string };
  department?: { id: string; name: string };
  branch?: { id: string; name: string };
  organization?: { id: string; name: string };
}

interface App {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

interface Department {
  id: string;
  slug: string;
  name: string;
  default_apps?: { id: string; slug: string; name: string }[];
}

interface Branch {
  id: string;
  slug: string;
  name: string;
  default_apps?: { id: string; slug: string; name: string }[];
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (currentUser === undefined) return; // Wait for auth to initialize
    
    if (currentUser && currentUser.user_type !== 'admin') {
      router.push('/dashboard');
      return;
    }
    
    const loadData = async () => {
      try {
        const [u, a, d, b] = await Promise.all([
          getUsers(),
          getApplications(),
          getDepartments(),
          getBranches(),
        ]);
        setUsers(u);
        setApps(a);
        setDepartments(d);
        setBranches(b);
      } catch (error) {
        console.error("Failed to load admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      loadData();
    }
  }, [currentUser?.id, router]);

  async function toggleActive(u: User) {
    if (u.id === currentUser?.id) return;
    const prev = [...users];
    const newStatus = u.status === 'active' ? 'disabled' : 'active';
    setUsers(current => current.map(x =>
      x.id === u.id ? { ...x, status: newStatus } : x
    ));
    try {
      await updateUser(u.id, { status: newStatus });
    } catch {
      setUsers(prev);
      alert('Failed to update user status.');
    }
  }

  async function handleDelete(u: User) {
    if (u.id === currentUser?.id) return;
    if (!confirm(`Are you sure you want to permanently delete ${u.name}? This action cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch {
      alert('Failed to delete user.');
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

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
               <span className="text-slate-900 border-b border-brand-gold/30">User Vault</span>
            </nav>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">User Administration</h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Manage corporate identities, security access, and organizational hierarchy.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
                variant="outline" 
                onClick={() => setShowImport(true)}
                className="h-11 px-6 border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50"
            >
              <Icons.Sync size={14} className="mr-2" />
              Bulk Import Users
            </Button>
            <Link href="/dashboard/admin/new">
              <Button className="h-11 px-6 bg-brand-navy text-white font-black rounded-xl shadow-lg shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Icons.Plus size={16} className="mr-2" />
                Add User
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Total Users', value: users.length, icon: Icons.Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Internal Users', value: users.filter(u => u.userType.slug === 'employee' || u.userType.slug === 'admin').length, icon: Icons.Shakti, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Clients', value: users.filter(u => u.userType.slug === 'client').length, icon: Icons.Globe, color: 'text-brand-gold', bg: 'bg-brand-gold/5' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center justify-between shadow-sm">
               <div className="space-y-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
               </div>
               <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
                  <stat.icon size={20} />
               </div>
            </div>
          ))}
        </div>

        {/* Main Vault Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          {/* Internal Toolbar */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
             <div className="relative flex-1 max-w-md group">
                <Icons.Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Query names or system emails..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 rounded-2xl border-slate-200 focus:ring-primary/5 focus:border-primary font-medium text-slate-600 bg-white"
                />
             </div>
             <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                  {filtered.length} Units Found
                </p>
             </div>
          </div>

          {/* Table Implementation */}
          <div className="flex-1 overflow-x-auto">
            {/* Desktop table (md+) and mobile stacked list (sm) */}
            <div className="md:block hidden">
              <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8">Identity</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basic Info</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Security Profile</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organization</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Administrative Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-8 py-5">
                       <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                          <AvatarFallback className="bg-brand-navy text-white text-[10px] font-bold">
                            {u.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                       </Avatar>
                    </TableCell>

                    <TableCell>
                       <div className="space-y-0.5">
                          <p className="text-sm font-black text-slate-900 leading-tight">{u.name}</p>
                          <p className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]">{u.email}</p>
                       </div>
                    </TableCell>

                    <TableCell className="text-center">
                       <Badge variant="outline" className={cn(
                         "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5",
                         u.userType.slug === 'admin' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                         u.userType.slug === 'employee' ? "bg-blue-50 text-blue-600 border-blue-100" : 
                         "bg-brand-gold/10 text-brand-gold border-brand-gold/20"
                       )}>
                          {u.userType.label}
                       </Badge>
                    </TableCell>

                    <TableCell>
                       {u.department ? (
                         <Badge variant="outline" className="bg-slate-50 border-slate-100 text-slate-600 font-bold text-[10px]">
                           {u.department.name}
                         </Badge>
                       ) : (
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Unassigned</span>
                       )}
                    </TableCell>

                    <TableCell>
                       {u.branch ? (
                         <Badge variant="outline" className="bg-slate-50 border-slate-100 text-slate-600 font-bold text-[10px]">
                           {u.branch.name}
                         </Badge>
                       ) : (
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Unassigned</span>
                       )}
                    </TableCell>

                    <TableCell className="pr-8 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <Link href={`/dashboard/admin/${u.id}`}>
                           <Button size="sm" variant="outline" className="h-8 px-3 border-slate-200 text-primary font-bold text-[10px] rounded-lg bg-white hover:bg-primary hover:text-white transition-all">
                             Manage Access
                           </Button>
                         </Link>
                         
                         {u.id !== currentUser?.id && (
                           <>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => toggleActive(u)}
                               className={cn(
                                 "h-8 px-3 font-bold text-[10px] rounded-lg border-slate-200 shadow-sm transition-all",
                                 u.status === 'active' ? "text-emerald-600 hover:bg-emerald-500 hover:text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                               )}
                             >
                                {u.status === 'active' ? 'Active' : 'Disabled'}
                             </Button>

                             <Button
                               size="icon"
                               variant="outline"
                               onClick={() => handleDelete(u)}
                               className="h-8 w-8 rounded-lg border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                             >
                               <Icons.Trash size={12} />
                             </Button>
                           </>
                         )}
                         {u.id === currentUser?.id && (
                            <Badge className="bg-slate-100 text-slate-400 font-bold text-[9px] uppercase">Current User</Badge>
                         )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Mobile stacked list */}
            <div className="md:hidden block space-y-4">
              {filtered.map((u) => (
                <div key={u.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">{u.name.substring(0,2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 py-1">{u.userType.label}</Badge>
                    {u.department ? <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 py-1">{u.department.name}</Badge> : <span className="text-xs text-slate-300">Unassigned</span>}
                    {u.branch ? <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 py-1">{u.branch.name}</Badge> : null}
                    <Link href={`/dashboard/admin/${u.id}`}>
                      <Button size="sm" className="ml-2 h-8 px-3">Manage</Button>
                    </Link>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <Icons.Search size={32} />
                 </div>
                 <p className="text-slate-400 font-medium">No identities found matching query.</p>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BulkImportModal 
        isOpen={showImport} 
        apps={apps}
        departments={departments}
        branches={branches}
        onClose={() => setShowImport(false)} 
        onSuccess={() => {
          setShowImport(false);
          getUsers().then(setUsers);
        }}
      />
    </AdminLayout>
  );
}
