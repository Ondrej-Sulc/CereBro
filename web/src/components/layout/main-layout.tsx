import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { UserButton } from '@/components/UserButton';
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let isOfficer = false;

  if (session?.user?.id) {
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });
    if (account?.providerAccountId) {
        const player = await prisma.player.findFirst({
            where: { discordId: account.providerAccountId }
        });
        isOfficer = player?.isOfficer || player?.isBotAdmin || false;
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header userButton={<UserButton />} isOfficer={isOfficer} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
