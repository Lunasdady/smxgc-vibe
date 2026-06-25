/** @type {import('next').NextConfig} */
const nextConfig = {	
  output: 'standalone',
  images: {
    domains: [],
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig