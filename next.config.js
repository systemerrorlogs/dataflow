/** @type {import('next').NextConfig} */
const nextConfig = {
//  turbo: false,false
  output: 'standalone',

  serverExternalPackages: [
    'oracledb',
    'mssql',
    'mysql2',
    'pg',
    'vertica',
    'jsforce',
    'axios',
    'bcryptjs'
  ],

  // Disable static optimization for error pages
  staticPageGenerationTimeout: 1000,

  // Skip static export for problematic pages
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;