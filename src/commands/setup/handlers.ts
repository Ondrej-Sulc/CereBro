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

/**
 * Register all handlers for the setup wizard
 */
export function registerSetupHandlers() {
  // --- Step 1: Officer Role Selection ---
  registerButtonHandler("setup:step1_intro", async (interaction) => {
    const embed = new EmbedBuilder()
      .setTitle("Step 1: Officer Role")
      .setDescription(
        "Please select the Discord role that represents your **Alliance Officers**.\n" +
        "Users with this role will have access to administrative commands (like `/alliance manage`, `/aq`, etc.)."
      )
      .setColor(0x0ea5e9);

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("setup:select_officer_role")
        .setPlaceholder("Select Officer Role")
        .setMaxValues(1)
    );

    await interaction.update({
      embeds: [embed],
      components: [row],
    });
  });

  registerSelectMenuHandler("setup:select_officer_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    const roleId = interaction.values[0];

    // Save to DB
    await prisma.alliance.upsert({
      where: { guildId: interaction.guildId! },
      update: { officerRole: roleId },
      create: { guildId: interaction.guildId!, officerRole: roleId, name: interaction.guild!.name },
    });

    // Move to next step
    const embed = new EmbedBuilder()
        .setTitle("Step 2: Battlegroup 1 Role")
        .setDescription(
            "Now, select the role for **Battlegroup 1**.\n" +
            "If you don't use battlegroup roles, you can skip this step."
        )
        .setColor(0x0ea5e9);

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
  });

  // --- Step 2: BG1 Role ---
  registerSelectMenuHandler("setup:select_bg1_role", async (interaction) => {
    if (!interaction.isRoleSelectMenu()) return;
    const roleId = interaction.values[0];
    await updateAllianceRole(interaction.guildId!, "battlegroup1Role", roleId);
    await promptBG2(interaction);
  });

  registerButtonHandler("setup:skip_bg1", async (interaction) => {
    await updateAllianceRole(interaction.guildId!, "battlegroup1Role", null);
    await promptBG2(interaction);
  });

  // --- Step 3: BG2 Role ---
  async function promptBG2(interaction: MessageComponentInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("Step 3: Battlegroup 2 Role")
        .setDescription("Select the role for **Battlegroup 2**.")
        .setColor(0x0ea5e9);
    
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
    await updateAllianceRole(interaction.guildId!, "battlegroup2Role", interaction.values[0]);
    await promptBG3(interaction);
  });

  registerButtonHandler("setup:skip_bg2", async (interaction) => {
    await updateAllianceRole(interaction.guildId!, "battlegroup2Role", null);
    await promptBG3(interaction);
  });

   // --- Step 4: BG3 Role ---
   async function promptBG3(interaction: MessageComponentInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("Step 4: Battlegroup 3 Role")
        .setDescription("Select the role for **Battlegroup 3**.")
        .setColor(0x0ea5e9);
    
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
    await updateAllianceRole(interaction.guildId!, "battlegroup3Role", interaction.values[0]);
    await promptSync(interaction);
  });

  registerButtonHandler("setup:skip_bg3", async (interaction) => {
    await updateAllianceRole(interaction.guildId!, "battlegroup3Role", null);
    await promptSync(interaction);
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
          .setColor(0x10b981); // Emerald 500

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
      await interaction.deferUpdate();
      try {
          const result = await syncRolesForGuild(interaction.guild!);
          
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
            .setColor(0x10b981)
            .setThumbnail("https://cerebro-bot.com/CereBro_logo_512.png");
            
          await interaction.editReply({ embeds: [embed], components: [] });

      } catch (error) {
          logger.error({ error }, "Error during setup sync");
          await interaction.followUp({ content: "An error occurred during sync. Please try `/alliance sync-roles` manually.", flags: MessageFlags.Ephemeral });
      }
  });

}

async function updateAllianceRole(guildId: string, field: string, roleId: string | null) {
    await prisma.alliance.update({
        where: { guildId },
        data: { [field]: roleId }
    });
}
