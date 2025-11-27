import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  RoleSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessageFlags,
  MessageComponentInteraction,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { registerSelectMenuHandler } from "../../utils/selectMenuHandlerRegistry";
import { syncRolesForGuild } from "../alliance/sync-roles";
import logger from "../../services/loggerService";

const COLORS = {
  INFO: 0x0ea5e9,    // Sky 500
  SUCCESS: 0x10b981, // Emerald 500
} as const;

type AllianceRoleField = 'officerRole' | 'battlegroup1Role' | 'battlegroup2Role' | 'battlegroup3Role';

/**
 * Register all handlers for the setup wizard
 */
export function registerSetupHandlers() {
  // --- Step 1: Officer Role Selection ---
  registerButtonHandler("setup:step1_intro", async (interaction) => {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Step 1: Officer Role")
      .setDescription(
        "Please select the Discord role that represents your **Alliance Officers**.\n" +
        "Users with this role will have access to administrative commands (like `/alliance manage`, `/aq`, etc.)."
      )
      .setColor(COLORS.INFO);

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("setup:select_officer_role")
        .setPlaceholder("Select Officer Role")
        .setMaxValues(1)
    );

    try {
      await interaction.update({
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      logger.error({ error }, "Failed to update interaction in setup step 1");
      await interaction.followUp({ content: "Failed to display setup wizard. Please try again.", flags: MessageFlags.Ephemeral });
    }
  });

  registerSelectMenuHandler("setup:select_officer_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }

    const roleId = interaction.values[0];

    try {
      // Save to DB
      await prisma.alliance.upsert({
        where: { guildId: interaction.guildId },
        update: { officerRole: roleId },
        create: { guildId: interaction.guildId, officerRole: roleId, name: interaction.guild.name },
      });

      // Move to next step
      const embed = new EmbedBuilder()
          .setTitle("Step 2: Battlegroup 1 Role")
          .setDescription(
              "Now, select the role for **Battlegroup 1**.\n" +
              "If you don't use battlegroup roles, you can skip this step."
          )
          .setColor(COLORS.INFO);

      const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
              .setCustomId("setup:select_bg1_role")
              .setPlaceholder("Select BG1 Role (Optional)")
              .setMaxValues(1)
      );
      
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
              .setCustomId("setup:skip_bg1")
              .setLabel("Skip BG1")
              .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
          embeds: [embed],
          components: [row1, row2],
      });
    } catch (error) {
        logger.error({ error, guildId: interaction.guildId }, "Failed to process officer role selection");
        await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

  // --- Step 2: BG1 Role ---
  registerSelectMenuHandler("setup:select_bg1_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      const roleId = interaction.values[0];
      await updateAllianceRole(interaction.guildId, "battlegroup1Role", roleId);
      await promptBG2(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to process BG1 selection");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

  registerButtonHandler("setup:skip_bg1", async (interaction) => {
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      await updateAllianceRole(interaction.guildId, "battlegroup1Role", null);
      await promptBG2(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to skip BG1");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

  // --- Step 3: BG2 Role ---
  async function promptBG2(interaction: MessageComponentInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("Step 3: Battlegroup 2 Role")
        .setDescription("Select the role for **Battlegroup 2**.")
        .setColor(COLORS.INFO);
    
    const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId("setup:select_bg2_role")
            .setPlaceholder("Select BG2 Role (Optional)")
            .setMaxValues(1)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("setup:skip_bg2")
            .setLabel("Skip BG2")
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
  }

  registerSelectMenuHandler("setup:select_bg2_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      await updateAllianceRole(interaction.guildId, "battlegroup2Role", interaction.values[0]);
      await promptBG3(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to process BG2 selection");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

  registerButtonHandler("setup:skip_bg2", async (interaction) => {
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      await updateAllianceRole(interaction.guildId, "battlegroup2Role", null);
      await promptBG3(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to skip BG2");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

   // --- Step 4: BG3 Role ---
   async function promptBG3(interaction: MessageComponentInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("Step 4: Battlegroup 3 Role")
        .setDescription("Select the role for **Battlegroup 3**.")
        .setColor(COLORS.INFO);
    
    const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId("setup:select_bg3_role")
            .setPlaceholder("Select BG3 Role (Optional)")
            .setMaxValues(1)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("setup:skip_bg3")
            .setLabel("Skip BG3")
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
  }

  registerSelectMenuHandler("setup:select_bg3_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      await updateAllianceRole(interaction.guildId, "battlegroup3Role", interaction.values[0]);
      await promptSync(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to process BG3 selection");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });

  registerButtonHandler("setup:skip_bg3", async (interaction) => {
    if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }
    try {
      await updateAllianceRole(interaction.guildId, "battlegroup3Role", null);
      await promptSync(interaction);
    } catch (error) {
      logger.error({ error, guildId: interaction.guildId }, "Failed to skip BG3");
      await interaction.reply({ content: "Failed to save configuration. Please try /setup again.", flags: MessageFlags.Ephemeral });
    }
  });


  // --- Step 5: Sync Confirmation ---
  async function promptSync(interaction: MessageComponentInteraction) {
      const embed = new EmbedBuilder()
          .setTitle("✅ Configuration Complete")
          .setDescription(
              "All roles have been configured!\n\n" +
              "**Final Step:** We need to sync these settings with your current member list. " +
              "This will update the internal permissions for all users who have already registered.\n\n" +
              "Click **Sync Roles** to finish."
          )
          .setColor(COLORS.SUCCESS);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
              .setCustomId("setup:trigger_sync")
              .setLabel("Sync Roles & Finish")
              .setStyle(ButtonStyle.Success)
              .setEmoji("🔄")
      );

      await interaction.update({ embeds: [embed], components: [row] });
  }

  registerButtonHandler("setup:trigger_sync", async (interaction) => {
      if (!interaction.guild) {
          await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
          return;
      }
      await interaction.deferUpdate();
      try {
          const result = await syncRolesForGuild(interaction.guild);
          
          const embed = new EmbedBuilder()
            .setTitle("🎉 Setup Complete!")
            .setDescription(
                `Successfully synced roles for your alliance!\n\n` +
                `✅ **${result.created}** new profiles created.\n` +
                `🔄 **${result.updated}** existing profiles updated.\n\n` +
                "**What's Next?**\n" +
                "• All members with roles have been auto-registered.\n" +
                "• Use `/alliance view` to see your roster overview.\n" +
                "• Explore commands with `/help`."
            )
            .setColor(COLORS.SUCCESS)
            .setThumbnail("https://cerebro-bot.com/CereBro_logo_512.png");
            
          await interaction.editReply({ embeds: [embed], components: [] });

      } catch (error) {
          logger.error({ error }, "Error during setup sync");
          await interaction.followUp({ content: "An error occurred during sync. Please try `/alliance sync-roles` manually.", flags: MessageFlags.Ephemeral });
      }
  });

}

async function updateAllianceRole(guildId: string, field: AllianceRoleField, roleId: string | null) {
    try {
        await prisma.alliance.update({
            where: { guildId },
            data: { [field]: roleId }
        });
    } catch (error) {
        logger.error({ error, guildId, field }, "Failed to update alliance role");
        throw new Error("Failed to update alliance configuration. Please try /setup again.");
    }
}