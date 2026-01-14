import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay, { WarVideo } from './WarVideoDisplay';
import { isUserBotAdmin } from "@/lib/auth-helpers";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ videoId: string }>;
}

export default async function WarVideoPage(props: PageProps) {
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
              tags: true,
              abilities: {
                include: {
                  ability: true,
                },
              },
            },
          },
          defender: {
            include: {
              tags: true,
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
              champion: {
                include: {
                  abilities: {
                    include: {
                      ability: true,
                    },
                  },
                },
              }
            },
          },
        },
      },
    },
  });

  if (!warVideo) {
    notFound();
  }

  let activeTactic = null;
  const war = warVideo.fights[0]?.war;
  if (war?.warTier != null) {
     activeTactic = await prisma.warTactic.findFirst({
        where: {
            season: war.season,
            minTier: { lte: war.warTier },
            maxTier: { gte: war.warTier }
        },
        include: { attackTag: true, defenseTag: true }
     });
  }

  return <WarVideoDisplay warVideo={warVideo as unknown as WarVideo} isAdmin={isAdmin} activeTactic={activeTactic} />;
}
