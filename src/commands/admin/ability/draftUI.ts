import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { formatAbilitySource } from "../../../domain/ability-source";

export function buildDraftLoadingContainerV2(championName: string): {
  components: ContainerBuilder[];
  flags: number;
  embeds: never[];
} {
  const container = new ContainerBuilder();
  container.setAccentColor(0x5865f2); // Discord Blurple

  const title = new TextDisplayBuilder().setContent(
    `## Drafting Abilities for ${championName}`
  );
  const description = new TextDisplayBuilder().setContent(
    "Please wait while the AI drafts the abilities. This may take a moment..."
  );
  container.addTextDisplayComponents(title, description);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    embeds: [],
  };
}

export function buildDraftContainerV2(
  championName: string,
  championId: number,
  draft: any
): { components: ContainerBuilder[]; flags: number; embeds: never[] } {
  const container = new ContainerBuilder();
  container.setAccentColor(0x5865f2);

  const title = new TextDisplayBuilder().setContent(
    `## Drafted Abilities for ${championName}`
  );
  const description = new TextDisplayBuilder().setContent(
    "Please review the drafted abilities below and choose an action."
  );
  container.addTextDisplayComponents(title, description);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (draft.abilities?.length > 0) {
    const abilitiesTitle = new TextDisplayBuilder().setContent("### Abilities");
    const abilitiesBody = new TextDisplayBuilder().setContent(
      draft.abilities
        .map((a: any) => `**${a.name}**: ${formatAbilitySource(a) || "-"}`)
        .join("\n")
    );
    container.addTextDisplayComponents(abilitiesTitle, abilitiesBody);
  }

  if (draft.immunities?.length > 0) {
    const immunitiesTitle = new TextDisplayBuilder().setContent(
      "### Immunities"
    );
    const immunitiesBody = new TextDisplayBuilder().setContent(
      draft.immunities
        .map((i: any) => `**${i.name}**: ${formatAbilitySource(i) || "-"}`)
        .join("\n")
    );
    container.addTextDisplayComponents(immunitiesTitle, immunitiesBody);
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm-ability-draft_${championId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest-ability-draft_${championId}`)
      .setLabel("Suggest Edits")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("cancel-ability-draft")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );
  container.addActionRowComponents(row);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    embeds: [],
  };
}

export function buildDraftSuccessContainerV2(
  championName: string,
  message: string
): { components: ContainerBuilder[]; flags: number; embeds: never[] } {
  const container = new ContainerBuilder();
  container.setAccentColor(0x57f287); // Green

  const title = new TextDisplayBuilder().setContent(
    `## Abilities for ${championName}`
  );
  const description = new TextDisplayBuilder().setContent(message);
  container.addTextDisplayComponents(title, description);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    embeds: [],
  };
}

export function buildDraftErrorContainerV2(errorMessage: string): {
  components: ContainerBuilder[];
  flags: number;
  embeds: never[];
} {
  const container = new ContainerBuilder();
  container.setAccentColor(0xed4245); // Red

  const title = new TextDisplayBuilder().setContent("## An Error Occurred");
  const description = new TextDisplayBuilder().setContent(errorMessage);
  container.addTextDisplayComponents(title, description);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    embeds: [],
  };
}
