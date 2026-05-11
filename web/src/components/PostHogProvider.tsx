// components/PostHogProvider.tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const posthog_key = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthog_host = process.env.NEXT_PUBLIC_POSTHOG_HOST
const isPostHogConfigured = Boolean(posthog_key && posthog_host)

if (typeof window !== 'undefined') {
  if (posthog_key && posthog_host) {
    posthog.init(posthog_key, {
      api_host: posthog_host,
      capture_pageview: false, // we capture pageviews manually
      capture_exceptions: true,
      defaults: '2025-05-24',
      mask_personal_data_properties: true,
    })
  }
}

export function PostHogPageview(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isPostHogConfigured) return
    if (pathname) {
      const url = window.origin + pathname
      posthog.capture('$pageview', {
        '$current_url': url,
        path: pathname,
      })
    }
  }, [pathname, searchParams])

  return null
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
