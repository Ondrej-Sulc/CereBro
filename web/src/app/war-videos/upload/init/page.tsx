import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import crypto from 'crypto';
import { add } from 'date-fns';

export default async function InitUploadPage() {
  const session = await auth();

  if (!session?.user?.id) {
    await signIn("discord", { redirectTo: "/war-videos/upload/init" });
    return null;
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
    // Redirect to a page telling them to register or auto-register?
    // For now, let's redirect to home with an error or just home.
    // Ideally, show a message "Please register with /register in Discord first".
    redirect("/?error=unregistered_player"); 
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
