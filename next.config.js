/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  experimental: {
    serverComponentsExternalPackages: [
      'oracledb',
      'mssql',
      'mysql2',
      'pg',
      'jsforce',
      'bcryptjs',
      'papaparse',
      'node-cron',
      'exceljs',
      'vertica'
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;