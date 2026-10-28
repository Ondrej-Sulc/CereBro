import { fightHasRecording, getFightRecordings, canViewFightRecording } from '@cerebro/core/domain/war-recordings';
import { getUserPlayerWithAlliance } from '@/lib/auth-helpers';
import type { Metadata } from "next";
import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay, { WarVideo } from './WarVideoDisplay';
import { canManageWarVideos } from "@/lib/admin-war-video-auth";
import { getWarVideoEditAccess } from "@/lib/war-video-edit-auth";
import { cache } from "react";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ videoId: string }>;
}

const getWarVideoForMetadata = cache(async (videoId: string) => {
  const video = await prisma.warVideo.findUnique({ where: { id: videoId }, include: { submittedBy: true } });
  if (!video) return null;
  const fights = await prisma.warFight.findMany({ where: fightHasRecording({ id: videoId }), take: 1, orderBy: { createdAt: 'asc' }, select: { war: true } });
  return { ...video, fights };
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

  const isAdmin = await canManageWarVideos();
  if (!isAdmin && (warVideo.status !== 'PUBLISHED' || warVideo.visibility !== 'public')) {
    return {
      title: "Alliance War Video - CereBro",
      description: "Watch a submitted Alliance War video.",
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

  const isAdmin = await canManageWarVideos();

  const resolvedParams = await params;
  const { videoId } = resolvedParams;

  if (!videoId) {
    notFound();
  }

  const videoRecord = await prisma.warVideo.findUnique({ where: { id: videoId }, include: { submittedBy: true } });
  if (!videoRecord) notFound();
  const [linkedFights, viewer] = await Promise.all([
    prisma.warFight.findMany({
      where: fightHasRecording({ id: videoId }),
      orderBy: { createdAt: 'asc' },
      include: {
        war: true, node: true, player: true, video: true,
        recordings: { include: { video: true }, orderBy: [{ position: 'asc' }, { videoId: 'asc' }] },
        attacker: { include: { tags: true, abilities: { include: { ability: true } } } },
        defender: { include: { tags: true, abilities: { include: { ability: true } } } },
        prefightChampions: { include: { champion: { include: { abilities: { include: { ability: true } } } } } },
      },
    }),
    getUserPlayerWithAlliance(),
  ]);
  const warVideo = { ...videoRecord, fights: linkedFights.map(fight => {
    const { video, recordings, ...details } = fight;
    const visible = getFightRecordings(fight).filter(video => isAdmin || canViewFightRecording(video, fight.war.allianceId, viewer));
    return {
      ...details,
      videoId: visible[0]?.id || null,
      videos: visible.map(video => ({ id: video.id, description: video.description })),
      canAddRecording: !!viewer && (viewer.id === fight.playerId || viewer.isBotAdmin || (viewer.isOfficer && viewer.allianceId === fight.war.allianceId)),
    };
  }) };

  const editAccess = await getWarVideoEditAccess(warVideo.submittedById);
  if (!isAdmin && !editAccess.canEdit && (warVideo.status !== 'PUBLISHED' ||
    (warVideo.visibility !== 'public' && !linkedFights.some(fight => viewer?.allianceId === fight.war.allianceId)))) notFound();

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

  return <WarVideoDisplay warVideo={warVideo as unknown as WarVideo} isAdmin={isAdmin} canEdit={editAccess.canEdit} activeTactic={activeTactic} />;
}
