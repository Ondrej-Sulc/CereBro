import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check Bot Admin Permissions
  const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'discord' }
  });
  
  if (!account) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const player = await prisma.player.findFirst({ where: { discordId: account.providerAccountId } });
  
  if (!player?.isBotAdmin) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.BOT_BASE_URL || 
                  new URL(req.url).origin;

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${baseUrl}/api/admin/youtube/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Critical for refresh token
    scope: scopes,
    prompt: 'consent', // Force consent to ensure we get a refresh token
    include_granted_scopes: true
  });

  return NextResponse.redirect(url);
}
