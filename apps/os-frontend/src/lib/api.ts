import axios from 'axios';

// const normalizeBase = (raw?: string) => {
//   if (!raw) return '';
//   const trimmed = raw.trim();
//   if (!trimmed) return '';
//   return trimmed.replace(/\/+$/, '');
// };

// const directBackendBase =
//   normalizeBase(process.env.NEXT_PUBLIC_OS_BACKEND_URL) || 'http://localhost:3001';

// type RetryableRequestConfig = InternalAxiosRequestConfig & {
//   __retryDirectBackend?: boolean;
// };

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookie on every request
});

// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const config = error?.config as RetryableRequestConfig | undefined;
//     const status = error?.response?.status;
//     const shouldRetryDirect =
//       !!config &&
//       !config.__retryDirectBackend &&
//       (status === 500 || !error.response);

//     if (!shouldRetryDirect) {
//       return Promise.reject(error);
//     }

//     config.__retryDirectBackend = true;
//     config.baseURL = directBackendBase;
//     if (typeof config.url === 'string' && config.url.startsWith('/api/')) {
//       config.url = config.url.replace(/^\/api/, '');
//     }

//     return axios.request(config);
//   },
// );

export default api;

// ─── Auth ─────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data; // { user, allowed_apps }
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getMe() {
  const res = await api.get('/users/me');
  return res.data; // { user, allowed_apps }
}

export async function getSsoToken(appSlug: string): Promise<string> {
  const res = await api.get(`/auth/sso-token?app=${appSlug}`);
  return res.data.sso_token;
}

// ─── Users (Admin) ────────────────────────────────────────────────

export async function getUsers() {
  const res = await api.get('/users');
  return res.data;
}

export async function getUser(id: string) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  user_type: 'employee' | 'client';
  company_email?: string;
  department_id?: string;
  org_id?: string;
  is_team_lead?: boolean;
}) {
  const res = await api.post('/users', data);
  return res.data;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    company_email?: string | null;
    password?: string;
    status?: 'active' | 'disabled' | 'deleted';
    is_team_lead?: boolean;
    department_id?: string | null;
  },
) {
  const res = await api.patch(`/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: string) {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}

export async function getUserAppAccess(id: string) {
  const res = await api.get(`/users/${id}/app-access`);
  return res.data;
}

export async function setAppAccess(
  userId: string,
  app_slug: string,
  is_enabled: boolean,
  is_app_admin?: boolean,
) {
  const res = await api.post(`/users/${userId}/app-access`, {
    app_slug,
    is_enabled,
    is_app_admin,
  });
  return res.data;
}

export async function setAppAdmin(
  userId: string,
  app_slug: string,
  is_app_admin: boolean,
) {
  const res = await api.post(`/users/${userId}/app-access`, {
    app_slug,
    is_enabled: true,   // keep existing access state
    is_app_admin,
  });
  return res.data;
}

// ─── Apps (Admin) ─────────────────────────────────────────────────
export async function getApplications() {
  const res = await api.get('/users/applications');
  return res.data as Array<{ id: string; slug: string; name: string; url: string; icon_url: string | null }>;
}
export async function getApps() {
  const res = await api.get('/apps');
  return res.data as Array<{
    id: string;
    slug: string;
    name: string;
    url: string;
    icon_url: string | null;
    webhook_url: string | null;
    is_active: boolean;
  }>;
}

export async function createApp(data: { slug: string; name: string; url: string; is_active?: boolean; webhook_url?: string }) {
  const res = await api.post('/apps', data);
  return res.data as { id: string; slug: string; name: string; url: string; icon_url: string | null; is_active: boolean };
}

export async function updateApp(
  id: string,
  data: { name?: string; url?: string; is_active?: boolean; webhook_url?: string | null },
) {
  const res = await api.patch(`/apps/${id}`, data);
  return res.data;
}

export async function deleteApp(id: string) {
  const res = await api.delete(`/apps/${id}`);
  return res.data;
}

export async function uploadAppImage(id: string, blob: Blob, filename = 'image.jpg') {
  const formData = new FormData();
  formData.append('file', blob, filename);
  const res = await api.post(`/apps/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as { id: string; icon_url: string | null };
}

export async function bulkCreateUsers(users: {
  email: string;
  password: string;
  name: string;
  user_type: 'employee' | 'client';
  department_id?: string;
  org_id?: string;
  is_team_lead?: boolean;
  app_slugs?: string[];
  admin_app_slugs?: string[];
}[]) {
  const res = await api.post('/users/bulk', { users });
  return res.data as {
    results: { email: string; id: string }[];
    errors: { email: string; error: string }[];
  };
}

// ─── Departments (Admin) ──────────────────────────────────────────
export async function getDepartments() {
  const res = await api.get('/users/departments');
  return res.data as Array<{
    id: string;
    slug: string;
    name: string;
    default_apps: { id: string; slug: string; name: string }[];
  }>;
}

export async function createDepartment(name: string) {
  const res = await api.post('/users/departments', { name });
  return res.data;
}

export async function updateDepartment(id: string, name: string) {
  const res = await api.patch(`/users/departments/${id}`, { name });
  return res.data;
}

export async function deleteDepartment(id: string) {
  const res = await api.delete(`/users/departments/${id}`);
  return res.data;
}

export async function getDepartmentDefaultApps(deptId: string) {
  const res = await api.get(`/users/departments/${deptId}/default-apps`);
  return res.data as Array<{ id: string; slug: string; name: string }>;
}

export async function addDepartmentDefaultApp(deptId: string, appId: string) {
  const res = await api.post(`/users/departments/${deptId}/default-apps`, { app_id: appId });
  return res.data;
}

export async function removeDepartmentDefaultApp(deptId: string, appId: string) {
  const res = await api.delete(`/users/departments/${deptId}/default-apps/${appId}`);
  return res.data;
}

// ─── Branches (Admin) ──────────────────────────────────────────
export async function getBranches() {
  const res = await api.get('/users/branches');
  return res.data as Array<{
    id: string;
    slug: string;
    name: string;
    default_apps: { id: string; slug: string; name: string }[];
  }>;
}

export async function createBranch(name: string) {
  const res = await api.post('/users/branches', { name });
  return res.data;
}

export async function updateBranch(id: string, name: string) {
  const res = await api.put(`/users/branches/${id}`, { name });
  return res.data;
}

export async function deleteBranch(id: string) {
  const res = await api.delete(`/users/branches/${id}`);
  return res.data;
}

export async function getBranchDefaultApps(branchId: string) {
  const res = await api.get(`/users/branches/${branchId}/default-apps`);
  return res.data as Array<{ id: string; slug: string; name: string }>;
}

export async function addBranchDefaultApp(branchId: string, appId: string) {
  const res = await api.post(`/users/branches/${branchId}/default-apps`, { app_id: appId });
  return res.data;
}

export async function removeBranchDefaultApp(branchId: string, appId: string) {
  const res = await api.delete(`/users/branches/${branchId}/default-apps/${appId}`);
  return res.data;
}

// ─── Audit Logs (Admin) ──────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export async function getAuditLogs(params?: {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get('/audit-logs', { params });
  return res.data as { total: number; rows: AuditLogEntry[] };
}

export async function syncAllApps() {
  const res = await api.post('/users/sync-all');
  return res.data;
}
