import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Guild,
} from "discord.js";
import { createEmojiResolver } from "../../../utils/emojiResolver";
import {
  ChampionWithRelations,
  SearchCoreParams,
} from "../../../types/search";
import { parseSearchCriteria } from "../utils";
import { getChampionDetailsString, getSearchHeader } from "./common";
import { CommandResult } from "../../../types/command";
import { getApplicationEmojiMarkupByName } from "../../../services/applicationEmojiService";

export async function generateChampionResponse(
  client: Client,
  guild: Guild | null,
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<CommandResult> {
  const resolveEmoji = createEmojiResolver(client);
  const container = new ContainerBuilder();
  container.setAccentColor(0x323232);

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const header = getSearchHeader(searchCriteria, totalChampions, false);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  let totalChampString = "";
  champions.forEach(champion => {
    const capitalizedClassName =
      champion.class.charAt(0).toUpperCase() +
      champion.class.slice(1).toLowerCase();
    const classEmoji = getApplicationEmojiMarkupByName(capitalizedClassName);
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    let champString = `### ${championEmoji} ${champion.name} ${classEmoji || capitalizedClassName}`;
    const details = getChampionDetailsString(champion, parsedSearchCriteria);
    if (details) {
      champString += `\n${details}`;
    }
    totalChampString += champString + "\n";
  });
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(totalChampString));

  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`search:prev:${searchId}:${currentPage}`)
        .setLabel("< Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`search:next:${searchId}:${currentPage}`)
        .setLabel("Next >")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(row);
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
