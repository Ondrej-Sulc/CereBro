import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getYouTubeService } from '@cerebro/core/services/youtubeService';
import { isUserBotAdmin } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const isAdmin = await isUserBotAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await req.json();

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const warVideo = await prisma.warVideo.findUnique({
      where: { id: videoId },
    });

    if (!warVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // If there's a YouTube URL, delete the video from YouTube.
    if (warVideo.url) {
      const youtubeService = getYouTubeService();
      const youtubeId = youtubeService.getVideoId(warVideo.url);
      if (youtubeId) {
        await youtubeService.deleteVideo(youtubeId);
      }
    }

    await prisma.warVideo.update({
      where: { id: videoId },
      data: { status: 'REJECTED' },
    });

    return NextResponse.json({ message: 'Video rejected successfully' });
  } catch (error) {
    console.error('Error rejecting war video:', error);
    return NextResponse.json({ error: 'Failed to reject video' }, { status: 500 });
  }
}
