import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getFromCache } from "@/lib/cache"
import logger from "@/lib/logger"

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  console.error("❌ Missing Discord environment variables in auth.ts");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
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

          // 1. Ensure BotUser exists (represents the Discord user globally)
          const botUser = await prisma.botUser.upsert({
            where: { discordId },
            update: {},
            create: { discordId }
          });

          // 2. Check if user has any Player profiles
          const existingPlayer = await prisma.player.findFirst({
            where: { discordId }
          });

          if (!existingPlayer) {
            // Create a default profile if they don't have one
            const discordProfile = profile as { global_name?: string; name?: string };
            const ingameName = discordProfile.global_name || discordProfile.name || user.name || "New Player";
            const avatar = user.image || null;

            logger.info({ discordId, ingameName }, "Creating new player profile");
            const newPlayer = await prisma.player.create({
              data: {
                discordId,
                ingameName,
                avatar,
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
          } else if (!existingPlayer.botUserId) {
              // Link existing player to botUser if it wasn't linked (e.g. legacy data)
              logger.info({ discordId, playerId: existingPlayer.id }, "Linking existing player to BotUser");
              await prisma.player.update({
                  where: { id: existingPlayer.id },
                  data: { botUserId: botUser.id }
              });
              
              if (!botUser.activeProfileId) {
                  await prisma.botUser.update({
                    where: { id: botUser.id },
                    data: { activeProfileId: existingPlayer.id }
                  });
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
          try {
            // Cache the session extension data for 5 minutes to reduce DB load
            const extension = await getFromCache(
                `session_ext_${user.id}`,
                300,
                async () => {
                const account = await prisma.account.findFirst({
                    where: { userId: user.id, provider: 'discord' },
                    select: { providerAccountId: true }
                });
        
                if (!account?.providerAccountId) return null;
        
                const botUser = await prisma.botUser.findUnique({
                    where: { discordId: account.providerAccountId },
                    select: { isBotAdmin: true }
                });
        
                return {
                    discordId: account.providerAccountId,
                    isBotAdmin: botUser?.isBotAdmin || false
                };
                },
                (data) => data !== null
            );
        
            if (extension) {
                session.user.discordId = extension.discordId;
                session.user.isBotAdmin = extension.isBotAdmin;
            }
          } catch (error) {
              logger.error({ error, userId: user.id }, "Error in session callback");
          }
        }
        return session;
    }
  },
})
