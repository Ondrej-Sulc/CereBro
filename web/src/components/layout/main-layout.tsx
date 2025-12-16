import React from 'react';
import Header from '@/components/Header';
import ConditionalFooter from '@/components/layout/conditional-footer';
import { UserButton } from '@/components/UserButton';
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let isOfficer = false;
  let isInAlliance = false;
  let canUploadFiles = false;

  if (session?.user?.id) {
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });
    if (account?.providerAccountId) {
        const player = await prisma.player.findFirst({
            where: { discordId: account.providerAccountId },
            include: { alliance: { select: { canUploadFiles: true } } } // Include alliance data
        });
        isOfficer = player?.isOfficer || player?.isBotAdmin || false;
        isInAlliance = !!player?.allianceId;
        canUploadFiles = player?.alliance?.canUploadFiles || false;
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header userButton={<UserButton />} isOfficer={isOfficer} isInAlliance={isInAlliance} canUploadFiles={canUploadFiles} />
      <main className="flex-grow">
        {children}
      </main>
      <ConditionalFooter />
    </div>
  );
}

