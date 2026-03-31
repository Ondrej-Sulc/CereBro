import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { withRouteContext } from '@/lib/with-request-context';

function isValidCallbackUrl(url: string): boolean {
  // Must be a relative path starting with / but not // (protocol-relative)
  return url.startsWith('/') && !url.startsWith('//');
}

export const GET = withRouteContext(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const rawCallback = searchParams.get('callbackUrl') ?? searchParams.get('redirectTo') ?? '/';
  const callbackUrl = isValidCallbackUrl(rawCallback) ? rawCallback : '/';

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    logger.error('DISCORD_CLIENT_ID is not set — cannot initiate Discord login');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/discord`,
    response_type: 'code',
    scope: 'identify email guilds',
    state: callbackUrl,
  });

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});
