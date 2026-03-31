import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { auth } from '@/auth';
import { isUserBotAdmin } from '@/lib/auth-helpers';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (req: Request) => {
  try {
    const session = await auth();
    const isAdmin = await isUserBotAdmin();

    if (!session || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code not provided' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/admin/youtube/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens securely in DB using SystemConfig
    await prisma.systemConfig.upsert({
      where: { key: 'YOUTUBE_TOKENS' },
      update: { value: JSON.stringify(tokens) },
      create: { key: 'YOUTUBE_TOKENS', value: JSON.stringify(tokens) },
    });

    logger.info('YouTube tokens updated via callback');

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/support`);
  } catch (error) {
    logger.error({ err: error }, 'Error in YouTube callback');
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }
});
