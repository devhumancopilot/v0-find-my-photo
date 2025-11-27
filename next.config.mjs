/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Memory optimizations for Render Free tier (512MB limit)
  experimental: {
    // Reduce memory usage during builds
    workerThreads: false,
    cpus: 1,
  },

  // Use standalone output for smaller deployment size
  output: 'standalone',

  // Disable source maps in production to save memory
  productionBrowserSourceMaps: false,

  // Optimize bundle
  swcMinify: true,

  // Reduce webpack memory usage
  webpack: (config, { isServer }) => {
    // Optimize memory during build
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    }

    // Reduce memory footprint
    if (isServer) {
      config.cache = false
    }

    return config
  },
}

export default nextConfig
