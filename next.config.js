/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { 
    unoptimized: true 
  },
  // Ensure Prisma query engine binaries are included in standalone output.
  // Next.js file tracing misses dynamically-loaded .dll.node/.so.node engine files.
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/.prisma/client/**'],
    '/': ['./node_modules/.prisma/client/**'],
  },
};

module.exports = nextConfig;
