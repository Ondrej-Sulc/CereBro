import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay from './WarVideoDisplay';
import { isUserBotAdmin } from "@/lib/auth-helpers";

export const dynamic = 'force-dynamic';

export default async function WarVideoPage(props: any) {
  const { params } = props;

  const isAdmin = await isUserBotAdmin();

  const resolvedParams = await params;
  const { videoId } = resolvedParams;

  if (!videoId) {
    notFound();
  }

  const warVideo = await prisma.warVideo.findUnique({
    where: { id: videoId },
    include: {
      submittedBy: true,
      fights: {
        include: {
          war: true,
          attacker: {
            include: {
              abilities: {
                include: {
                  ability: true,
                },
              },
            },
          },
          defender: {
            include: {
              abilities: {
                include: {
                  ability: true,
                },
              },
            },
          },
          node: true,
          player: true,
          prefightChampions: {
            include: {
              abilities: {
                include: {
                  ability: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!warVideo) {
    notFound();
  }

  return <WarVideoDisplay warVideo={warVideo as any} isAdmin={isAdmin} />;
}
