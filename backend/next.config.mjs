/** @type {import('next').NextConfig} */
const nextConfig = {
  // Backend API server configuration
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Memory optimizations for Render Free tier (512MB)
  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  // No source maps to save memory
  productionBrowserSourceMaps: false,

  // CORS headers for frontend access
  async headers() {
    // IMPORTANT: Access-Control-Allow-Origin can only be a single origin, not comma-separated
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: frontendUrl,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
    ]
  },

  // Webpack optimization
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
