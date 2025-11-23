import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import loggerService from '@cerebro/core/services/loggerService';

import { isUserBotAdmin } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const isAdmin = await isUserBotAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const existingVideo = await prisma.warVideo.findUnique({
      where: { id: videoId },
      include: { submittedBy: true },
    });

    if (!existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (existingVideo.status === 'PUBLISHED') {
      return NextResponse.json({ message: 'Video already approved' }, { status: 200 });
    }

    const updatedVideo = await prisma.warVideo.update({
      where: { id: videoId },
      data: { status: 'PUBLISHED' },
    });

    if (existingVideo.submittedBy) {
      await prisma.player.update({
        where: { id: existingVideo.submittedById },
        data: { isTrustedUploader: true },
      });
    }

    loggerService.info({ videoId }, 'War video approved');
    return NextResponse.json({ message: 'Video approved' }, { status: 200 });
  } catch (error) {
    loggerService.error({ err: error }, 'Error approving video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
