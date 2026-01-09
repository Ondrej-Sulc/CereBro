import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { prisma } from '../../services/prismaService';
import fs from "fs";
import path from "path";

export const helpColors = {
  buttons: {
    navigation: ButtonStyle.Primary,
  },
  containers: {
    detail: 0x5865F2, // Discord Blue
  },
};

interface UserAccess {
  isBotAdmin: boolean;
  isAllianceAdmin: boolean;
  isRegistered: boolean;
  enabledFeatureCommands: string[];
}

async function getUserAccess(interaction: ChatInputCommandInteraction): Promise<UserAccess> {
  const players = await prisma.player.findMany({ where: { discordId: interaction.user.id } });
  const botUser = await prisma.botUser.findUnique({ where: { discordId: interaction.user.id } });
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const alliance = interaction.guild ? await prisma.alliance.findUnique({ where: { guildId: interaction.guild.id } }) : null;

  const isBotAdmin = botUser?.isBotAdmin || false;
  const isRegistered = players.length > 0;

  return {
    isBotAdmin,
    isAllianceAdmin: member?.permissions.has('Administrator') || false,
    isRegistered,
    enabledFeatureCommands: alliance?.enabledFeatureCommands || [],
  };
}

function hasAccess(command: any, access: UserAccess): boolean {
  switch (command.access) {
    case CommandAccess.PUBLIC:
      return true;
    case CommandAccess.USER:
      return access.isRegistered;
    case CommandAccess.ALLIANCE_ADMIN:
      return access.isAllianceAdmin;
    case CommandAccess.BOT_ADMIN:
      return access.isBotAdmin;
    case CommandAccess.FEATURE:
      return access.enabledFeatureCommands.includes(command.name);
    default:
      return false;
  }
}

export async function handleHome(interaction: ChatInputCommandInteraction) {
  const commandDocsPath = path.resolve(__dirname, '../../../src/data/commands.json');
  const commandDocs = JSON.parse(fs.readFileSync(commandDocsPath, 'utf-8'));

  const userAccess = await getUserAccess(interaction);

  const categories: Record<string, any[]> = {};
  for (const command of commandDocs) {
    if (!categories[command.group]) {
      categories[command.group] = [];
    }
    categories[command.group].push(command);
  }

  const categoryOrder = ["Alliance Tools", "User Management", "Information & Search", "Utilities", "BOT_ADMIN"];

  const container = new ContainerBuilder();

  for (const categoryName of categoryOrder) {
    const categoryCommands = categories[categoryName];
    if (categoryCommands && categoryCommands.length > 0) {
      const title = new TextDisplayBuilder().setContent(`# ${categoryName}`);
      container.addTextDisplayComponents(title);

      const description = new TextDisplayBuilder().setContent(
        categoryCommands.map(c => `\`/${c.name}\` - ${c.description}`).join('\n')
      );
      container.addTextDisplayComponents(description);

      for (let i = 0; i < categoryCommands.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        const rowCommands = categoryCommands.slice(i, i + 5);

        rowCommands.forEach(command => {
          const button = new ButtonBuilder()
            .setCustomId(`help:${command.name}`)
            .setLabel(command.name)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasAccess(command, userAccess));
          row.addComponents(button);
        });
        container.addActionRowComponents(row);
      }
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  }

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}