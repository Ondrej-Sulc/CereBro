import pino from 'pino';
import { getRequestContext } from './request-context';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV,
    component: 'web-server',
  },
  mixin() {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return {
      correlationId: ctx.correlationId,
      ...(ctx.userId && { userId: ctx.userId }),
      ...(ctx.discordId && { discordId: ctx.discordId }),
      ...(ctx.path && { path: ctx.path }),
      ...(ctx.action && { action: ctx.action }),
    };
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

  // Lazy import to avoid circular dependency (logger -> discord-alert -> logger)
  const getDiscordAlert = () =>
    import('./discord-alert').then((m) => m.sendErrorToDiscord);

  // Capture unhandled rejections and uncaught exceptions on the server
  process.on('unhandledRejection', (reason, promise) => {
    if (isAbortedResponse(reason)) {
      logger.trace({ reason }, 'Unhandled Rejection (Aborted Response)');
    } else {
      logger.error({ reason, promise }, 'Unhandled Rejection');
      getDiscordAlert()
        .then((send) =>
          send({
            error: reason instanceof Error ? reason : new Error(String(reason)),
            message: 'Unhandled Promise Rejection',
          })
        )
        .catch(() => { /* swallow — must not trigger another unhandledRejection */ });
    }
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ error: { message: error.message, stack: error.stack, name: error.name } }, 'Uncaught Exception');
    // Best-effort alert before the process may exit — delay shutdown briefly
    getDiscordAlert()
      .then((send) => send({ error, message: 'Uncaught Exception' }))
      .catch(() => { /* swallow — process is already crashing */ })
      .finally(() => {
        // Give the fetch a moment to flush before Node exits
        setTimeout(() => process.exit(1), 500);
      });
  });
}

export default logger;
