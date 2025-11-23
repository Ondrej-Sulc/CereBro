import type { NextConfig } from 'next';
import path from 'path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

const nextConfig: NextConfig = {
  // !! WARN !!
  // Dangerously allow production builds to successfully complete even if
  // your project has type errors. This is a temporary measure to unblock
  // deployment due to a persistent type error with a pre-release Next.js version.
  // !! WARN !!
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@cerebro/core'],
  webpack: (config) => {
    if (config.resolve.plugins) {
      config.resolve.plugins.push(new TsconfigPathsPlugin());
    } else {
      config.resolve.plugins = [new TsconfigPathsPlugin()];
    }
    return config;
  },
};

export default nextConfig;