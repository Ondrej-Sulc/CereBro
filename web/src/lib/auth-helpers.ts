import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function isUserBotAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) return false;

  // Use findFirst instead of findUnique because discordId isn't the primary key (though it is unique)
  // Wait, schema says @@unique([discordId, ingameName]), but checking unique constraint on just discordId might need findFirst
  // Schema: discordId String, but @@unique is composite.
  // Actually, there is `@@unique([discordId, ingameName])`.
  // Wait, looking at schema again:
  // `id String @id @default(cuid())`
  // `discordId String`
  // `@@unique([discordId, ingameName])`
  // There isn't a unique constraint on just `discordId`?
  // Let's re-read schema.
  // `model Player { ... discordId String ... @@unique([discordId, ingameName]) ... }`
  // Ah, so a user could technically have multiple players with same discordId if ingameName differs?
  // "The /profile command ... supports multiple accounts, allowing you to switch between them easily."
  // So yes, multiple players per discord ID.
  // But permissions like `isBotAdmin` should probably attach to the Discord ID conceptually, but here they attach to the Player profile.
  // If ANY of the user's profiles has `isBotAdmin`, are they an admin?
  // Or do we check the "active" profile?
  // `isActive Boolean @default(false)`
  
  // Let's assume if ANY profile associated with that Discord ID is bot admin, they are admin.
  // Or maybe specific to the active profile.
  // Given "Bot Admin" is a high level privilege, it's safer to check if *any* of their profiles has it, or just if the user is trusted.
  // Actually, checking `findFirst({ where: { discordId, isBotAdmin: true } })` would tell us if they have ANY admin profile.

  const adminProfile = await prisma.player.findFirst({
    where: { 
        discordId: account.providerAccountId,
        isBotAdmin: true
    },
  });

  return !!adminProfile;
}
