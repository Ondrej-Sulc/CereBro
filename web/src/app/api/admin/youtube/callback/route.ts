import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { auth } from '@/auth';
import { isUserBotAdmin } from '@/lib/auth-helpers';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (req: Request) => {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserBotAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');

    if (!code) {
      return NextResponse.json({ error: 'Code not provided' }, { status: 400 });
    }

    // Validate OAuth state to prevent CSRF
    const cookieStore = await cookies();
    const storedState = cookieStore.get('youtube_oauth_state')?.value;
    cookieStore.delete('youtube_oauth_state');

    if (!storedState || storedState !== returnedState) {
      logger.warn('YouTube OAuth state mismatch — possible CSRF attempt');
      return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      logger.error('NEXTAUTH_URL is not set — cannot build YouTube OAuth redirect URI');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${baseUrl}/api/admin/youtube/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Merge with existing tokens to preserve refresh_token if not returned
    const existing = await prisma.systemConfig.findUnique({
      where: { key: 'YOUTUBE_TOKENS' },
    });

    let mergedTokens = tokens;
    if (existing) {
      const existingTokens = JSON.parse(existing.value);
      mergedTokens = {
        ...existingTokens,
        ...tokens,
        // Preserve existing refresh_token if the new response doesn't include one
        refresh_token: tokens.refresh_token ?? existingTokens.refresh_token,
      };
    }

    await prisma.systemConfig.upsert({
      where: { key: 'YOUTUBE_TOKENS' },
      update: { value: JSON.stringify(mergedTokens) },
      create: { key: 'YOUTUBE_TOKENS', value: JSON.stringify(mergedTokens) },
    });

    logger.info('YouTube tokens updated via callback');

    return NextResponse.redirect(`${baseUrl}/admin/support`);
  } catch (error) {
    logger.error({ err: error }, 'Error in YouTube callback');
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }
});
