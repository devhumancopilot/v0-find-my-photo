/** @type {import('next').NextConfig} */
const nextConfig = {
  // Frontend Configuration (proxies API calls to separate backend)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Proxy all /api/* requests to backend server
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },

  // Memory optimizations
  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  // Disable source maps in production
  productionBrowserSourceMaps: false,

  // Reduce webpack memory usage
  webpack: (config, { isServer }) => {
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    }

    if (isServer) {
      config.cache = false
    }

    return config
  },
}

export default nextConfig
