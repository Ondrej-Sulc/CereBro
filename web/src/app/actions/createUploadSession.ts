'use server'

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import crypto from 'crypto';
import { add } from 'date-fns';

export async function createUploadSession(fightId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'discord' }
  });
  if (!account) throw new Error("No linked account");

  const currentUser = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId }
  });
  if (!currentUser) throw new Error("Player not found");

  const fight = await prisma.warFight.findUnique({
      where: { id: fightId },
      include: { war: true }
  });
  if (!fight) throw new Error("Fight not found");

  // Permission Check
  const isOwner = fight.playerId === currentUser.id;
  const isOfficer = currentUser.isOfficer && currentUser.allianceId === fight.war.allianceId;
  const isBotAdmin = currentUser.isBotAdmin;

  if (!isOwner && !isOfficer && !isBotAdmin) {
      throw new Error("Permission denied");
  }

  // Create Session
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.uploadSession.create({
      data: {
          token,
          fightIds: [fightId],
          expiresAt: add(new Date(), { hours: 1 }),
      }
  });

  redirect(`/war-videos/upload?session_token=${token}`);
}
