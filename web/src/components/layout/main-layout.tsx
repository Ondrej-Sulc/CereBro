import React from 'react';
import Header from '@/components/Header';
import ConditionalFooter from '@/components/layout/conditional-footer';
import { UserButton } from '@/components/UserButton';
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { auth } from "@/auth";
import { PostHogIdentity, type PostHogIdentityPayload } from "@/components/PostHogIdentity";

export async function MainLayout({ children }: { children: React.ReactNode }) {
  let isInAlliance = false;

  const [player, session] = await Promise.all([
    getUserPlayerWithAlliance(),
    auth(),
  ]);

  if (player) {
    isInAlliance = !!player.allianceId;
  }

  const posthogIdentity: PostHogIdentityPayload | null =
    player && session?.user?.id
      ? {
          distinctId: session.user.id,
          playerId: player.id,
          hasAlliance: !!player.allianceId,
          isOfficer: player.isOfficer,
          isBotAdmin: player.isBotAdmin,
          permissionCount: player.permissions.length,
          alliance: player.alliance
            ? {
                id: player.alliance.id,
                name: player.alliance.name,
                tag: player.alliance.tag,
              }
            : null,
        }
      : null;

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <PostHogIdentity
        identity={posthogIdentity}
        appVersion={process.env.APP_VERSION || "dev"}
      />
      <Header userButton={<UserButton />} isInAlliance={isInAlliance} />
      <main className="flex-grow">
        {children}
      </main>
      <ConditionalFooter />
    </div>
  );
}
