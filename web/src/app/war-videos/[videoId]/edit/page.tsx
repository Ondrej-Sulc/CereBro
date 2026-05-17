import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCachedChampions } from "@/lib/data/champions";
import { getWarVideoEditAccess } from "@/lib/war-video-edit-auth";
import { WarVideoForm } from "../../upload/WarVideoForm";
import type { PreFilledFight } from "../../upload/hooks/useWarVideoForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export default async function EditWarVideoPage({ params }: PageProps) {
  const { videoId } = await params;

  const video = await prisma.warVideo.findUnique({
    where: { id: videoId },
    include: {
      submittedBy: { include: { alliance: true } },
      fights: {
        include: {
          war: true,
          player: true,
          attacker: {
            include: {
              abilities: { include: { ability: true } },
            },
          },
          defender: {
            include: {
              abilities: { include: { ability: true } },
            },
          },
          node: true,
          prefightChampions: {
            include: {
              champion: {
                include: {
                  abilities: { include: { ability: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!video) notFound();

  const access = await getWarVideoEditAccess(video.submittedById);
  if (!access.canEdit) redirect(`/war-videos/${videoId}`);

  const [champions, nodes, players] = await Promise.all([
    getCachedChampions(),
    prisma.warNode.findMany({ orderBy: { nodeNumber: "asc" } }),
    video.submittedBy.allianceId
      ? prisma.player.findMany({
          where: { allianceId: video.submittedBy.allianceId },
          orderBy: { ingameName: "asc" },
          include: { alliance: true },
        })
      : Promise.resolve([video.submittedBy]),
  ]);

  const playerOptions = players.some(player => player.id === video.submittedById)
    ? players
    : [...players, video.submittedBy];

  const preFilledFights = video.fights.map(fight => ({
    ...fight,
    prefightChampions: fight.prefightChampions.map(prefight => prefight.champion),
  })) as unknown as PreFilledFight[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-4 sm:py-8 px-2 sm:px-4">
      <div className="container mx-auto max-w-5xl px-0">
        <div className="glass rounded-xl sm:rounded-2xl border border-slate-800/50 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-b border-slate-800/50 p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Edit Alliance War Video</h1>
            <p className="text-sm text-slate-300">Update the video source, war context, and fight details.</p>
          </div>
          <div className="p-3 sm:p-6">
            <WarVideoForm
              token="edit"
              initialChampions={champions}
              initialNodes={nodes}
              initialPlayers={playerOptions}
              initialUserId={video.submittedById}
              preFilledFights={preFilledFights}
              mode="edit"
              editVideoId={video.id}
              initialVideo={{
                url: video.url,
                description: video.description,
                visibility: video.visibility,
              }}
              canUploadFilesOverride={access.isAdmin || !!video.submittedBy.alliance?.canUploadFiles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
