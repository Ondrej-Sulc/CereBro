import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  AutocompleteInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleAdminAutocomplete } from "./autocomplete";
import { handleChampionAdd, handleChampionUpdateImages, handleChampionUpdateTags, handleChampionSyncSheet } from "./champion/handlers";
import { handleAbilityAdd, handleAbilityRemove, handleAbilityDraft } from "./ability/handlers";
import { showAttackModal } from "./attack/add";
import { AbilityLinkType, DuelSource } from "@prisma/client";
import { handleGlossaryLink, handleGlossaryUnlink, handleGlossaryUpdateAbility, handleGlossaryUpdateCategory, handleSetEmoji, handleRemoveEmoji } from "./glossary/handlers";
import { handleDuelUpload } from "./duel/upload";
import { handleDuelReview } from "./duel/review";
import { handleBotAdminAdd, handleBotAdminRemove } from "./bot-admin/handlers";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Administrative commands.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName("champion")
        .setDescription("Admin commands for managing champions.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Adds a new champion to the database.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("update_images")
            .setDescription("Updates the images for an existing champion.")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("Name of the champion to update.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("primary_image")
                .setDescription("URL of the new primary image.")
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName("secondary_image")
                .setDescription("URL of the new secondary image.")
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName("hero_image")
                .setDescription("URL of the new hero image.")
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("update_tags")
            .setDescription("Updates the tags for an existing champion.")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("Name of the champion to update.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("tags_image")
                .setDescription("URL of the new tags image.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("sync-sheet")
            .setDescription("Syncs the champion database with Google Sheets.")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("ability")
        .setDescription("Admin commands for managing champion abilities.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Adds an ability or immunity to a champion.")
            .addStringOption((option) =>
              option
                .setName("champion")
                .setDescription("Name of the champion.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Type of link.")
                .setRequired(true)
                .addChoices(
                  { name: "Ability", value: AbilityLinkType.ABILITY },
                  { name: "Immunity", value: AbilityLinkType.IMMUNITY }
                )
            )
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("Name of the ability or immunity.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("source")
                .setDescription(
                  "Source of the ability (e.g., Signature Ability, SP1, Synergy)."
                )
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("synergy-champions")
                .setDescription("Comma-separated list of synergy champion names.")
                .setRequired(false)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Removes an ability or immunity from a champion.")
            .addStringOption((option) =>
              option
                .setName("champion")
                .setDescription("Name of the champion.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Type of link to remove.")
                .setRequired(true)
                .addChoices(
                  { name: "Ability", value: AbilityLinkType.ABILITY },
                  { name: "Immunity", value: AbilityLinkType.IMMUNITY }
                )
            )
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("Name of the ability or immunity.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("source")
                .setDescription("Source of the ability.")
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("synergy-champions")
                .setDescription("Comma-separated list of synergy champion names to remove.")
                .setRequired(false)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("draft")
            .setDescription(
              "Drafts abilities and immunities for a champion using AI."
            )
            .addStringOption((option) =>
              option
                .setName("champion")
                .setDescription("Name of the champion.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("model")
                .setDescription("The name of the model to use for the draft.")
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("attack")
        .setDescription("Admin commands for managing champion attacks.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Adds an attack to a champion.")
            .addStringOption((option) =>
              option
                .setName("champion")
                .setDescription("Name of the champion.")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("glossary")
        .setDescription("Admin commands for managing the glossary.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("link")
            .setDescription("Links an ability to a category.")
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("The name of the ability.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("category")
                .setDescription("The name of the category.")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("unlink")
            .setDescription("Unlinks an ability from a category.")
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("The name of the ability.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("category")
                .setDescription("The name of the category.")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("update-ability")
            .setDescription("Adds or updates a glossary ability.")
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("The name of the ability.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("The description of the ability.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("update-category")
            .setDescription("Adds or updates a glossary category.")
            .addStringOption((option) =>
              option
                .setName("category")
                .setDescription("The name of the category.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("The description of the category.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("emoji-set")
            .setDescription("Sets an emoji for a glossary ability.")
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("The ability to set the emoji for.")
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addAttachmentOption((option) =>
              option
                .setName("image")
                .setDescription("The image for the emoji.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("emoji-remove")
            .setDescription("Removes an emoji from a glossary ability.")
            .addStringOption((option) =>
              option
                .setName("ability")
                .setDescription("The ability to remove the emoji from.")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("bot-admin")
        .setDescription("Manage bot administrators.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Adds a bot administrator.")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user to add as a bot administrator.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Removes a bot administrator.")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user to remove as a bot administrator.")
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("duel")
        .setDescription("Admin commands for managing duels.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("upload")
            .setDescription("Uploads duel data from a CSV file.")
            .addAttachmentOption((option) =>
              option
                .setName("csv")
                .setDescription("The CSV file to upload.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("source")
                .setDescription("The source of the duel data.")
                .setRequired(true)
                .addChoices(
                  { name: "GuiaMTC", value: DuelSource.GUIA_MTC },
                  { name: "CoCPit", value: DuelSource.COCPIT },
                  { name: "MCOCHUB", value: DuelSource.MCOCHUB }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("review")
            .setDescription("Reviews duel suggestions and reports.")
            .addStringOption((option) =>
              option
                .setName("status")
                .setDescription("The status of the duels to review.")
                .setRequired(true)
                .addChoices(
                  { name: "Suggested", value: "SUGGESTED" },
                  { name: "Outdated", value: "OUTDATED" }
                )
            )
        )
    ),
  access: CommandAccess.BOT_ADMIN,
  help: {
    group: "BOT_ADMIN",
    color: "red",
  },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { config } = await import("../../config.js");
    const authorizedUsers = config.DEV_USER_IDS || [];

    if (
      authorizedUsers.length === 0 ||
      !authorizedUsers.includes(interaction.user.id)
    ) {
      await interaction.reply({
        content: "You are not authorized to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === "champion") {
      if (subcommand === "add") {
        await handleChampionAdd(interaction);
      } else if (subcommand === "update_images") {
        await handleChampionUpdateImages(interaction);
      } else if (subcommand === "update_tags") {
        await handleChampionUpdateTags(interaction);
      } else if (subcommand === "sync-sheet") {
        await handleChampionSyncSheet(interaction);
      }
    } else if (group === "ability") {
      if (subcommand === "add") {
        await handleAbilityAdd(interaction);
      } else if (subcommand === "remove") {
        await handleAbilityRemove(interaction);
      } else if (subcommand === "draft") {
        await handleAbilityDraft(interaction);
      }
    } else if (group === "attack") {
      if (subcommand === "add") {
        const championName = interaction.options.getString("champion", true);
        await showAttackModal(interaction, championName);
      }
    } else if (group === "glossary") {
      if (subcommand === "link") {
        await handleGlossaryLink(interaction);
      } else if (subcommand === "unlink") {
        await handleGlossaryUnlink(interaction);
      } else if (subcommand === "update-ability") {
        await handleGlossaryUpdateAbility(interaction);
      } else if (subcommand === "update-category") {
        await handleGlossaryUpdateCategory(interaction);
      } else if (subcommand === "emoji-set") {
        await handleSetEmoji(interaction);
      } else if (subcommand === "emoji-remove") {
        await handleRemoveEmoji(interaction);
      }
    } else if (group === "duel") {
      if (subcommand === "upload") {
        await handleDuelUpload(interaction);
      } else if (subcommand === "review") {
        await handleDuelReview(interaction);
      }
    } else if (group === "bot-admin") {
      if (subcommand === "add") {
        await handleBotAdminAdd(interaction);
      } else if (subcommand === "remove") {
        await handleBotAdminRemove(interaction);
      }
    }
  },
  async autocomplete(interaction) {
    await handleAdminAutocomplete(interaction);
  },
};