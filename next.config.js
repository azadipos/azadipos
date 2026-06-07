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
  experimental: {
    // Ensure Prisma query engine binaries are included in standalone output.
    outputFileTracingIncludes: {
      '/api/**': ['./node_modules/.prisma/client/**'],
      '/': ['./node_modules/.prisma/client/**'],
    },
  },
};

module.exports = nextConfig;
