import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isUserBotAdmin } from '@/lib/auth-helpers';
import logger from '@/lib/logger';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (_req: Request) => {
  const isAdmin = await isUserBotAdmin();

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    logger.error('NEXTAUTH_URL is not set — cannot build YouTube OAuth redirect URI');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Generate a random state to protect against CSRF in the OAuth callback
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/api/admin/youtube/callback',
  });

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${baseUrl}/api/admin/youtube/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(authUrl);
});
