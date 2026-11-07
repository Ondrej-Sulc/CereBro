import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  correlationId: string;
  userId?: string;
  discordId?: string;
  path?: string;
  action?: string;
  startTime: number;
}

declare global {
  var __CEREBRO_REQUEST_CONTEXT__: AsyncLocalStorage<RequestContext> | undefined;
}

// The cached logger and reloaded routes must read the same request context.
export const requestContextStorage = globalThis.__CEREBRO_REQUEST_CONTEXT__ ??= new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
