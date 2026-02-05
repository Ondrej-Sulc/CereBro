import path from 'path';
import fs from 'fs';

/**
 * Resolves the path to an asset, handling different execution environments
 * (e.g., running from root, from the 'web' workspace, or from 'dist').
 */
export function getAssetsPath(...segments: string[]): string {
  // Try current working directory
  const rootAssets = path.join(process.cwd(), 'assets');
  if (fs.existsSync(rootAssets)) {
    return path.join(rootAssets, ...segments);
  }

  // Try one level up (common for workspaces like 'web' or 'src')
  const parentAssets = path.join(process.cwd(), '..', 'assets');
  if (fs.existsSync(parentAssets)) {
    return path.join(parentAssets, ...segments);
  }

  // Fallback to current working directory
  return path.join(process.cwd(), 'assets', ...segments);
}
