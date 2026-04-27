'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      await refresh();
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f7fa' }}>
      <div className="w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-md px-8 py-10">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Nagarkot"
              style={{ height: 52, width: 'auto', objectFit: 'contain', marginBottom: 20 }}
            />
            <p className="text-sm" style={{ color: '#718096' }}>Sign in to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#4a5568' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
                style={{ backgroundColor: '#f7fafc', border: '1px solid #e2e8f0' }}
                placeholder="you@nagarkot.com"
                onFocus={(e) => (e.target.style.borderColor = '#1B3A6C')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#4a5568' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
                style={{ backgroundColor: '#f7fafc', border: '1px solid #e2e8f0' }}
                placeholder="••••••••"
                onFocus={(e) => (e.target.style.borderColor = '#1B3A6C')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1B3A6C' }}
              onMouseEnter={(e) => !loading && ((e.currentTarget).style.backgroundColor = '#2a4f8f')}
              onMouseLeave={(e) => !loading && ((e.currentTarget).style.backgroundColor = '#1B3A6C')}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

