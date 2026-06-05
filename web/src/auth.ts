import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getFromCache } from "@/lib/cache"
import logger from "@/lib/logger"
import { syncDiscordProfileOnSignIn } from "@/lib/discord-profile-sync"

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

          await syncDiscordProfileOnSignIn({
            prisma,
            discordId,
            profile,
            authUserImage: user.image,
            authUserName: user.name,
          });
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
