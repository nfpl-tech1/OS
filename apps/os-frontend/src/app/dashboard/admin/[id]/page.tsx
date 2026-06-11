'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getUser,
  getUserAppAccess,
  setAppAccess,
  setAppAdmin,
  getApplications,
  getDepartments,
  getBranches,
  updateUser,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

interface AccessRecord {
  app_slug: string;
  app_name: string;
  is_enabled: boolean;
  is_app_admin: boolean;
  granted_at: string;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const isSelf = currentUser?.id === id;
  const [user, setUser] = useState<{
    name: string;
    email: string;
    company_email?: string;
    status: 'active' | 'disabled' | 'deleted';
    userType: { label: string; slug: string };
    department: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
    is_team_lead: boolean;
  } | null>(null);
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [allApps, setAllApps] = useState<{ slug: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editCompanyEmail, setEditCompanyEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    Promise.all([getUser(id), getUserAppAccess(id), getApplications(), getDepartments(), getBranches()])
      .then(([u, a, apps, departmentOptions, branchOptions]) => {
        setUser(u);
        setEditEmail(u.email);
        setEditCompanyEmail(u.company_email || '');
        setEditDepartmentId(u.department?.id || '');
        setEditBranchId(u.branch?.id || '');
        setAccess(a);
        setAllApps(apps);
        setDepartments(departmentOptions);
        setBranches(branchOptions);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleAccess(slug: string, currentlyEnabled: boolean) {
    const prev = [...access];
    setIsLoading(slug);
    try {
      await setAppAccess(id, slug, !currentlyEnabled);
      setAccess((current) => {
        const exists = current.find((a) => a.app_slug === slug);
        if (exists) {
          return current.map((a) =>
            a.app_slug === slug ? { ...a, is_enabled: !currentlyEnabled } : a,
          );
        }
        return [
          ...current,
          {
            app_slug: slug,
            app_name: allApps.find((a) => a.slug === slug)?.name ?? slug,
            is_enabled: true,
            is_app_admin: false,
            granted_at: new Date().toISOString(),
          },
        ];
      });
    } catch {
      setAccess(prev); // rollback
    } finally {
      setIsLoading(null);
    }
  }

  async function toggleAppAdmin(slug: string, currentlyAdmin: boolean) {
    const prev = [...access];
    setIsLoading(slug + '_admin');
    try {
      await setAppAdmin(id, slug, !currentlyAdmin);
      setAccess((current) =>
        current.map((a) =>
          a.app_slug === slug ? { ...a, is_app_admin: !currentlyAdmin } : a,
        ),
      );
    } catch {
      setAccess(prev); // rollback
    } finally {
      setIsLoading(null);
    }
  }

  async function toggleTeamLead() {
    if (!user) return;
    const prev = user.is_team_lead;
    setUser((u) => u ? { ...u, is_team_lead: !u.is_team_lead } : u);
    try {
      await updateUser(id, { is_team_lead: !prev });
    } catch {
      setUser((u) => u ? { ...u, is_team_lead: prev } : u);
    }
  }

  async function saveCredentials() {
    if (!editEmail.trim()) { setEditError('Email cannot be empty.'); return; }
    if (editPassword && editPassword.length < 8) { setEditError('Password must be at least 8 characters.'); return; }
    if (user?.userType?.slug !== 'client' && !editDepartmentId) {
      setEditError('Internal users must have a department assigned.');
      return;
    }
    if (user?.userType?.slug !== 'client' && !editBranchId) {
      setEditError('Internal users must have a branch assigned.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const payload: {
        email?: string;
        company_email?: string | null;
        password?: string;
        department_id?: string | null;
        branch_id?: string | null;
      } = {};
      if (editEmail !== user?.email) payload.email = editEmail.trim();
      if (editCompanyEmail !== (user?.company_email || '')) {
         payload.company_email = editCompanyEmail.trim() || null;
      }
      if (editDepartmentId !== (user?.department?.id || '')) {
        payload.department_id = editDepartmentId || null;
      }
      if (editBranchId !== (user?.branch?.id || '')) {
        payload.branch_id = editBranchId || null;
      }
      if (editPassword) payload.password = editPassword;
      if (
        !payload.email &&
        payload.company_email === undefined &&
        payload.department_id === undefined &&
        payload.branch_id === undefined &&
        !payload.password
      ) {
        setEditOpen(false);
        setEditSaving(false);
        return;
      }
      const updated = await updateUser(id, payload);
      setUser((u) =>
        u
          ? {
              ...u,
              email: updated.email,
              company_email: updated.company_email || '',
              department: updated.department ?? null,
              branch: updated.branch ?? null,
            }
          : u,
      );
      setEditPassword('');
      setEditOpen(false);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setEditError(apiError?.response?.data?.message ?? 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  }

  function isEnabled(slug: string) {
    const record = access.find((a) => a.app_slug === slug);
    return record?.is_enabled ?? false;
  }

  function isAppAdmin(slug: string) {
    const record = access.find((a) => a.app_slug === slug);
    return record?.is_app_admin ?? false;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f7fa' }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
      <header className="bg-white border-b flex items-center gap-4 px-8 py-4" style={{ borderColor: '#e2e8f0' }}>
        <Link href="/dashboard/admin" className="text-sm" style={{ color: '#718096' }}>
          ← Back
        </Link>
        <span style={{ color: '#e2e8f0' }}>|</span>
        <h1 className="text-sm font-semibold" style={{ color: '#1a202c' }}>
          {user?.name} — App Access
        </h1>
      </header>

      <main className="px-8 py-8 max-w-lg mx-auto">
        {/* User info */}
        <div className="bg-white rounded-xl p-5 mb-6" style={{ border: '1px solid #e2e8f0' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: '#1a202c' }}>{user?.name}</p>
              <p className="text-sm mt-0.5 truncate" style={{ color: '#718096' }}>{user?.email}</p>
              {user?.company_email && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>📧 {user.company_email}</p>
              )}
            </div>
            {!isSelf && (
              <button
                onClick={() => {
                  setEditOpen(o => !o);
                  setEditError('');
                  setEditPassword('');
                  setEditEmail(user?.email ?? '');
                  setEditCompanyEmail(user?.company_email || '');
                  setEditDepartmentId(user?.department?.id || '');
                  setEditBranchId(user?.branch?.id || '');
                }}
                className="text-xs px-2.5 py-1 rounded-lg shrink-0"
                style={{ border: '1px solid #E2E8F0', color: '#1B3A6C', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {editOpen ? 'Cancel' : 'Edit'}
              </button>
            )}
          </div>

          {/* Inline credential editor */}
          {editOpen && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
                    style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>Company Email <span style={{ color: '#94A3B8', fontWeight: 400 }}>(for notifications)</span></label>
                  <input
                    type="email"
                    value={editCompanyEmail}
                    onChange={e => setEditCompanyEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
                    style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                  />
                </div>
                {user?.userType?.slug !== 'client' && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>Department</label>
                    <select
                      value={editDepartmentId}
                      onChange={e => setEditDepartmentId(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
                      style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                    >
                      <option value="" disabled>Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {user?.userType?.slug !== 'client' && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>Branch</label>
                    <select
                      value={editBranchId}
                      onChange={e => setEditBranchId(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
                      style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                    >
                      <option value="" disabled>Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>New Password <span style={{ color: '#94A3B8', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
                    style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                  />
                </div>
                {editError && <p className="text-xs" style={{ color: '#EF4444' }}>{editError}</p>}
                <button
                  onClick={saveCredentials}
                  disabled={editSaving}
                  className="w-full text-sm py-2 rounded-lg font-medium text-white"
                  style={{ backgroundColor: editSaving ? '#94A3B8' : '#1B3A6C', cursor: editSaving ? 'not-allowed' : 'pointer', border: 'none' }}
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
              {user?.userType?.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              user?.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {user?.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            {user?.department && (
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                {user.department.name}
              </span>
            )}
            {user?.branch && (
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                {user.branch.name}
              </span>
            )}
          </div>
          {user?.userType?.slug !== 'admin' && (
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Team Lead</span>
              <button
                onClick={toggleTeamLead}
                className="relative rounded-full transition-colors duration-200 cursor-pointer"
                style={{
                  width: 36,
                  height: 20,
                  backgroundColor: user?.is_team_lead ? '#1B3A6C' : '#CBD5E1',
                  border: 'none',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'transform 0.2s',
                    transform: user?.is_team_lead ? 'translateX(16px)' : 'translateX(0)',
                  }}
                />
              </button>
            </div>
          )}
        </div>

        {/* App access toggles */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest mb-4 font-medium" style={{ color: '#718096' }}>
            Application Access
          </p>
          {isSelf && (
            <div className="rounded-xl px-5 py-4 text-sm" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
              You cannot manage your own app access.
            </div>
          )}
          {!isSelf && allApps.map((app) => {
            const enabled = isEnabled(app.slug);

            return (
              <div
                key={app.slug}
                className="bg-white flex items-center justify-between rounded-xl px-5 py-4"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <span className="text-sm font-medium" style={{ color: '#1a202c' }}>{app.name}</span>

                <div className="flex items-center gap-6">
                  {/* App Admin toggle — only shown when app is enabled */}
                  {enabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>App Admin</span>
                      <button
                        onClick={() => toggleAppAdmin(app.slug, isAppAdmin(app.slug))}
                        disabled={isLoading === app.slug + '_admin'}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                          isLoading === app.slug + '_admin' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{ backgroundColor: isAppAdmin(app.slug) ? '#D97706' : '#cbd5e0' }}
                      >
                        <span className={`
                          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
                          transition-transform duration-200
                          ${isAppAdmin(app.slug) ? 'translate-x-4' : 'translate-x-0'}
                        `} />
                      </button>
                    </div>
                  )}

                  {/* Enable/Disable toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#94A3B8' }}>Access</span>
                    <button
                      onClick={() => toggleAccess(app.slug, enabled)}
                      disabled={isLoading === app.slug}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        isLoading === app.slug ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{ backgroundColor: enabled ? '#1B3A6C' : '#cbd5e0' }}
                    >
                      <span className={`
                        absolute top-1 left-1 w-4 h-4 rounded-full bg-white
                        transition-transform duration-200
                        ${enabled ? 'translate-x-5' : 'translate-x-0'}
                      `} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
