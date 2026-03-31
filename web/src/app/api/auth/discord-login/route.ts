import { NextRequest, NextResponse } from 'next/server';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  // Discord OAuth2 authorize URL
  const params = new URLSearchParams({
    client_id: process.env.AUTH_DISCORD_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/discord`,
    response_type: 'code',
    scope: 'identify email guilds',
    state: callbackUrl,
  });

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});
