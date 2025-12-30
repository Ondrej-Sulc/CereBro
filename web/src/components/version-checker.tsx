'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes

export function VersionChecker({ initialVersion }: { initialVersion: string }) {
  const { toast } = useToast();
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    // Helper to check version
    const checkVersion = async () => {
      if (hasNotified) return;

      try {
        const res = await fetch('/api/version', { 
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' } 
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version && data.version !== initialVersion) {
          setHasNotified(true);
          toast({
            title: "Update Available",
            description: "A new version of the application has been deployed. Please refresh to avoid errors.",
            duration: Infinity, // Keep it open until interaction
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
    const intervalId = setInterval(checkVersion, POLLING_INTERVAL);

    // Check on focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [initialVersion, hasNotified, toast]);

  return null;
}
