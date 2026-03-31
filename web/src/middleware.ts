import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Attach the current build version to every response header
  // This allows the client to detect deployment mismatches proactively
  const appVersion = process.env.APP_VERSION || 'dev'
  response.headers.set('x-app-version', appVersion)
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/war-videos/upload (large streaming uploads)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - manifest.webmanifest (PWA manifest)
     */
    '/((?!api/war-videos/upload|api/profile/roster/update|_next/static|_next/image|favicon.ico|public|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
