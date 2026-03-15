import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV,
    component: 'web-server',
  },
});

// Extend globalThis for TypeScript
declare global {
  var __LOGGER_INITIALIZED__: boolean | undefined;
}

export const isAbortedResponse = (error: unknown): boolean => {
  if (!error) return false;
  const err = error as any;
  return (
    err?.name === 'ResponseAborted' ||
    (typeof err?.message === 'string' && err.message.includes('ResponseAborted'))
  );
};

// Intercept console.error and console.warn on server to ensure they are logged in JSON
if (typeof window === 'undefined' && !globalThis.__LOGGER_INITIALIZED__) {
  globalThis.__LOGGER_INITIALIZED__ = true;

  const formatArgs = (args: any[]): string | any[] => {
    if (args.length === 1 && typeof args[0] === 'string') return args[0];
    return args;
  };

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    logger.error({ consoleArgs: formatArgs(args) }, 'console.error');
    // We still call the original to ensure it appears in the terminal during dev
    // and because Next.js might be doing its own interception.
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    logger.warn({ consoleArgs: formatArgs(args) }, 'console.warn');
    originalWarn.apply(console, args);
  };

  // Capture unhandled rejections and uncaught exceptions on the server
  process.on('unhandledRejection', (reason, promise) => {
    if (isAbortedResponse(reason)) {
      logger.trace({ reason }, 'Unhandled Rejection (Aborted Response)');
    } else {
      logger.error({ reason, promise }, 'Unhandled Rejection');
    }
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ error: { message: error.message, stack: error.stack, name: error.name } }, 'Uncaught Exception');
    // We should allow the process to exit as it's in an unstable state, 
    // but Next.js usually handles this.
  });
}

export default logger;
