'use client';

import { useEffect, useRef } from 'react';
import { captureDeploymentMismatchReload } from '@/lib/observability/client';

const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes

export function VersionChecker({ initialVersion }: { initialVersion: string }) {
  const lastVisibleTimeRef = useRef<number | null>(null);

  useEffect(() => {
    lastVisibleTimeRef.current = Date.now();
    // 1. Listen for Server Action failures or Chunk Load errors (common Next.js deployment issues)
    const isStaleError = (msg: string, name?: string) => {
        return msg.includes("Failed to find Server Action") || 
               msg.includes("failed-to-find-server-action") ||
               msg.includes("was not found on the server") ||
               msg.includes("older or newer deployment") || 
               msg.includes("c[e] is undefined") || 
               msg.includes("property 'call' of undefined") ||
               msg.includes("ChunkLoadError") ||
               msg.includes("loading chunk") ||
               name === "ChunkLoadError";
    };

    const safeReload = (source: string, properties: Record<string, unknown> = {}) => {
        captureDeploymentMismatchReload({
            source,
            client_version: initialVersion,
            ...properties,
        });
        try {
            const lastReload = sessionStorage.getItem('last-deployment-reload');
            const now = Date.now();
            if (!lastReload || (now - parseInt(lastReload)) > 10000) {
                sessionStorage.setItem('last-deployment-reload', now.toString());
                window.location.reload();
            }
        } catch {
            window.location.reload();
        }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (isStaleError(msg, event.error?.name)) {
        safeReload("version_checker_window_error", {
          error_name: event.error?.name,
          error_message: msg,
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const msg = event.reason?.message || String(event.reason || "");
        if (isStaleError(msg, event.reason?.name)) {
          safeReload("version_checker_unhandled_rejection", {
            error_name: event.reason?.name,
            error_message: msg,
          });
        }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 2. Intercept fetch to check version proactively
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        const serverVersion = response.headers.get('x-app-version');
        
        // Only check if we have a server version and it's not the default 'dev'
        if (serverVersion && initialVersion !== 'dev' && serverVersion !== initialVersion) {
            safeReload("version_checker_response_header", {
              server_version: serverVersion,
            });
        }
        return response;
      } catch (error) {
        // Just rethrow, handleGlobalError/handleUnhandledRejection will catch it if it's a critical mismatch
        throw error;
      }
    };

    // 3. Helper to check version manually (polling)
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { 
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' } 
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version && data.version !== initialVersion) {
            safeReload("version_checker_poll", {
              server_version: data.version,
            });
        }
      } catch {
        // Version checks are opportunistic; network failures are handled by the next poll.
      }
    };

    // Poll
    const intervalId = setInterval(() => checkVersion(), POLLING_INTERVAL);

    // Check on focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
        lastVisibleTimeRef.current = Date.now();
      } else {
        lastVisibleTimeRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [initialVersion]);

  return null;
}
