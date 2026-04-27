"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getAuditLogs, AuditLogEntry, getUsers, getDepartments } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { Icons } from '@/components/shared/Icons';

const PAGE_SIZE = 50;

const ACTION_MAP: Record<string, { label: string; bg: string; color: string }> = {
  'user.created': { label: 'User Created', bg: '#F0FDF4', color: '#16A34A' },
  'user.updated': { label: 'User Updated', bg: '#EFF6FF', color: '#2563EB' },
  'user.status.changed': { label: 'Status Changed', bg: '#FFF7ED', color: '#EA580C' },
  'user.deleted': { label: 'User Deleted', bg: '#FEF2F2', color: '#DC2626' },
  'app_access.granted': { label: 'Access Granted', bg: '#F0FDF4', color: '#16A34A' },
  'app_access.revoked': { label: 'Access Revoked', bg: '#FEF2F2', color: '#DC2626' },
  'department.created': { label: 'Dept Created', bg: '#F0FDF4', color: '#16A34A' },
  'department.updated': { label: 'Dept Updated', bg: '#EFF6FF', color: '#2563EB' },
  'department.deleted': { label: 'Dept Deleted', bg: '#FEF2F2', color: '#DC2626' },
  'department.default_app.added': { label: 'App Added', bg: '#F0FDF4', color: '#16A34A' },
  'department.default_app.removed': { label: 'App Removed', bg: '#FFF7ED', color: '#EA580C' },
};

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_MAP[action] ?? { label: action, bg: '#F1F5F9', color: '#475569' };
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}

function HumanizedChanges({ before, after }: { before: any; after: any }) {
  const hasBefore = before && Object.keys(before).length > 0;
  const hasAfter = after && Object.keys(after).length > 0;

  if (!hasBefore && !hasAfter) return <span className="text-slate-300">—</span>;

  // For updates, we only want to show the specific fields that changed
  if (hasBefore && hasAfter) {
    const changes = Object.keys(after).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    return (
      <div className="flex flex-wrap gap-2 text-[11px]">
        {changes.map(k => {
          const bValue = before[k];
          const aValue = after[k];
          // Format boolean to string for readability
          const formatVal = (v: any) => v === true ? 'Yes' : v === false ? 'No' : String(v);

          return (
            <div key={k} className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
              <span className="font-bold text-slate-400 lowercase mr-1.5">{k.replace(/_/g, ' ')}:</span>
              <span className="text-slate-400 line-through mr-1">{formatVal(bValue)}</span>
              <span className="text-blue-600 font-semibold">{formatVal(aValue)}</span>
            </div>
          )
        })}
      </div>
    );
  }

  // For creation or pure data display
  const obj = after || before;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {Object.entries(obj).map(([k, v]) => (
        <span key={k} className="inline-flex gap-1.5 items-center">
          <span className="font-bold text-slate-400 lowercase">{k.replace(/_/g, ' ')}:</span>
          <span className="text-slate-600 font-medium">{v === true ? 'Yes' : v === false ? 'No' : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

const ENTITY_TYPES = ['', 'user', 'department'];

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name || u.email])), [users]);
  const deptMap = useMemo(() => new Map(depts.map(d => [d.id, d.name])), [depts]);

  const [filterEntity, setFilterEntity] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');

  const load = useCallback(async (off: number, entity_type: string, entity_id: string) => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        limit: PAGE_SIZE,
        offset: off,
        entity_type: entity_type || undefined,
        entity_id: entity_id || undefined,
      });
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (user && user.user_type !== 'admin') { router.push('/dashboard'); return; }

    if (user) {
      // Fetch lookups
      getUsers().then(setUsers).catch(() => { });
      getDepartments().then(setDepts).catch(() => { });

      load(0, filterEntity, filterEntityId);
    }
  }, [user?.id, router, load, filterEntity, filterEntityId]);

  function getEntityDisplayName(type: string | null, id: string | null) {
    if (!id) return '—';
    if (type === 'user') return userMap.get(id) || id.slice(0, 8) + '…';
    if (type === 'department') return deptMap.get(id) || id.slice(0, 8) + '…';
    return id.slice(0, 8) + '…';
  }

  function applyFilters() {
    const id = entityIdInput.trim();
    setFilterEntityId(id);
    setOffset(0);
    load(0, filterEntity, id);
  }

  function clearFilters() {
    setFilterEntity('');
    setFilterEntityId('');
    setEntityIdInput('');
    setOffset(0);
    load(0, '', '');
  }

  function goPage(next: number) {
    setOffset(next);
    load(next, filterEntity, filterEntityId);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (loading && rows.length === 0) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4">
            <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
               <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
               <Icons.ChevronRight size={10} />
               <span className="text-slate-900 border-b border-brand-gold/30">System Logs</span>
            </nav>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Security Audit</h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Trace system-wide administrative actions and configuration changes.</p>
            </div>
          </div>
          
          <div className="h-11 flex items-center px-4 bg-white rounded-xl border border-slate-200 shadow-sm">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
               {total.toLocaleString()} Events Logged
             </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 items-end">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Category</label>
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="text-sm rounded-lg border px-3 py-2.5 bg-white outline-none font-bold shadow-sm w-full sm:w-auto"
              style={{ borderColor: '#E2E8F0', color: '#1a202c', minWidth: 160 }}
            >
              <option value="">All Categories</option>
              {ENTITY_TYPES.filter(Boolean).map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Item ID</label>
            <input
              type="text"
              placeholder="Paste ID here…"
              value={entityIdInput}
              onChange={e => setEntityIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="text-sm rounded-lg border px-3 py-2.5 bg-white outline-none font-mono shadow-sm w-full sm:w-[260px]"
              style={{ borderColor: '#E2E8F0', color: '#1a202c' }}
            />
          </div>

          <div className="flex gap-2">
            <button
            onClick={applyFilters}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity"
            style={{ backgroundColor: '#1B3A6C' }}
          >
            Filter
          </button>
            {(filterEntity || filterEntityId) && (
              <button
                onClick={clearFilters}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ color: '#64748B', border: '1px solid #E2E8F0' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table (desktop) / Stacked list (mobile) */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: '#94A3B8' }}>No audit events found.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  {['Timestamp', 'Action', 'Category', 'Modified Item', 'Performed By', 'Detailed Changes'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: '#94A3B8' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: i < rows.length - 1 ? '1px solid #F1F5F9' : undefined,
                        }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: '#64748B' }}>
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ActionBadge action={row.action} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs capitalize font-medium" style={{ color: '#475569' }}>
                          {row.entity_type ?? '—'}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-xs font-semibold truncate block text-slate-700" title={row.entity_id ?? ''}>
                            {getEntityDisplayName(row.entity_type, row.entity_id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <span className="text-xs truncate block text-slate-500 font-medium" title={row.actor_id}>
                            {userMap.get(row.actor_id) || row.actor_id.slice(0, 8) + '…'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <HumanizedChanges before={row.before} after={row.after} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked list */}
              <div className="md:hidden p-3 space-y-3">
                {rows.map(row => (
                  <div key={row.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="text-xs font-mono text-slate-500">{formatDate(row.created_at)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <ActionBadge action={row.action} />
                            <div className="text-xs text-slate-500 capitalize">{row.entity_type ?? '—'}</div>
                          </div>
                          <div className="text-xs text-slate-500">{userMap.get(row.actor_id) || row.actor_id.slice(0,8) + '…'}</div>
                        </div>

                        <div className="mt-2">
                          <div className="text-[13px] font-semibold text-slate-800 truncate">{getEntityDisplayName(row.entity_type, row.entity_id)}</div>
                          <div className="mt-2 text-[12px] text-slate-600">
                            <HumanizedChanges before={row.before} after={row.after} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goPage(offset - PAGE_SIZE)}
                disabled={offset === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => goPage(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
