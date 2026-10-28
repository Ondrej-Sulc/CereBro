import type { Prisma } from "@prisma/client";

/** Ordered, distinct recordings, including the legacy link during rollout. */
export function getFightRecordings<T extends { id: string }>(fight: {
  video?: T | null;
  recordings?: readonly { position: number; video: T }[];
}): T[] {
  const videos = new Map<string, T>();
  for (const recording of [...(fight.recordings || [])].sort((a, b) => a.position - b.position || a.video.id.localeCompare(b.video.id))) {
    videos.set(recording.video.id, recording.video);
  }
  if (fight.video && !videos.has(fight.video.id)) videos.set(fight.video.id, fight.video);
  return [...videos.values()];
}

export function fightHasRecording(video: Prisma.WarVideoWhereInput = {}): Prisma.WarFightWhereInput {
  return { OR: [{ video: { is: video } }, { recordings: { some: { video: { is: video } } } }] };
}

export type RecordingViewer = { id: string; allianceId: string | null; isBotAdmin?: boolean } | null;

export function canViewFightRecording(video: { status: string; visibility: string; submittedById?: string }, allianceId: string, viewer: RecordingViewer) {
  if (viewer?.isBotAdmin) return true;
  if (video.status === 'REJECTED') return false;
  if (viewer && video.submittedById === viewer.id) return true;
  return video.status === 'PUBLISHED' && (video.visibility === 'public' || (video.visibility === 'alliance' && viewer?.allianceId === allianceId));
}

export function fightHasVisibleRecording(viewer: RecordingViewer, criteria: Prisma.WarVideoWhereInput = {}): Prisma.WarFightWhereInput {
  const qualify = (access: Prisma.WarVideoWhereInput): Prisma.WarVideoWhereInput => ({ AND: [access, criteria] });
  if (viewer?.isBotAdmin) return fightHasRecording(criteria);
  return { OR: [
    fightHasRecording(qualify({ status: 'PUBLISHED', visibility: 'public' })),
    ...(viewer ? [
      fightHasRecording(qualify({ submittedById: viewer.id, status: { not: 'REJECTED' } })),
      ...(viewer.allianceId ? [{ AND: [{ war: { allianceId: viewer.allianceId } }, fightHasRecording(qualify({ status: 'PUBLISHED', visibility: 'alliance' }))] }] : []),
    ] : []),
  ] };
}

/** Union primary and collection relations without multiplying fight statistics. */
export function getVideoFights<T extends { id: string }>(video: {
  fights: readonly T[];
  fightLinks?: readonly { fight: T }[];
}): T[] {
  return [...new Map([...video.fights, ...(video.fightLinks || []).map(link => link.fight)]
    .map(fight => [fight.id, fight])).values()];
}
