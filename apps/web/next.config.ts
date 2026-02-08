import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@fandreams/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.b-cdn.net' },
    ],
  },
}

export default nextConfig
