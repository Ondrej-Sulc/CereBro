import { prisma } from "../services/prismaService.js";
import { config } from "../config.js";
import { Client, GatewayIntentBits } from "discord.js";

async function backfillAvatars() {
  console.log("Starting avatar backfill...");

  // Initialize Discord Client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  try {
    await client.login(config.BOT_TOKEN);
    console.log(`Logged in as ${client.user?.tag}`);

    // Fetch all players without an avatar
    const players = await prisma.player.findMany({
      where: {
        avatar: null,
      },
    });

    console.log(`Found ${players.length} players without avatars.`);

    for (const player of players) {
      try {
        const user = await client.users.fetch(player.discordId);
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        
        await prisma.player.update({
          where: { id: player.id },
          data: { avatar: avatarUrl },
        });

        console.log(`Updated avatar for ${player.ingameName} (${player.discordId})`);
      } catch (error) {
        console.error(`Failed to fetch/update avatar for ${player.ingameName} (${player.discordId}):`, error);
      }
      
      // Add a small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("Avatar backfill complete.");

  } catch (error) {
    console.error("Error during backfill:", error);
  } finally {
    await client.destroy();
    await prisma.$disconnect();
  }
}

backfillAvatars();
