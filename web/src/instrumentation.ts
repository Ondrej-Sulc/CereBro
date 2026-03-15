export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import the logger to trigger console interception and global error handlers
    await import('./lib/logger');
  }
}
