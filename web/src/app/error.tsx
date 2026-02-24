'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Check if the error is related to a stale server action deployment
    const msg = error.message || "";
    if (msg.includes('Failed to find Server Action') || msg.includes('older or newer deployment')) {
      console.warn('Stale deployment detected, reloading page...')
      window.location.reload()
    } else {
      console.error("Global Error Boundary caught:", error)
    }
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
      <p className="mb-4 text-slate-400">
        We encountered an error loading this page. 
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
      >
        Try again
      </button>
    </div>
  )
}
