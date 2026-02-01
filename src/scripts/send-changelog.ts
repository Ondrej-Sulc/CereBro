import { Client, GatewayIntentBits, TextChannel, Events } from "discord.js";
import { config } from "../config";
import logger from "../services/loggerService";
import * as readline from 'readline';

async function getMessage(): Promise<string> {
  // 1. Check for command line arguments
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args.join(" ").replace(/\\n/g, '\n');
  }

  // 2. Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("📝 Enter your changelog message (Press Ctrl+C to cancel, or type 'SEND' on a new line to finish):");
  console.log("-----------------------------------------------------------------------------------------");

  const lines: string[] = [];
  
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === 'SEND') {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async () => {
  try {
    const message = await getMessage();
    if (!message.trim()) {
      logger.warn("⚠️ Empty message, skipping.");
      process.exit(0);
    }

    const channelId = config.CHANGELOG_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);

    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send(`📢 **Changelog Update**\n\n${message}`);
      logger.info(`✅ Changelog sent to channel ${channelId}`);
    } else {
      logger.error(`❌ Channel ${channelId} not found or is not a text channel.`);
    }
  } catch (error) {
    logger.error(error, "❌ Failed to send changelog:");
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

client.login(config.BOT_TOKEN);
