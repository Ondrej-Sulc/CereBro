import type { NextConfig } from 'next';
import path from 'path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

function deriveServerActionsKey(secret: string): string {
  return createHash('sha256')
    .update(`cerebro-next-server-actions:${secret}`)
    .digest('base64');
}

function resolveBuildId(): string {
  const envBuildId =
    process.env.APP_VERSION ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.DEPLOYMENT_ID ||
    process.env.SOURCE_VERSION;

  if (envBuildId) return envBuildId;

  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return process.env.NODE_ENV === 'production' ? 'unknown-deployment' : 'dev';
  }
}

const buildId = resolveBuildId();
process.env.APP_VERSION = process.env.APP_VERSION || buildId;

if (!process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
  const actionKeySecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (actionKeySecret && actionKeySecret !== 'your-auth-secret-here') {
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = deriveServerActionsKey(actionKeySecret);
  }
}

const nextConfig: NextConfig = {
  generateBuildId: async () => buildId,
  env: {
    APP_VERSION: buildId,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10000mb',
    },
    proxyClientMaxBodySize: '50mb',
  },
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
