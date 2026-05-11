'use client'

import { useEffect } from 'react'
import {
  captureClientException,
  captureDeploymentMismatchReload,
} from '@/lib/observability/client'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error.message || "";
  const isStaleAction =
    msg.includes('Failed to find Server Action') ||
    msg.includes('failed-to-find-server-action') ||
    msg.includes('was not found on the server') ||
    msg.includes('older or newer deployment');
  const isChunkError =
    error.name === 'ChunkLoadError' ||
    msg.includes('ChunkLoadError') ||
    msg.includes('loading chunk') ||
    msg.includes('c[e] is undefined') ||
    msg.includes('property \'call\' of undefined');
  const isStale = isStaleAction || isChunkError;

  useEffect(() => {
    if (isStale) {
      captureDeploymentMismatchReload({
        source: 'root_error_boundary',
        error_name: error.name,
        error_message: error.message,
        digest: error.digest,
      });
      console.warn('Deployment mismatch or chunk failure detected, reloading page...', { 
        name: error.name, 
        message: error.message 
      });
      // Add a small delay to avoid infinite reload loops
      const lastReload = sessionStorage.getItem('last-deployment-reload');
      const now = Date.now();
      if (!lastReload || (now - parseInt(lastReload)) > 10000) {
        sessionStorage.setItem('last-deployment-reload', now.toString());
        window.location.reload();
      }
    } else {
      captureClientException(error, {
        source: 'root_error_boundary',
        digest: error.digest,
      })
      console.error("Global Error Boundary caught:", error)
    }
  }, [error, isStale])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
      <p className="mb-4 text-slate-400">
        {isStale 
          ? "A new version has been deployed and your current session is out of date. Reloading now..."
          : "We encountered an error loading this page."
        }
      </p>
      <button
        onClick={() => isStale ? window.location.reload() : reset()}
        className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
      >
        {isStale ? "Refresh Page" : "Try again"}
      </button>
    </div>
  )
}
