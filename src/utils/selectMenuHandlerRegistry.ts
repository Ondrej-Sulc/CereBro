import { AnySelectMenuInteraction, Collection } from "discord.js";

type SelectMenuHandler = (interaction: AnySelectMenuInteraction) => Promise<void>;

const selectMenuHandlers = new Collection<string, SelectMenuHandler>();

export function registerSelectMenuHandler(
  customId: string,
  handler: SelectMenuHandler
) {
  selectMenuHandlers.set(customId, handler);
}

export function getSelectMenuHandler(
  customId: string
): SelectMenuHandler | undefined {
  return selectMenuHandlers.get(customId);
}
