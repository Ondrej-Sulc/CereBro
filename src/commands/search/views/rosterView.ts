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
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../../types/search";
import { parseSearchCriteria } from "../utils";
import { getChampionDetailsString, getSearchHeader } from "./common";
import { CommandResult } from "../../../types/command";
import { getApplicationEmojiMarkupByName } from "../../../services/applicationEmojiService";

export async function generateRosterResponse(
  client: Client,
  guild: Guild | null,
  champions: RosterEntryWithChampionRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<CommandResult> {
  const resolveEmoji = createEmojiResolver(client);
  const container = new ContainerBuilder();

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const header = getSearchHeader(searchCriteria, totalChampions, true);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  let totalChampString = "";
  champions.forEach(entry => {
    const { champion } = entry;
    const capitalizedClassName =
      champion.class.charAt(0).toUpperCase() +
      champion.class.slice(1).toLowerCase();
    const classEmoji = getApplicationEmojiMarkupByName(capitalizedClassName);
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    const ascendedEmoji = entry.isAscended ? "🏆" : "";
    const awakenedEmoji = entry.isAwakened ? "★" : "☆";

    let champString = `### ${championEmoji} ${champion.name} ${classEmoji || capitalizedClassName} ${awakenedEmoji} ${entry.stars}* R${entry.rank} ${ascendedEmoji}`;
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
        .setCustomId(`roster_search:prev:${searchId}:${currentPage}`)
        .setLabel("< Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`roster_search:next:${searchId}:${currentPage}`)
        .setLabel("Next >")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(row);
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
