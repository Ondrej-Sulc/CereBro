import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { withRouteContext } from '@/lib/with-request-context';
import { canManageWarVideos } from '@/lib/admin-war-video-auth';

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
      include: { submittedBy: true },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.status === 'PUBLISHED') {
      return NextResponse.json({ message: 'Video already approved' }, { status: 200 });
    }

    const [, approvedVideos] = await prisma.$transaction([
      prisma.player.update({
        where: { id: video.submittedById },
        data: { isTrustedUploader: true },
      }),
      prisma.warVideo.updateMany({
        where: {
          OR: [
            { id: videoId },
            { submittedById: video.submittedById, status: 'UPLOADED' },
          ],
        },
        data: { status: 'PUBLISHED' },
      }),
    ]);

    logger.info({
      videoId,
      submittedById: video.submittedById,
      approvedCount: approvedVideos.count,
    }, 'War video approved and uploader trusted');

    return NextResponse.json({
      message: 'Video approved',
      approvedCount: approvedVideos.count,
      trustedUploader: {
        id: video.submittedBy.id,
        ingameName: video.submittedBy.ingameName,
      },
    }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error approving video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
