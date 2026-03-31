import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { isUserBotAdmin } from "@/lib/auth-helpers";
import { withRouteContext } from '@/lib/with-request-context';

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    const isAdmin = await isUserBotAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    await prisma.warVideo.update({
      where: { id: videoId },
      data: { status: 'PUBLISHED' }, // Use PUBLISHED as a proxy for APPROVED if not in enum
    });

    logger.info({ videoId }, 'War video approved');
    return NextResponse.json({ message: 'Video approved' }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error approving video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
