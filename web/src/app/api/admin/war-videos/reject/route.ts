import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { getYouTubeService } from '@cerebro/core/services/youtubeService';
import { withRouteContext } from '@/lib/with-request-context';
import { canManageWarVideos } from '@/lib/admin-war-video-auth';

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match?.[1] ?? null;
}

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    if (!(await canManageWarVideos())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const video = await prisma.warVideo.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Try to delete from YouTube if it was uploaded to our channel
    if (video.url) {
      const youtubeId = extractYouTubeId(video.url);
      if (youtubeId) {
        try {
          const youtube = getYouTubeService();
          await youtube.deleteVideo(youtubeId);
        } catch (e) {
          logger.error({ err: e, videoId: video.id }, 'Failed to delete video from YouTube');
        }
      }
    }

    await prisma.warVideo.update({
      where: { id: videoId },
      data: { status: 'REJECTED' },
    });

    logger.info({ videoId }, 'War video rejected');
    return NextResponse.json({ message: 'Video rejected' }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error rejecting video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
