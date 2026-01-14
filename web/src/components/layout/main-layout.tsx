import React from 'react';
import Header from '@/components/Header';
import ConditionalFooter from '@/components/layout/conditional-footer';
import { UserButton } from '@/components/UserButton';
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

export async function MainLayout({ children }: { children: React.ReactNode }) {
  let isInAlliance = false;
  let canUploadFiles = false;

  const player = await getUserPlayerWithAlliance();

  if (player) {
    isInAlliance = !!player.allianceId;
    canUploadFiles = player.alliance?.canUploadFiles || false;
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header userButton={<UserButton />} isInAlliance={isInAlliance} canUploadFiles={canUploadFiles} />
      <main className="flex-grow">
        {children}
      </main>
      <ConditionalFooter />
    </div>
  );
}