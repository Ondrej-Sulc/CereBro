import { Client, Routes } from "discord.js";
import logger from "./loggerService";

type AppEmojiInfo = {
  id: string;
  name: string;
  animated?: boolean;
};

let isLoaded = false;
let applicationId: string | null = null;
const nameToMarkup = new Map<string, string>();

export async function loadApplicationEmojis(client: Client): Promise<void> {
  // Ensure application is ready and get ID
  const app = await client.application?.fetch();
  if (!app?.id) return;

  applicationId = app.id;

  // Fetch application emojis via REST
  const emojisResponse = (await client.rest.get(
    Routes.applicationEmojis(applicationId)
  )) as unknown;

  // The response shape can vary by API wrapper/version. Normalize it.
  const emojis: AppEmojiInfo[] = Array.isArray(emojisResponse)
    ? (emojisResponse as AppEmojiInfo[])
    : Array.isArray((emojisResponse as any)?.items)
    ? ((emojisResponse as any).items as AppEmojiInfo[])
    : Array.isArray((emojisResponse as any)?.emojis)
    ? ((emojisResponse as any).emojis as AppEmojiInfo[])
    : [];

  nameToMarkup.clear();
  for (const e of emojis) {
    if (!e.name || !e.id) continue;
    const markup = e.animated
      ? `<a:${e.name}:${e.id}>`
      : `<:${e.name}:${e.id}>`;
    nameToMarkup.set(e.name, markup);
  }
  isLoaded = true;

  if (emojis.length === 0) {
    // Emit a compact debug once to help diagnose without leaking tokens
    logger.warn(
      "⚠️ Application emojis list appears empty or unrecognized response shape."
    );
  }
}

export function getApplicationEmojiMarkupByName(name: string): string | null {
  if (!isLoaded) return null;
  return nameToMarkup.get(name) ?? null;
}
