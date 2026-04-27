'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Cropper from 'react-easy-crop';
import { useAuth } from '@/context/AuthContext';
import { createApp, uploadAppImage } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Icons } from '@/components/shared/Icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface CropArea { x: number; y: number; width: number; height: number }

async function getCroppedBlob(imageSrc: string, pixelCrop: CropArea): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  const SIZE = 512;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, SIZE, SIZE);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
}

export default function NewAppPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', url: '', webhook_url: '', is_active: true });
  const [protocol, setProtocol] = useState<'https://' | 'http://'>('https://');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Image crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  useEffect(() => {
    if (user === undefined) return;
    if (user && user.user_type !== 'admin') router.push('/dashboard');
  }, [user?.id, router]);

  // Auto-generate slug from name
  useEffect(() => {
    const generated = form.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setForm((f) => ({ ...f, slug: generated }));
  }, [form.name]);

  const onCropComplete = useCallback((_: unknown, pixels: CropArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const created = await createApp({ ...form, url: protocol + form.url, webhook_url: form.webhook_url || undefined });
      if (imageSrc && croppedAreaPixels) {
        const blob = await getCroppedBlob(imageSrc, pixelCropToPixels(imageSrc, croppedAreaPixels));
        await uploadAppImage(created.id, blob, `${created.slug}.jpg`);
      }
      router.push('/dashboard/admin/apps');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to create application');
    } finally {
      setSaving(false);
    }
  }

  // Helper to ensure correct blob generation if needed, though getCroppedBlob above is standard
  const pixelCropToPixels = (img: string, p: CropArea) => p;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Header & Breadcrumb */}
        <div className="space-y-4">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
            <Icons.ChevronRight size={10} />
            <Link href="/dashboard/admin/apps" className="hover:text-primary transition-colors">Applications</Link>
            <Icons.ChevronRight size={10} />
            <span className="text-slate-900 border-b border-brand-gold/30">New Registration</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Module Registration</h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Bridge a new decentralized operational module into the ecosystem.</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/dashboard/admin/apps')} className="h-9 px-4 border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50">
              <Icons.Back size={14} className="mr-2" />
              Discard Draft
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Form Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 lg:p-10 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-1 bg-brand-navy rounded-full" />
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Core Identity</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-600 ml-1">Display Name</Label>
                      <Input
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-bold text-slate-900"
                        placeholder="e.g. Sales Portal"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-600 ml-1">System Slug</Label>
                      <div className="relative group">
                        <Icons.Sync size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <Input
                          value={form.slug}
                          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                          className="pl-9 border-slate-200 text-slate-900 font-mono text-xs h-12 rounded-xl focus:ring-primary/5 focus:border-primary"
                          placeholder="e.g. sales-portal"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium ml-1">Unique identifier used for systems integration.</p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Connectivity Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-1 bg-primary rounded-full" />
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Endpoint Security</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 ml-1">Application Entry URL</Label>
                    <div className="flex items-center group">
                      <div className="h-12 px-3 flex items-center bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl">
                        <Icons.Globe size={14} className="text-slate-400 mr-2" />
                        <Select value={protocol} onValueChange={(val: any) => setProtocol(val)}>
                          <SelectTrigger className="border-none bg-transparent shadow-none p-0 h-10 flex items-center focus:ring-0 text-xs font-black text-primary">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="https://">HTTPS://</SelectItem>
                            <SelectItem value="http://">HTTP://</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        required
                        value={form.url}
                        onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                        className="h-12 rounded-r-xl border-slate-200 rounded-l-none focus:ring-primary/5 focus:border-primary font-medium"
                        placeholder="module.company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 ml-1">Event Webhook Signature</Label>
                    <div className="relative">
                      <Icons.Sync size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="url"
                        value={form.webhook_url}
                        onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                        placeholder="https://api.module.com/webhooks/os"
                        className="pl-9 h-12 rounded-xl border-slate-200 focus:ring-primary/5 focus:border-primary font-mono text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium ml-1">Receives real-time security events (user.deactivated, user.deleted).</p>
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      form.is_active ? "bg-emerald-50 text-emerald-500" : "bg-slate-100 text-slate-400"
                    )}>
                      {form.is_active ? <Icons.Check size={20} /> : <Icons.Lock size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Operational Status</p>
                      <p className="text-[10px] text-slate-500 font-medium">Determines if the module is immediately visible to authorized users.</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                    <Icons.Alert size={14} />
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/admin/apps')} className="h-11 px-6 font-bold text-slate-500 hover:text-slate-900 rounded-xl transition-all">
                    Dismiss
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-11 px-8 bg-brand-navy text-white font-bold rounded-xl shadow-lg shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {saving ? <Icons.Sync size={16} className="animate-spin mr-2" /> : <Icons.Plus size={16} className="mr-2" />}
                    Initialize Application
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar / Asset Management */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-brand-gold rounded-full" />
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Visual Identity</h3>
              </div>

              {/* Upload state */}
              {!imageSrc && (
                <label className="flex flex-col items-center justify-center w-full aspect-square rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-all group">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-3 group-hover:scale-110 transition-transform">
                    <Icons.Plus size={20} className="text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Upload Iconography</span>
                  <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Max 5MB • PNG/WebP</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              )}

              {/* Cropper state */}
              {imageSrc && (
                <div className="space-y-4">
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span>Crop Magnification</span>
                      <span>{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                      type="range" min={1} max={3} step={0.05} value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full accent-primary h-1.5 bg-slate-200 rounded-full cursor-pointer"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => { setImageSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                      className="w-full text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl"
                    >
                      Discard Logo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Technical Tip</h4>
              <p className="text-xs font-medium text-slate-500 leading-relaxed italic">
                "Ensure the Webhook URL is publicly accessible to receive real-time identity synchronization events from the OS Core."
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
