import type { NextConfig } from 'next';
import path from 'path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { execSync } from 'child_process';

let buildId = 'dev';
try {
  buildId = execSync('git rev-parse HEAD').toString().trim();
} catch {
  buildId = process.env.RAILWAY_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID || 'unknown-deployment';
}

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: buildId,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10000mb',
    },
  },
  // Increase the default 10MB body size limit for API route handlers (e.g. roster image uploads)
  // @ts-expect-error - middlewareClientMaxBodySize may not be in types yet
  middlewareClientMaxBodySize: '200mb',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    qualities: [10, 75, 90],
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
    
    // Handle .js imports resolving to .ts files for shared core code
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    return config;
  },
};

export default nextConfig;