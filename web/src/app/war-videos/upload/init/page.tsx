import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import crypto from 'crypto';
import { add } from 'date-fns';

export const metadata: Metadata = {
  title: "Start War Video Upload - CereBro",
  description:
    "Authenticate with Discord and create a secure upload session for submitting Alliance War videos.",
};

export default async function InitUploadPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/discord-login?redirectTo=/war-videos/upload/init");
  }

  // Resolve user to Player
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'discord' }
  });

  if (!account?.providerAccountId) {
    // Should not happen if logged in via Discord
    redirect("/");
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId }
  });

  if (!player) {
    // Handle case where player is not registered in the bot yet
    redirect("/alliance/onboarding?error=unregistered_player"); 
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = add(new Date(), { minutes: 30 });

  await prisma.uploadToken.create({
    data: {
      token: token,
      playerId: player.id,
      expiresAt: expiresAt,
    },
  });

  redirect(`/war-videos/upload?token=${token}`);
}
