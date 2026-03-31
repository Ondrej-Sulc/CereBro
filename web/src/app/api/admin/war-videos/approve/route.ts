import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { isUserBotAdmin } from "@/lib/auth-helpers";
import { withRouteContext } from '@/lib/with-request-context';

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    const isAdmin = await isUserBotAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const video = await prisma.warVideo.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.status === 'PUBLISHED') {
      return NextResponse.json({ message: 'Video already approved' }, { status: 200 });
    }

    await prisma.warVideo.update({
      where: { id: videoId },
      data: { status: 'PUBLISHED' },
    });

    logger.info({ videoId }, 'War video approved');
    return NextResponse.json({ message: 'Video approved' }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error approving video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
