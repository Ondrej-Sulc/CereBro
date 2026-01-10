import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import logger from '@cerebro/core/services/loggerService';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ message: 'Missing profile name' }, { status: 400 });
  }

  try {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "discord" },
    });

    if (!account?.providerAccountId) {
      return NextResponse.json({ message: 'No linked Discord account' }, { status: 403 });
    }

    const discordId = account.providerAccountId;

    const profiles = await prisma.player.findMany({
      where: { discordId },
    });

    const targetProfile = profiles.find(p => p.ingameName === name);

    if (!targetProfile) {
      return NextResponse.json({ message: 'Profile not found' }, { status: 404 });
    }

    // Switch active profile
    await prisma.$transaction([
      prisma.player.updateMany({
        where: { discordId },
        data: { isActive: false },
      }),
      prisma.player.update({
        where: { id: targetProfile.id },
        data: { isActive: true },
      }),
      prisma.botUser.update({
          where: { discordId },
          data: { activeProfileId: targetProfile.id }
      })
    ]);

  } catch (error) {
    logger.error({ error }, 'Error switching profile');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }

  return redirect('/profile');
}