/** @type {import('next').NextConfig} */
const nextConfig = {	
  output: 'standalone', // 生产部署必需
  images: {
    domains: [],
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig