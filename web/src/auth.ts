import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getFromCache } from "@/lib/cache"
import logger from "@/lib/logger"

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  logger.error("Missing Discord environment variables: DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET required for Auth.js");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  logger: {
    error(error) {
      const authError = error as { type?: string; cause?: unknown };
      // InvalidCheck (PKCE/state mismatch) is expected: abandoned flows, multiple tabs, browser cookie restrictions.
      // Log at warn to avoid noise; everything else is a real error.
      if (authError?.type === "InvalidCheck") {
        logger.warn({ errorType: authError.type, cause: authError.cause }, "Auth.js InvalidCheck — user likely abandoned or retried login flow");
      } else {
        logger.error({ error, cause: authError.cause }, "Auth.js error");
      }
    },
    warn(code) {
      logger.warn({ code }, "Auth.js warning");
    },
  },
  pages: {
    error: "/auth/error",
  },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "discord" && account.providerAccountId) {
          const discordId = account.providerAccountId;
          
          logger.info({ discordId, name: user.name }, "Processing sign in for Discord user");

          const avatar = user.image || null;

          // 1. Ensure BotUser exists and sync avatar
          const botUser = await prisma.botUser.upsert({
            where: { discordId },
            update: { avatar },
            create: { discordId, avatar }
          });

          // 2. Sync avatar to all player profiles that use the Discord avatar
          await prisma.player.updateMany({
              where: { 
                  discordId,
                  useDiscordAvatar: true
              },
              data: { avatar }
          });

          // 3. Check if user has any Player profiles
          const existingPlayers = await prisma.player.findMany({
            where: { discordId },
            orderBy: { createdAt: 'asc' }
          });

          if (existingPlayers.length === 0) {
            // Create a default profile if they don't have one
            const discordProfile = profile as { global_name?: string; name?: string };
            const ingameName = discordProfile.global_name || discordProfile.name || user.name || "New Player";

            logger.info({ discordId, ingameName }, "Creating new player profile");
            const newPlayer = await prisma.player.create({
              data: {
                discordId,
                ingameName,
                avatar,
                useDiscordAvatar: true,
                isActive: true,
                botUserId: botUser.id
              }
            });

            // Set as active profile if BotUser doesn't have one
            if (!botUser.activeProfileId) {
              await prisma.botUser.update({
                where: { id: botUser.id },
                data: { activeProfileId: newPlayer.id }
              });
            }
          } else {
              const unlinkedPlayers = existingPlayers.filter(p => !p.botUserId);
              if (unlinkedPlayers.length > 0) {
                  // Link existing players to botUser if they weren't linked (e.g. legacy data)
                  logger.info({ discordId, count: unlinkedPlayers.length }, "Linking existing players to BotUser");
                  await prisma.player.updateMany({
                      where: { id: { in: unlinkedPlayers.map(p => p.id) } },
                      data: { botUserId: botUser.id }
                  });
                  
                  if (!botUser.activeProfileId) {
                      const activeLegacy = unlinkedPlayers.find(p => p.isActive) || unlinkedPlayers[0];
                      await prisma.botUser.update({
                        where: { id: botUser.id },
                        data: { activeProfileId: activeLegacy.id }
                      });
                  }
              }
          }
        }
        return true;
      } catch (error) {
        logger.error({ error, userId: user.id }, "Error in signIn callback");
        return false;
      }
    },
    async session({ session, user }) {
        if (session.user) {
          session.user.isBotAdmin = false;
          session.user.permissions = [];
          
          try {
            // Cache the account discord id to avoid repeated account lookups
            const discordId = await getFromCache(
                `user_discord_id_${user.id}`,
                3600, // Cache for 1 hour
                async () => {
                    const account = await prisma.account.findFirst({
                        where: { userId: user.id, provider: 'discord' },
                        select: { providerAccountId: true }
                    });
                    return account?.providerAccountId || null;
                }
            );
    
            if (discordId) {
                session.user.discordId = discordId;
                
                // Fetch permissions fresh so changes reflect immediately
                const botUser = await prisma.botUser.findUnique({
                    where: { discordId },
                    select: { isBotAdmin: true, permissions: true }
                });

                if (botUser) {
                    session.user.isBotAdmin = botUser.isBotAdmin;
                    session.user.permissions = botUser.permissions || [];
                }
            }
          } catch (error) {
              logger.error({ error, userId: user.id }, "Error in session callback");
          }
        }
        return session;
    }
  },
})
