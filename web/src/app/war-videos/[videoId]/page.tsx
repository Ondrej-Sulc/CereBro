import type { Metadata } from "next";
import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay, { WarVideo } from './WarVideoDisplay';
import { isUserBotAdmin } from "@/lib/auth-helpers";
import { cache } from "react";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ videoId: string }>;
}

const getWarVideoForMetadata = cache(async (videoId: string) => {
  return prisma.warVideo.findUnique({
    where: { id: videoId },
    select: {
      submittedBy: {
        select: {
          ingameName: true,
        },
      },
      fights: {
        take: 1,
        orderBy: {
          createdAt: "asc",
        },
        select: {
          war: {
            select: {
              season: true,
              warNumber: true,
              warTier: true,
              enemyAlliance: true,
            },
          },
        },
      },
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { videoId } = await params;
  const warVideo = await getWarVideoForMetadata(videoId);

  if (!warVideo) {
    return {
      title: "Alliance War Video - CereBro",
      description:
        "Watch a submitted Alliance War video with fight details, nodes, attackers, defenders, and uploader information.",
    };
  }

  const war = warVideo.fights[0]?.war;
  if (!war) {
    return {
      title: "Alliance War Video - CereBro",
      description:
        "Watch a submitted Alliance War video with fight details, nodes, attackers, defenders, and uploader information.",
    };
  }

  const title = `MCOC AW: S${war.season}${war.warNumber ? ` W${war.warNumber}` : " Offseason"} T${war.warTier}${war.enemyAlliance ? ` vs ${war.enemyAlliance}` : ""} - CereBro`;

  return {
    title,
    description: `Watch ${warVideo.submittedBy?.ingameName || "a community member"}'s Alliance War video${war.enemyAlliance ? ` against ${war.enemyAlliance}` : ""} with fight details, nodes, attackers, and defenders.`,
  };
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
