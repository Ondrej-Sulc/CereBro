import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { getRoster, RosterWithChampion } from "../../services/rosterService";
import { handleProfileRemove } from "./remove";
import { handleProfileRename } from "./rename";
import { handleProfileSwitch } from "./switch";

import { getApplicationEmojiMarkupByName } from "../../services/applicationEmojiService";

function buildRosterSummary(
  roster: RosterWithChampion[],
  container: ContainerBuilder
) {
  const byStar = roster.reduce((acc, champ) => {
    if (!acc[champ.stars]) {
      acc[champ.stars] = [];
    }
    acc[champ.stars].push(champ);
    return acc;
  }, {} as Record<number, RosterWithChampion[]>);

  Object.entries(byStar)
    .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by star level descending
    .forEach(([stars, champions]: [string, RosterWithChampion[]]) => {
      let starSummary = `### ${"⭐".repeat(
        parseInt(stars)
      )} ${stars}-Star Champions (${champions.length} total)\n`;

      const byRank = (champions as RosterWithChampion[]).reduce(
        (acc: Record<number, number>, champ: RosterWithChampion) => {
          acc[champ.rank] = (acc[champ.rank] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>
      );

      starSummary += `**By Rank:** `;
      starSummary +=
        Object.entries(byRank)
          .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by rank descending
          .map(([rank, count]) => `R${rank}: ${count}`)
          .join(" | ") || "N/A";
      starSummary += "\n";

      const byClass = (champions as RosterWithChampion[]).reduce(
        (acc: Record<string, number>, champ: RosterWithChampion) => {
          acc[champ.champion.class] = (acc[champ.champion.class] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      starSummary += `**By Class:** `;
      starSummary +=
        Object.entries(byClass)
          .map(([className, count]) => {
            const capitalizedClassName =
              className.charAt(0).toUpperCase() +
              className.slice(1).toLowerCase();
            const emoji = getApplicationEmojiMarkupByName(capitalizedClassName);
            return `${emoji || capitalizedClassName}${count}`;
          })
          .join(" | ") || "N/A";

      const starContent = new TextDisplayBuilder().setContent(starSummary);
      container.addTextDisplayComponents(starContent);
    });
}

import { getActivePlayer } from "../../utils/playerHelper";

async function renderProfile(interaction: ChatInputCommandInteraction, statusMessage?: string) {
  const [activeProfile, allProfiles] = await Promise.all([
    getActivePlayer(interaction.user.id),
    prisma.player.findMany({
      where: { discordId: interaction.user.id },
    }),
  ]);

  if (!activeProfile) {
    await interaction.editReply(
      "You do not have an active profile. Use `/profile switch` to set one, or `/profile add` to create one."
    );
    return null;
  }

  const container = new ContainerBuilder();

  if (statusMessage) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusMessage));
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  const title = new TextDisplayBuilder().setContent(
    `# 👤 Profile for ${activeProfile.ingameName} ${activeProfile.isActive ? "*(Active)*" : ""}`
  );
  container.addTextDisplayComponents(title);

  // Alliance and Timezone Info
  const allianceName = activeProfile.alliance
    ? activeProfile.alliance.name
    : "Not in an alliance";
  const generalInfo = new TextDisplayBuilder().setContent(
    `**Alliance:** ${allianceName}\n**Timezone:** 🕒 ${activeProfile.timezone || "Not set"}`
  );
  container.addTextDisplayComponents(generalInfo);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Prestige Info
  let prestigeInfo = "## 🏆 Prestige\n";
  prestigeInfo += `**Summoner:** ${activeProfile.summonerPrestige || "N/A"} | `;
  prestigeInfo += `**Champion:** ${activeProfile.championPrestige || "N/A"} | `;
  prestigeInfo += `**Relic:** ${activeProfile.relicPrestige || "N/A"}`;
  const prestigeComponent = new TextDisplayBuilder().setContent(prestigeInfo);
  container.addTextDisplayComponents(prestigeComponent);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Roster Summary
  const roster = await getRoster(activeProfile.id, null, null, null);

  if (typeof roster !== "string" && roster.length > 0) {
    const rosterTitle = new TextDisplayBuilder().setContent(
      `## 📈 Roster Summary (Total: ${roster.length})`
    );
    container.addTextDisplayComponents(rosterTitle);
    buildRosterSummary(roster, container);
  } else {
    const noRoster = new TextDisplayBuilder().setContent(
      "## 📈 Roster Summary\nNo roster data found. Use `/roster update` to add your champions."
    );
    container.addTextDisplayComponents(noRoster);
  }

  const components: (ContainerBuilder | ActionRowBuilder<any>)[] = [container];

  // Switch Profile Dropdown
  if (allProfiles.length > 1) {
    const switchRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:profile:switch")
        .setPlaceholder("Switch Active Profile...")
        .addOptions(
          allProfiles.map((p) => ({
            label: p.ingameName,
            value: p.ingameName,
            default: p.isActive,
          }))
        )
    );
    components.push(switchRow);
  }

  // Buttons
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("interactive:profile:timezone")
      .setLabel("Set Timezone")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`interactive:profile:rename:${activeProfile.ingameName}`)
      .setLabel("Rename")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`interactive:profile:delete:${activeProfile.ingameName}`)
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger)
  );
  components.push(buttonRow);

  return interaction.editReply({
    components,
    flags: [MessageFlags.IsComponentsV2],
  });
}

export async function handleView(interaction: ChatInputCommandInteraction) {
  const message = await renderProfile(interaction);
  if (!message) return;

  const collector = message.createMessageComponentCollector({
    time: 300000, // 5 minutes
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "You cannot use this menu.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (i.isStringSelectMenu()) {
      if (i.customId === "interactive:profile:switch") {
        await i.deferUpdate();
        const selectedProfileName = i.values[0];
        await handleProfileSwitch(i, selectedProfileName);
        await renderProfile(interaction); // Re-render the profile view
      }
    } else if (i.isButton()) {
      if (i.customId === "interactive:profile:timezone") {
        await i.reply({
          content: "Please use `/profile timezone` to set your timezone. Autocomplete is available to help you.",
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId.startsWith("interactive:profile:rename")) {
        const currentName = i.customId.split(":")[3];
        const modal = new ModalBuilder()
          .setCustomId("interactive:profile:rename:modal")
          .setTitle("Rename Profile")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("new_name")
                .setLabel("New Profile Name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(currentName)
            )
          );
        await i.showModal(modal);

        try {
          const submitted = await i.awaitModalSubmit({ time: 60000 });
          await submitted.deferUpdate();
          const renameMessage = await handleProfileRename(submitted, currentName, submitted.fields.getTextInputValue("new_name"));
          await renderProfile(interaction, renameMessage);
        } catch (err) {
          // Modal timed out
        }
      } else if (i.customId.startsWith("interactive:profile:delete")) {
        const profileName = i.customId.split(":")[3];
        const modal = new ModalBuilder()
          .setCustomId("interactive:profile:delete:modal")
          .setTitle("Delete Profile")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("confirm_name")
                .setLabel(`Type '''${profileName}''' to confirm deletion`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        await i.showModal(modal);

        try {
          const submitted = await i.awaitModalSubmit({ time: 60000 });
          const confirmName = submitted.fields.getTextInputValue("confirm_name");
          if (confirmName === profileName) {
            await submitted.deferUpdate();
            await handleProfileRemove(submitted, profileName);
            await renderProfile(interaction);
          } else {
            await submitted.reply({ content: "Profile name mismatch. Deletion cancelled.", flags: MessageFlags.Ephemeral });
          }
        } catch (err) {
          // Modal timed out
        }
      }
    }
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ content: "This menu has expired.", components: [] });
    } catch (err) {
      // Ignore errors if the message was deleted
    }
  });
}
