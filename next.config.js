/** @type {import('next').NextConfig} */
const nextConfig = {	
  // output: 'standalone', // 🚨 仅生产部署时启用
  images: {
    domains: [],
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig