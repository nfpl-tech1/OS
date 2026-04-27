import type { NextConfig } from 'next';

const parseBackendUrl = () => {
  const configured = process.env.OS_BACKEND_URL?.trim();
  if (!configured) return 'http://localhost:3001';
  if (!/^https?:\/\//i.test(configured)) return 'http://localhost:3001';
  return configured.replace(/\/+$/, '');
};

const osBackendUrl = parseBackendUrl();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${osBackendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
