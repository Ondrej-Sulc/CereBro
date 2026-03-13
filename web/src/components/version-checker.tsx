'use client';

import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes
const AUTO_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function VersionChecker({ initialVersion }: { initialVersion: string }) {
  const { toast } = useToast();
  const [hasNotified, setHasNotified] = useState(false);
  const lastVisibleTimeRef = useRef<number | null>(null);

  useEffect(() => {
    lastVisibleTimeRef.current = Date.now();
    // 1. Listen for Server Action failures or Chunk Load errors (common Next.js deployment issues)
    const isStaleError = (msg: string, name?: string) => {
        return msg.includes("Failed to find Server Action") || 
               msg.includes("older or newer deployment") || 
               msg.includes("c[e] is undefined") || 
               msg.includes("property 'call' of undefined") ||
               msg.includes("ChunkLoadError") ||
               msg.includes("loading chunk") ||
               name === "ChunkLoadError";
    };

    const safeReload = () => {
        try {
            const lastReload = sessionStorage.getItem('last-deployment-reload');
            const now = Date.now();
            if (!lastReload || (now - parseInt(lastReload)) > 10000) {
                sessionStorage.setItem('last-deployment-reload', now.toString());
                window.location.reload();
            }
        } catch (e) {
            window.location.reload();
        }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (isStaleError(msg, event.error?.name)) {
        console.warn("Detected deployment/chunk mismatch, reloading...", msg);
        safeReload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const msg = event.reason?.message || String(event.reason || "");
        if (isStaleError(msg, event.reason?.name)) {
          console.warn("Detected deployment/chunk mismatch (unhandled rejection), reloading...", msg);
          safeReload();
        }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 2. Helper to check version
    const checkVersion = async (forceRefresh = false) => {
      if (hasNotified) return;

      try {
        const res = await fetch('/api/version', { 
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' } 
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version && data.version !== initialVersion) {
          // If forceRefresh is true, we still show the toast so user can save work,
          // but we might want to mark it as more urgent.
          setHasNotified(true);
          toast({
            title: forceRefresh ? "Critical Update Available" : "Update Available",
            description: "A new version has been deployed. Please refresh to avoid errors.",
            duration: Infinity, 
            action: (
              <ToastAction altText="Refresh" onClick={() => window.location.reload()}>
                Refresh
              </ToastAction>
            ),
          });
        }
      } catch (error) {
        console.error("Failed to check version:", error);
      }
    };

    // Poll
    const intervalId = setInterval(() => checkVersion(), POLLING_INTERVAL);

    // Check on focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const inactiveTime = lastVisibleTimeRef.current ? Date.now() - lastVisibleTimeRef.current : 0;
        // If they've been away for 5+ mins, just refresh if version changed
        checkVersion(inactiveTime > AUTO_REFRESH_THRESHOLD);
        lastVisibleTimeRef.current = Date.now();
      } else {
        lastVisibleTimeRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [initialVersion, hasNotified, toast]);

  return null;
}
