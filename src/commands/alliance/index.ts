import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, MessageFlags, AutocompleteInteraction, ChannelType } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { handleAllianceToggleFeature } from './toggle-feature';
import { handleAllianceJoin } from './join';
import { handleAllianceName } from './name';
import { handleAllianceConfigRoles } from './config-roles';
import { handleAllianceConfigChannels } from './config-channels';
import { handleAllianceSyncRoles } from './sync-roles';
import { handleAllianceView } from './view';
import { handleAllianceManageRemove } from './manage/remove';
import { handleAllianceManageList } from './manage/list';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alliance')
    .setDescription('Manage your alliance settings.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle-feature')
        .setDescription('Enable or disable a feature for your alliance.')
        .addStringOption((option) =>
          option
            .setName('feature')
            .setDescription('The feature to toggle.')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether the feature should be enabled or disabled.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join the alliance associated with this server.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('name')
        .setDescription("Update your alliance's name.")
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The new name for the alliance.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('config-roles')
        .setDescription('Configure officer and battlegroup roles for your alliance.')
        .addRoleOption(option => option.setName('officer').setDescription('The role for alliance officers.'))
        .addRoleOption(option => option.setName('battlegroup1').setDescription('The role for Battlegroup 1.'))
        .addRoleOption(option => option.setName('battlegroup2').setDescription('The role for Battlegroup 2.'))
        .addRoleOption(option => option.setName('battlegroup3').setDescription('The role for Battlegroup 3.'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('config-channels')
        .setDescription('Configure notification channels for your alliance.')
        .addChannelOption(option => 
            option
                .setName('war-videos')
                .setDescription('The channel to post new war video notifications to.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption(option => 
            option
                .setName('bg1-channel')
                .setDescription('The channel for Battlegroup 1.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption(option => 
            option
                .setName('bg2-channel')
                .setDescription('The channel for Battlegroup 2.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption(option => 
            option
                .setName('bg3-channel')
                .setDescription('The channel for Battlegroup 3.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sync-roles')
        .setDescription('Sync officer and battlegroup roles from Discord to the bot.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('Display an overview of the alliance.')
    )
    .addSubcommandGroup(group =>
      group
        .setName('manage')
        .setDescription('Manage alliance members.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a player from the alliance roster.')
            .addUserOption(option => option.setName('user').setDescription('The user to remove.').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all players in the alliance roster.')
        )
    ),
  access: CommandAccess.USER,

  help: {
    group: "Alliance Tools",
    color: "sky",
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommand === 'toggle-feature' || subcommand === 'name' || subcommand === 'config-roles' || subcommand === 'config-channels' || subcommand === 'sync-roles' || subcommandGroup === 'manage') {
      const member = interaction.member;
      if (!member || typeof member.permissions === 'string' || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        // Also check for officer role
        const { prisma } = await import('../../services/prismaService.js');
        const player = await prisma.player.findFirst({ where: { discordId: interaction.user.id, alliance: { guildId: interaction.guildId! } } });
        if (!player || !player.isOfficer) {
            await interaction.reply({ content: 'You must be an administrator or an officer to use this command.', flags: [MessageFlags.Ephemeral] });
            return;
        }
      }
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (subcommandGroup === 'manage') {
      switch (subcommand) {
        case 'remove':
          await handleAllianceManageRemove(interaction);
          break;
        case 'list':
          await handleAllianceManageList(interaction);
          break;
      }
    } else {
      switch (subcommand) {
        case 'toggle-feature':
          await handleAllianceToggleFeature(interaction);
          break;
        case 'join':
          await handleAllianceJoin(interaction);
          break;
        case 'name':
          await handleAllianceName(interaction);
          break;
        case 'config-roles':
          await handleAllianceConfigRoles(interaction);
          break;
        case 'config-channels':
          await handleAllianceConfigChannels(interaction);
          break;
        case 'sync-roles':
          await handleAllianceSyncRoles(interaction);
          break;
        case 'view':
          await handleAllianceView(interaction);
          break;
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'role') {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.respond([]);
        return;
      }

      const query = String(focused.value || '').toLowerCase();

      const rolesCollection = await guild.roles.fetch();

      const filteredRoles = rolesCollection
        .filter(
          (r) =>
            !r.managed &&
            r.name !== '@everyone' &&
            r.name.toLowerCase().includes(query)
        )
        .first(25);

      await interaction.respond(
        filteredRoles.map((r) => ({ name: r.name, value: r.id }))
      );
    }
  },
};