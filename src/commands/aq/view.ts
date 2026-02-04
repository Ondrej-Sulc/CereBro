import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from "discord.js";
import { AQState, SectionKey, getState } from "./state";

export function buildProgressLines(state: AQState): string {
  const allUserIds = new Set<string>();
  for (const section of ["s1", "s2", "s3"] as SectionKey[]) {
    for (const uid of Object.keys(state.players[section])) allUserIds.add(uid);
  }
  const sorted = Array.from(allUserIds).sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : 1
  );
  if (sorted.length === 0) return "No players registered";

  const lines: string[] = [];
  for (const userId of sorted) {
    const s1 = state.players.s1[userId]?.done ? "🏆" : "⚔️";
    const s2 = state.players.s2[userId]?.done ? "🏆" : "⚔️";
    const s3 = state.players.s3[userId]?.done ? "🏆" : "⚔️";
    lines.push(`${s1} ${s2} ${s3} <@${userId}>`);
  }
  lines.push("");
  lines.push("Legend: ⚔️ = In Progress, 🏆 = Completed");
  return lines.join("\n");
}

export function buildAQContainer(
  state: AQState,
  channelName: string,
  battlegroupName: string
): ContainerBuilder {
  const container = new ContainerBuilder();

  const headerImage = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL("attachment://aq_header.png")
  );
  container.addMediaGalleryComponents(headerImage);
  const header = new TextDisplayBuilder().setContent(
    `Status: ${state.mapStatus}`
  );
  const endTs = Math.floor(new Date(state.endTimeIso).getTime() / 1000);
  const timing = new TextDisplayBuilder().setContent(`Ends <t:${endTs}:R>`);
  const progress = new TextDisplayBuilder().setContent(
    buildProgressLines(state)
  );

  container.addTextDisplayComponents(header, timing);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(progress);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const pathButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("aq:path:s1")
      .setLabel("Path S1")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("aq:path:s2")
      .setLabel("Path S2")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("aq:path:s3")
      .setLabel("Path S3")
      .setStyle(ButtonStyle.Secondary)
  );

  container.addActionRowComponents(pathButtons);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const clearButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("aq:boss:s1")
      .setLabel("Miniboss S1")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!!state.minibossS1),
    new ButtonBuilder()
      .setCustomId("aq:boss:s2")
      .setLabel("Miniboss S2")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!!state.minibossS2),
    new ButtonBuilder()
      .setCustomId("aq:map_clear")
      .setLabel("MAP Complete")
      .setStyle(ButtonStyle.Success)
  );

  container.addActionRowComponents(clearButtons);
  return container;
}

export async function updateAqMessage(
  interaction: { client: any },
  channelId: string
) {
  const state = await getState(channelId);
  if (!state) return;
  try {
    const channel = await interaction.client.channels.fetch(channelId);
    const message = await (channel as any).messages.fetch(state.messageId);
    // state.roleId now contains the battlegroup name, not an ID
    const container = buildAQContainer(state, channel.name, ''); // battlegroupName is unused here
    await message.edit({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (e) {
    // best-effort update
  }
}
