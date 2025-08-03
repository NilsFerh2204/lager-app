/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lichtenrader-feuerwerkverkauf.de',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.shopify.com',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig