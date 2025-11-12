/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Disable static page generation for error pages
  generateBuildId: async () => {
    return 'build'
  },

  // Skip static generation
  experimental: {
    outputFileTracingRoot: undefined,
  },

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

  webpack: (config, { isServer, webpack }) => {
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

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /next\/document/,
      })
    );

    config.parallelism = 10;

    return config;
  },
};

module.exports = nextConfig;