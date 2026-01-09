import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { config } from "./config";
import { loadCommands, commands } from "./utils/commandHandler";
import { Command, CommandAccess } from "./types/command";
import { getPlayer } from "./utils/playerHelper";
import { getButtonHandler } from "./utils/buttonHandlerRegistry";
import { startScheduler } from "./services/schedulerService";
import { startAQScheduler } from "./services/aqSchedulerService";
import http from "http";
import { handleError, safeReply } from "./utils/errorHandler";
import { loadApplicationEmojis } from "./services/applicationEmojiService";
import { loadChampions } from "./services/championService";
import { initializeAqReminders } from "./services/aqReminderService.js";
import { getModalHandler } from "./utils/modalHandlerRegistry";
import { getSelectMenuHandler } from "./utils/selectMenuHandlerRegistry";
import { registerGlossaryButtons } from "./commands/glossary/buttons";
import { registerAbilityDraftHandlers } from "./commands/admin/ability/draftHandler";
import { registerChampionAdminHandlers } from "./commands/admin/champion/init";
import { registerAttackAdminHandlers } from "./commands/admin/attack/init";
import { registerScheduleHandlers } from "./commands/schedule/buttons";
import { registerPrestigeHandlers } from "./commands/prestige/leaderboard";
import { registerSetupHandlers } from "./commands/setup/handlers";
import { getPosthogClient } from "./services/posthogService";
import { prisma } from "./services/prismaService";
import logger from "./services/loggerService";
import { startJobProcessor } from "./services/jobProcessor";
import { handleTranslationReaction } from "./services/translationService";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = commands;

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`✅ Bot connected as ${readyClient.user.username}`);

  // We start a minimal HTTP server just for health checks.
  const port = process.env.PORT || 8080;
  http
    .createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Bot is healthy and running!\n");
    })
    .listen(port, () => {
      logger.info(`HTTP health check server listening on port ${port}`);
    });

  await loadCommands();
  const commandData = Array.from(client.commands.values()).map((command) =>
    command.data.toJSON()
  );
  try {
    await readyClient.application.commands.set(commandData);
    logger.info(
      `🔄 Successfully registered ${commandData.length} global slash command(s).`
    );
  } catch (error: unknown) {
    logger.error({ error: String(error) }, `❌ Failed to register global slash commands:`);
  }
  // Load application emojis once at startup so resolver can reference them
  try {
    await loadApplicationEmojis(client);
    logger.info("🎨 Application emojis loaded.");
  } catch (e: unknown) {
    logger.warn({ error: String(e) }, "⚠️ Failed to load application emojis:");
  }
  // Load champion data into cache
  try {
    await loadChampions();
  } catch (e: unknown) {
    logger.warn({ error: String(e) }, "⚠️ Failed to load champions:");
  }
  
  // Start the job processor for async tasks (notifications, etc.)
  startJobProcessor(client);

  // Start scheduler after bot is ready
  await startScheduler(client);
  startAQScheduler(client);
  initializeAqReminders(client);
  registerGlossaryButtons();
  registerAbilityDraftHandlers();
  registerChampionAdminHandlers();
  registerAttackAdminHandlers();
  registerScheduleHandlers();
  registerPrestigeHandlers();
  registerSetupHandlers();
  logger.info("✅ Registered all button handlers.");
});

client.on(Events.GuildCreate, async (guild) => {
  logger.info(`🆕 Joined new guild: ${guild.name} (${guild.id})`);

  try {
    // 1. Create/Update Alliance Record
    await prisma.alliance.upsert({
      where: { guildId: guild.id },
      update: {},
      create: {
        guildId: guild.id,
        name: guild.name,
      },
    });
    logger.info(`✅ Initialized alliance record for ${guild.name}`);

    // 2. Find a suitable channel for the welcome message
    // Try system channel first, then first viewable text channel
    let channel = guild.systemChannel;

    let me = guild.members.me;
    if (!me) {
      try {
        me = await guild.members.fetch(client.user!.id);
      } catch (e) {
        logger.warn({ error: String(e), guildId: guild.id }, "Could not fetch bot member in guild");
      }
    }

    if (me) {
      if (!channel || !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
        const channels = await guild.channels.fetch();
        const firstTextChannel = channels.find(
          (c) =>
            c &&
            c.type === ChannelType.GuildText &&
            c.permissionsFor(me!)?.has(PermissionFlagsBits.ViewChannel) &&
            c.permissionsFor(me!)?.has(PermissionFlagsBits.SendMessages)
        ) as TextChannel | undefined;
        channel = firstTextChannel || null;
      }
    } else {
      channel = null;
    }

    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle("🧠 CereBro has connected!")
        .setDescription(
          `Thanks for inviting CereBro to **${guild.name}**!\n\n` +
          "I'm here to help you manage your MCOC alliance with ease. " +
          "To get started, an administrator needs to configure your alliance roles.\n\n" +
          "Click the button below to start the interactive setup wizard."
        )
        .setColor(0x0ea5e9) // Sky 500
        .setThumbnail("https://cerebro-bot.com/CereBro_logo_512.png")
        .setFooter({ text: "You can also run /setup manually at any time." });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup:step1_intro")
          .setLabel("Start Setup")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🚀")
      );

      await channel.send({ embeds: [embed], components: [row] });
      logger.info(`📨 Sent welcome message to ${channel.name} in ${guild.name}`);
    } else {
      logger.warn(`⚠️ Could not find a channel to send welcome message in ${guild.name}`);
    }
  } catch (error) {
    logger.error({ error: String(error) }, `❌ Error initializing guild ${guild.name}:`);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await handleTranslationReaction(reaction, user);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions generically
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("interactive:")) {
      return;
    }
    try {
      const posthogClient = await getPosthogClient();
      if (posthogClient) {
        posthogClient.capture({
          distinctId: interaction.user.id,
          event: 'button_clicked',
          properties: {
            custom_id: interaction.customId,
            user_tag: interaction.user.tag,
            guild_id: interaction.guild?.id,
            channel_id: interaction.channel?.id,
            message_id: interaction.message.id,
          },
        });
      }
    } catch (e: unknown) {
      logger.error({ error: String(e) }, "Error capturing PostHog event for button click:");
    }

    const handler = getButtonHandler(interaction.customId);
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        const { userMessage, errorId } = handleError(error, {
          location: `button:${interaction.customId}`,
          userId: interaction.user?.id,
        });
        await safeReply(interaction, userMessage, errorId);
      }
    } else {
      await safeReply(interaction, "Unknown button.");
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("interactive:")) {
      return;
    }
    try {
      const posthogClient = await getPosthogClient();
      if (posthogClient) {
        const fields = interaction.fields.fields.map((field) => ({
          customId: field.customId,
          value: interaction.fields.getTextInputValue(field.customId),
        }));

        posthogClient.capture({
          distinctId: interaction.user.id,
          event: 'modal_submitted',
          properties: {
            custom_id: interaction.customId,
            user_tag: interaction.user.tag,
            guild_id: interaction.guild?.id,
            channel_id: interaction.channel?.id,
            fields: fields,
          },
        });
      }
    } catch (e: unknown) {
      logger.error({ error: String(e) }, "Error capturing PostHog event for modal submission:");
    }

    const handler = getModalHandler(interaction.customId);
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        const { userMessage, errorId } = handleError(error, {
          location: `modal:${interaction.customId}`,
          userId: interaction.user?.id,
        });
        await safeReply(interaction, userMessage, errorId);
      }
    } else {
      await safeReply(interaction, "Unknown modal.");
    }
    return;
  }

  if (interaction.isAnySelectMenu()) {
    if (interaction.customId.startsWith("interactive:")) {
      return;
    }
    try {
      const posthogClient = await getPosthogClient();
      if (posthogClient) {
        posthogClient.capture({
          distinctId: interaction.user.id,
          event: "select_menu_used",
          properties: {
            custom_id: interaction.customId,
            user_tag: interaction.user.tag,
            guild_id: interaction.guild?.id,
            channel_id: interaction.channel?.id,
            values: interaction.values,
          },
        });
      }
    } catch (e: unknown) {
      logger.error(
        { error: String(e) },
        "Error capturing PostHog event for select menu:"
      );
    }

    const handler = getSelectMenuHandler(interaction.customId);
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        const { userMessage, errorId } = handleError(error, {
          location: `select_menu:${interaction.customId}`,
          userId: interaction.user?.id,
        });
        await safeReply(interaction, userMessage, errorId);
      }
    } else {
      await safeReply(interaction, "Unknown select menu.");
    }
    return;
  }

  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        handleError(error, {
          location: `autocomplete:${interaction.commandName}`,
          userId: interaction.user?.id,
        });
        // No user feedback for autocomplete errors
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    handleError(
      new Error(`No command matching ${interaction.commandName} was found.`),
      {
        location: `command:${interaction.commandName}`,
        userId: interaction.user?.id,
      }
    );
    return;
  }

  // Check command access
  switch (command.access) {
    case CommandAccess.PUBLIC:
      // No checks needed
      break;
    case CommandAccess.USER: {
      const player = await getPlayer(interaction);
      if (!player) {
        return;
      }
      break;
    }
    case CommandAccess.ALLIANCE_ADMIN: {
      if (!interaction.inGuild()) {
        await safeReply(
          interaction,
          "This command can only be used in a server."
        );
        return;
      }
      if (!interaction.memberPermissions?.has("Administrator")) {
        await safeReply(
          interaction,
          "You must be an administrator to use this command."
        );
        return;
      }
      break;
    }
    case CommandAccess.BOT_ADMIN: {
      const botUser = await prisma.botUser.findUnique({
        where: { discordId: interaction.user.id },
      });
      
      if (!botUser?.isBotAdmin) {
        await safeReply(
          interaction,
          "You are not authorized to use this command."
        );
        return;
      }
      break;
    }
    case CommandAccess.FEATURE: {
      if (!interaction.inGuild()) {
        await safeReply(
          interaction,
          "This command can only be used in a server."
        );
        return;
      }
      const alliance = await prisma.alliance.findUnique({
        where: { guildId: interaction.guildId },
        select: { enabledFeatureCommands: true },
      });
      if (!alliance || !alliance.enabledFeatureCommands.includes(interaction.commandName)) {
        await safeReply(
          interaction,
          "This feature is not enabled for this alliance."
        );
        return;
      }
      break;
    }
  }


  try {
    const posthogClient = await getPosthogClient();
    if (posthogClient) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      const properties: Record<string, any> = {
          user_tag: interaction.user.tag,
          guild_id: interaction.guild?.id,
          command: interaction.commandName,
      };
      if (subcommand) properties.subcommand = subcommand;
      if (subcommandGroup) properties.subcommandGroup = subcommandGroup;

      const allOptions = [...interaction.options.data];
      const flatOptions: any[] = [];
      
      function flatten(opts: any[]) {
          for (const opt of opts) {
              if (opt.options) {
                  flatten(opt.options);
              }
              else {
                  flatOptions.push(opt);
              }
          }
      }
      flatten(allOptions);

      for (const opt of flatOptions) {
          properties[`option_${opt.name}`] = opt.value;
      }

      posthogClient.capture({
        distinctId: interaction.user.id,
        event: 'command_executed',
        properties,
      });
    }
  } catch (e: unknown) {
    logger.error({ error: String(e) }, "Error capturing PostHog event:");
  }

  try {
    await command.execute(interaction);
  } catch (error: unknown) {
    const { userMessage, errorId } = handleError(error, {
      location: `command:${interaction.commandName}`,
      userId: interaction.user?.id,
    });
    await safeReply(interaction, userMessage, errorId);
  }
});

client.on('destroy', async () => {
    const posthogClient = await getPosthogClient();
    if (posthogClient) {
        await posthogClient.shutdown();
    }
});

if (!config.BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is not defined in the .env file.");
}
try {
  client.login(config.BOT_TOKEN);
} catch (error: unknown) {
  logger.error({ error: String(error) }, "Failed to login to Discord:");
  process.exit(1);
}
