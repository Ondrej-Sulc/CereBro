import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Perform permission check again for safety
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: 'discord' }
    });
    const player = account ? await prisma.player.findFirst({ where: { discordId: account.providerAccountId } }) : null;
    
    if (!player?.isBotAdmin) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    const baseUrl = process.env.BOT_BASE_URL || 
                    new URL(req.url).origin;

    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        `${baseUrl}/api/admin/youtube/callback`
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        if (tokens.refresh_token) {
            // Save to DB
            await prisma.systemConfig.upsert({
                where: { key: 'YOUTUBE_REFRESH_TOKEN' },
                update: { value: tokens.refresh_token },
                create: { key: 'YOUTUBE_REFRESH_TOKEN', value: tokens.refresh_token }
            });
            
            return NextResponse.redirect(`${process.env.BOT_BASE_URL}/admin/youtube?success=true`);
        } else {
            // If no refresh token, it might be because the user has already approved the app 
            // and we are just re-authing without prompt='consent'. 
            // But our auth route forces prompt='consent', so this shouldn't happen unless something weird.
            return NextResponse.redirect(`${process.env.BOT_BASE_URL}/admin/youtube?error=no_refresh_token`);
        }
    } catch (error) {
        console.error('Error exchanging code for token', error);
        return NextResponse.redirect(`${process.env.BOT_BASE_URL}/admin/youtube?error=exchange_failed`);
    }
}
