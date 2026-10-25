import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const detailViews = [
  { label: "Info", value: "info" },
  { label: "Abilities", value: "abilities" },
  { label: "Immunities & resistances", value: "immunities" },
  { label: "Attacks", value: "attacks" },
  { label: "Tags", value: "tags" },
  { label: "Duels", value: "duel" },
];

export function createChampionActionRow(championId: string, activeView: string): ActionRowBuilder<ButtonBuilder>[] {
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonCount = 0;

  // Determine which buttons to show.
  // If we are on the overview page, show all detail views.
  // If we are on a detail page, show the other detail views.
  const viewsToShow = activeView === 'overview' 
    ? detailViews 
    : detailViews.filter(v => v.value !== activeView);

  for (const view of viewsToShow) {
    if (buttonCount === 5) {
      actionRows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonCount = 0;
    }

    const button = new ButtonBuilder()
      .setCustomId(`champion:${championId}:${view.value}`)
      .setLabel(view.label)
      .setStyle(ButtonStyle.Secondary);

    currentRow.addComponents(button);
    buttonCount++;
  }
  // Push the last row if it has any buttons
  if (buttonCount > 0) {
    actionRows.push(currentRow);
  }

  return actionRows;
}

export function createPaginationActionRow(
  championId: string,
  view: string,
  currentPage: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const prevButton = new ButtonBuilder()
    .setCustomId(
      `champion_page:${championId}:${view}:${
        currentPage - 1
      }`
    )
    .setLabel("Previous")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(
      `champion_page:${championId}:${view}:${
        currentPage + 1
      }`
    )
    .setLabel("Next")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === totalPages);

  const pageIndicator = new ButtonBuilder()
    .setCustomId(`champion_page:${championId}:${view}:${currentPage}`)
    .setLabel(`Page ${currentPage} / ${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  row.addComponents(prevButton, pageIndicator, nextButton);
  return row;
}
