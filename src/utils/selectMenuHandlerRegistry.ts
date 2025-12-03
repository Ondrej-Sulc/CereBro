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
  // First, try exact match
  if (selectMenuHandlers.has(customId)) {
    return selectMenuHandlers.get(customId);
  }

  // Then, try prefix match
  for (const [key, handler] of selectMenuHandlers.entries()) {
    if (customId.startsWith(key)) {
      return handler;
    }
  }

  return undefined;
}
