/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  outputFileTracingIncludes: { '/api/**/*': ['./certs/supabase-ca.crt'] },
  outputFileTracingExcludes: { '**': ['./.env', './.env.*', './.private/**/*'] },
  async redirects() {
    return ['dashboard', 'household', 'management', 'people', 'housework', 'recipe', 'schedule']
      .map(path => ({ source: `/${path}/:path*`, destination: '/expenses', permanent: false }));
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};

module.exports = nextConfig;
