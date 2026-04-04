import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { withRouteContext } from '@/lib/with-request-context';

function isValidCallbackUrl(url: string): boolean {
  // Must be a relative path starting with / but not // (protocol-relative)
  return url.startsWith('/') && !url.startsWith('//');
}

export const GET = withRouteContext(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const rawCallback = searchParams.get('callbackUrl') ?? searchParams.get('redirectTo') ?? '/';
  const callbackUrl = isValidCallbackUrl(rawCallback) ? rawCallback : '/';

  await signIn('discord', { redirectTo: callbackUrl });

  // signIn throws a NEXT_REDIRECT — this line is never reached.
  return NextResponse.next();
});
