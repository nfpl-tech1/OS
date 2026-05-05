import * as XLSX from 'xlsx';

export type AppCellState = 'none' | 'access' | 'admin';

export interface App {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  default_apps?: { id: string; slug: string; name: string }[];
}

export interface BulkRow {
  _id: string;
  name: string;
  email: string;
  company_email: string;
  password: string;
  user_type: 'employee' | 'client';
  department_id: string;
  is_team_lead: boolean;
  apps: Record<string, AppCellState>; // keyed by app slug
}

export interface ImportResult {
  results: { email: string; id: string }[];
  errors: { email: string; error: string }[];
}

let _uid = 0;
export function uid(): string {
  return `row-${++_uid}-${Date.now()}`;
}

export function cycleState(s: AppCellState): AppCellState {
  if (s === 'none') return 'access';
  if (s === 'access') return 'admin';
  return 'none';
}

export function validateRow(row: BulkRow, allRows: BulkRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!row.name.trim()) errors.name = 'Name required';
  if (!row.email.trim()) {
    errors.email = 'Email required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.email = 'Invalid email';
  } else {
    const dups = allRows.filter(
      (r) => r._id !== row._id && r.email.trim().toLowerCase() === row.email.trim().toLowerCase(),
    );
    if (dups.length > 0) errors.email = 'Duplicate email';
  }
  if (!row.password) {
    errors.password = 'Password required';
  } else if (row.password.length < 8) {
    errors.password = 'Min 8 chars';
  }
  if (row.company_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.company_email.trim())) {
    errors.company_email = 'Invalid email';
  }
  if (row.user_type !== 'client' && !row.department_id) {
    errors.department_id = 'Department required';
  }
  return errors;
}

export function buildDefaultApps(
  departmentId: string,
  departments: Department[],
): Record<string, AppCellState> {
  if (!departments) return {};
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return {};
  const result: Record<string, AppCellState> = {};
  for (const app of dept.default_apps ?? []) {
    result[app.slug] = 'access';
  }
  return result;
}

export function downloadTemplate() {
  const csv = [
    'name,email,company_email,password,user_type,department_name,is_team_lead',
    'John Doe,john.doe@example.com,internal.john@company.com,SecurePass123,employee,Technology,no',
    'Jane Smith,jane.smith@example.com,,SecurePass123,employee,Accounts,no',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-users-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseFile(
  file: File,
  departments: Department[],
): Promise<BulkRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (raw.length === 0) {
    throw new Error('The file is empty or has no data rows');
  }

  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/[\s-]+/g, '_');

  return raw.map((r) => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      row[normalize(k)] = String(v ?? '').trim();
    }

    const typeRaw = (row['user_type'] || row['type'] || 'employee').toLowerCase();
    const user_type: 'employee' | 'client' = typeRaw === 'client' ? 'client' : 'employee';

    const deptRaw = (row['department_name'] || row['department'] || '').toLowerCase().trim();
    const deptSlug = deptRaw.replace(/\s+/g, '-');
    const dept = departments?.find(
      (d) =>
        d.name.toLowerCase() === deptRaw ||
        d.slug === deptRaw ||
        d.slug === deptSlug ||
        (deptRaw.length >= 2 && d.name.toLowerCase().includes(deptRaw)) ||
        (deptRaw.length >= 2 && deptRaw.includes(d.name.toLowerCase())),
    );
    const department_id = dept?.id ?? '';
    const apps = buildDefaultApps(department_id, departments);

    const leadRaw = (row['is_team_lead'] || row['team_lead'] || row['lead'] || '').toLowerCase();
    const is_team_lead = ['yes', 'true', '1', 'y', '✓'].includes(leadRaw);

    return {
      _id: uid(),
      name: row['name'] || row['full_name'] || '',
      email: row['email'] || row['email_address'] || '',
      company_email: row['company_email'] || row['company_mail'] || row['organization_email'] || '',
      password: row['password'] || row['pass'] || '',
      user_type,
      department_id,
      is_team_lead,
      apps,
    };
  });
}
