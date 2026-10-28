import { Prisma } from "@prisma/client";

/** Call inside the transaction that saves the submission. Locks serialize concurrent appends. */
export async function appendFightRecording(tx: Prisma.TransactionClient, fightIds: string[], videoId: string) {
  const ids = [...new Set(fightIds)].sort();
  if (!ids.length) throw new Error("At least one fight is required");
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WarFight" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
  const fights = await tx.warFight.findMany({
    where: { id: { in: ids } },
    select: { id: true, videoId: true, recordings: { select: { videoId: true, position: true } } },
  });
  if (fights.length !== ids.length) throw new Error("One or more fights no longer exist");
  const addedFightIds: string[] = [];
  for (const fight of fights) {
    let position = Math.max(-1, ...fight.recordings.map(recording => recording.position)) + 1;
    if (fight.videoId && !fight.recordings.some(recording => recording.videoId === fight.videoId)) {
      await tx.warFightVideo.create({ data: { fightId: fight.id, videoId: fight.videoId, position: position++ } });
    }
    if (fight.videoId !== videoId && !fight.recordings.some(recording => recording.videoId === videoId)) {
      await tx.warFightVideo.create({ data: { fightId: fight.id, videoId, position } });
      addedFightIds.push(fight.id);
    }
    if (!fight.videoId) {
      const first = await tx.warFightVideo.findFirst({ where: { fightId: fight.id }, orderBy: [{ position: "asc" }, { videoId: "asc" }] });
      await tx.warFight.update({ where: { id: fight.id }, data: { videoId: first?.videoId || videoId } });
    }
  }
  return addedFightIds;
}

/** Removing this association leaves the fight and its other recordings intact. */
export async function detachFightRecording(tx: Prisma.TransactionClient, fightIds: string[], videoId: string) {
  const ids = [...new Set(fightIds)].sort();
  if (!ids.length) return;
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WarFight" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
  await tx.warFightVideo.deleteMany({ where: { fightId: { in: ids }, videoId } });
  for (const id of ids) {
    const first = await tx.warFightVideo.findFirst({ where: { fightId: id }, orderBy: [{ position: "asc" }, { videoId: "asc" }] });
    await tx.warFight.updateMany({ where: { id, videoId }, data: { videoId: first?.videoId || null } });
  }
}
