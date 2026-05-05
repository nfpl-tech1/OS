'use client';

import { useState, useRef, useCallback } from 'react';
import { bulkCreateUsers } from '@/lib/api';
import { 
  AppCellState, 
  App, 
  Department, 
  BulkRow, 
  ImportResult, 
  uid, 
  cycleState, 
  validateRow, 
  buildDefaultApps, 
  downloadTemplate, 
  parseFile 
} from '@/lib/bulk-import-utils';
import { Icons } from '@/components/shared/Icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

interface BulkImportModalProps {
  isOpen: boolean;
  apps: App[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

type ModalApiError = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

// ─── Sticky column definitions ────────────────────────────────────────────────

const COLS = [
  { key: 'num', label: '#', width: 44 },
  { key: 'name', label: 'Name', width: 140 },
  { key: 'email', label: 'Login Email', width: 160 },
  { key: 'company_email', label: 'Company Email', width: 160 },
  { key: 'password', label: 'Password', width: 140 },
  { key: 'user_type', label: 'Type', width: 100 },
  { key: 'department', label: 'Unit', width: 140 },
  { key: 'lead', label: 'Lead', width: 64 },
  { key: 'del', label: '', width: 40 },
] as const;

const APP_COL_W = 100;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppCell({
  state,
  onClick,
}: {
  state: AppCellState;
  onClick: () => void;
}) {
  if (state === 'none') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Click to grant access"
        className="w-full h-12 flex items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <span className="text-slate-200 text-lg">—</span>
      </button>
    );
  }

  if (state === 'access') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Access granted — click to make Admin"
        className="w-full h-12 flex flex-col items-center justify-center bg-indigo-50/50 hover:bg-indigo-100 transition-colors gap-0.5"
      >
        <Icons.Check size={14} className="text-primary" />
        <span className="text-[9px] font-bold text-primary/40 uppercase tracking-tighter">ACCESS</span>
      </button>
    );
  }

  // admin
  return (
    <button
      type="button"
      onClick={onClick}
      title="Admin — click to remove access"
      className="w-full h-12 flex flex-col items-center justify-center bg-primary hover:bg-primary/90 transition-colors gap-0.5"
    >
      <Icons.Check size={14} className="text-white" />
      <span className="text-[9px] font-bold text-white/50 uppercase tracking-tighter">ADMIN</span>
    </button>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function BulkImportModal({
  isOpen,
  apps,
  departments,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Validation ────────────────────────────────────────────────────────────
  const rowErrors = rows.map((r) => validateRow(r, rows));
  const totalErrors = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  const hasErrors = totalErrors > 0;

  // ─── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        setParseError('Please upload a .csv, .xlsx, or .xls file');
        return;
      }
      setParsing(true);
      setParseError(null);
      try {
        const parsed = await parseFile(file, departments);
        setRows(parsed);
        setStep('preview');
      } catch (err: unknown) {
        const apiError = err as ModalApiError;
        setParseError(apiError.message || 'Failed to parse file');
      } finally {
        setParsing(false);
      }
    },
    [departments],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ─── Row update helpers ────────────────────────────────────────────────────
  const updateRow = (id: string, fields: Partial<Omit<BulkRow, '_id' | 'apps'>>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        if (
          'department_id' in fields &&
          fields.department_id !== undefined &&
          fields.department_id !== r.department_id
        ) {
          const newDefaults = buildDefaultApps(fields.department_id, departments);
          const merged: Record<string, AppCellState> = { ...r.apps };
          for (const [slug, state] of Object.entries(newDefaults)) {
            if ((merged[slug] ?? 'none') === 'none') {
              merged[slug] = state;
            }
          }
          return { ...r, ...fields, apps: merged };
        }
        return { ...r, ...fields };
      }),
    );
  };

  const toggleApp = (rowId: string, slug: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== rowId) return r;
        const cur = r.apps[slug] ?? 'none';
        return { ...r, apps: { ...r.apps, [slug]: cycleState(cur) } };
      }),
    );
  };

  const deleteRow = (id: string) => setRows((prev) => prev.filter((r) => r._id !== id));

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { _id: uid(), name: '', email: '', company_email: '', password: '', user_type: 'employee', department_id: '', is_team_lead: false, apps: {} },
    ]);
  };

  // ─── Import submit ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (hasErrors || rows.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const payload = rows.map((r) => {
        const app_slugs: string[] = [];
        const admin_app_slugs: string[] = [];
        for (const [slug, state] of Object.entries(r.apps)) {
          if (state === 'access') app_slugs.push(slug);
          if (state === 'admin') {
            app_slugs.push(slug);
            admin_app_slugs.push(slug);
          }
        }
        return {
          name: r.name.trim(),
          email: r.email.trim(),
          ...(r.company_email?.trim() ? { company_email: r.company_email.trim() } : {}),
          password: r.password,
          user_type: r.user_type,
          ...(r.department_id ? { department_id: r.department_id } : {}),
          is_team_lead: r.is_team_lead,
          app_slugs,
          admin_app_slugs,
        };
      });

      const result = await bulkCreateUsers(payload);
      setImportResult(result);
      setStep('done');
      if (result.results.length > 0) onSuccess();
    } catch (err: unknown) {
      const apiError = err as ModalApiError;
      alert(apiError?.response?.data?.message || 'Import failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "p-0 overflow-hidden border-none bg-white shadow-2xl rounded-3xl transition-all duration-300 !sm:top-6 !sm:translate-y-0 flex flex-col gap-0",
        step === 'preview' ? "sm:max-w-[1600px] w-[98vw] h-[92vh]" : "sm:max-w-2xl w-[95vw]"
      )}>
        <DialogHeader className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-extrabold tracking-tight text-slate-900">
                {step === 'upload' && 'Import Human Resources'}
                {step === 'preview' && `Review Bridge Data — ${rows.length} Records`}
                {step === 'done' && 'Import Finalized'}
              </DialogTitle>
              {step === 'preview' && (
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {hasErrors ? `${totalErrors} rows require remediation` : 'Validated and ready for deployment'}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ─── UPLOAD STEP ─── */}
          {step === 'upload' && (
            <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "group relative border-2 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all duration-300",
                  dragOver ? "bg-primary/5 border-primary ring-4 ring-primary/5" : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
                
                {parsing ? (
                  <div className="space-y-4">
                    <Icons.Sync size={40} className="mx-auto text-primary animate-spin opacity-20" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Deciphering Payload...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                      <Icons.Plus size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">Drop data source here</p>
                      <p className="text-slate-400 text-xs mt-1 font-medium">Accepts .CSV, .XLSX, or .XLS architectures.</p>
                    </div>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in shake-1 duration-300">
                  <Icons.Alert size={16} className="text-red-500 mt-0.5" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide">{parseError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={downloadTemplate} className="h-14 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 hover:text-primary transition-all">
                  <Icons.File size={16} className="mr-2" />
                  Download Template
                </Button>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">Payload requirements</p>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Required: name, email, password, user_type. Department is required for internal users and is matched by name or slug.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── PREVIEW STEP ─── */}
          {step === 'preview' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="sticky top-0 z-30 px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="h-8 border-slate-200 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">
                    <Icons.Sync size={12} className="mr-1.5" />
                    Reset
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRow} className="h-8 border-slate-200 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">
                    <Icons.Plus size={12} className="mr-1.5" />
                    Insert Record
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPasswords(!showPasswords)} className="h-8 border-slate-200 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">
                    {showPasswords ? <Icons.EyeOff size={12} className="mr-1.5" /> : <Icons.Eye size={12} className="mr-1.5" />}
                    {showPasswords ? 'Hide Credentials' : 'Reveal Credentials'}
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-4 mr-1">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-100 ring-1 ring-slate-200" /> Void</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-100 ring-1 ring-indigo-200" /> Bridged</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Authority</div>
                  </div>
                  
                  <Button 
                    onClick={handleImport} 
                    disabled={hasErrors || rows.length === 0 || submitting}
                    className="h-10 px-6 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20"
                  >
                    {submitting ? <Icons.Sync size={16} className="animate-spin mr-2" /> : <Icons.Check size={16} className="mr-2" />}
                    Add {rows.length} Users
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto w-full bg-slate-50/10">
                <div className="min-w-max">
                  <Table className="border-separate border-spacing-0">
                    <TableHeader className="bg-white sticky top-0 z-20 shadow-sm">
                      <TableRow>
                        {COLS.map((col) => (
                          <TableHead key={col.key} className="h-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100" style={{ width: col.width }}>
                            {col.label}
                          </TableHead>
                        ))}
                        {apps.map((app) => (
                          <TableHead key={app.slug} className="h-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center" style={{ width: APP_COL_W }}>
                            <span className="truncate block px-1" title={app.name}>{app.name}</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, idx) => {
                        const errs = rowErrors[idx];
                        return (
                          <TableRow key={row._id} className="group hover:bg-slate-50 transition-colors">
                            <TableCell className="text-[10px] font-bold text-slate-300 text-center">{idx + 1}</TableCell>
                            <TableCell className="p-1 px-2">
                              <Input 
                                value={row.name} 
                                onChange={(e) => updateRow(row._id, { name: e.target.value })}
                                className={cn("h-8 bg-transparent border-none text-xs font-bold focus-visible:ring-1 focus-visible:ring-primary/20", errs.name && "text-red-500")} 
                              />
                            </TableCell>
                            <TableCell className="p-1 px-2">
                              <Input 
                                value={row.email} 
                                onChange={(e) => updateRow(row._id, { email: e.target.value })}
                                className={cn("h-8 bg-transparent border-none text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary/20", errs.email && "text-red-500")} 
                              />
                            </TableCell>
                            <TableCell className="p-1 px-2">
                              <Input 
                                value={row.company_email || ''} 
                                onChange={(e) => updateRow(row._id, { company_email: e.target.value })}
                                placeholder="Optional"
                                className={cn("h-8 bg-transparent border-none text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary/20", errs.company_email && "text-red-500")} 
                              />
                            </TableCell>
                            <TableCell className="p-1 px-2">
                              <Input 
                                type={showPasswords ? "text" : "password"}
                                value={row.password} 
                                onChange={(e) => updateRow(row._id, { password: e.target.value })}
                                className={cn("h-8 bg-transparent border-none text-xs focus-visible:ring-1 focus-visible:ring-primary/20 font-mono", errs.password && "text-red-500")} 
                              />
                            </TableCell>
                            <TableCell className="p-1 px-2">
                              <Select 
                                value={row.user_type} 
                                onValueChange={(val) => updateRow(row._id, { user_type: val as BulkRow['user_type'] })}
                              >
                                <SelectTrigger className="h-10 border-none bg-slate-50/50 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-500 focus:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="client">Client</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1 px-2">
                              <Select 
                                value={row.department_id} 
                                onValueChange={(val) => updateRow(row._id, { department_id: val })}
                              >
                                <SelectTrigger className={cn(
                                  "h-10 border-none bg-slate-50/50 rounded-lg text-xs font-bold uppercase tracking-wider text-primary focus:ring-0",
                                  errs.department_id && "text-red-500"
                                )}>
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1 px-2 text-center">
                              <Checkbox 
                                checked={row.is_team_lead} 
                                onCheckedChange={(checked) => updateRow(row._id, { is_team_lead: !!checked })}
                                className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </TableCell>
                            <TableCell className="p-1 px-2 text-center">
                              <Button variant="ghost" size="sm" onClick={() => deleteRow(row._id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shadow-sm border border-slate-100">
                                <Icons.Trash size={12} />
                              </Button>
                            </TableCell>
                            {apps.map(app => (
                              <TableCell key={app.slug} className="p-0 border-l border-slate-100/50">
                                <AppCell state={row.apps[app.slug] ?? 'none'} onClick={() => toggleApp(row._id, app.slug)} />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* ─── DONE STEP ─── */}
          {step === 'done' && importResult && (
            <div className="p-10 flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-50 rounded-[2.5rem] flex items-center justify-center text-green-500 ring-8 ring-green-50/50">
                <Icons.Check size={32} strokeWidth={3} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Onboarding Complete</h3>
                <p className="text-slate-500 font-medium">
                  Provisioned <span className="text-primary font-bold">{importResult.results.length}</span> security accounts.
                </p>
              </div>

              {importResult.errors.length > 0 && (
                <div className="w-full bg-red-50 rounded-3xl p-6 border border-red-100 text-left space-y-3 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest pl-1">Conflict Log ({importResult.errors.length})</p>
                  <div className="space-y-1.5">
                    {importResult.errors.map((e, idx) => (
                      <div key={idx} className="flex gap-2 text-[11px]">
                        <span className="text-red-400 font-bold shrink-0">{e.email}:</span>
                        <span className="text-red-600 font-medium opacity-80">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={onClose} className="w-full h-12 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20">
                Finalize Operation
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
