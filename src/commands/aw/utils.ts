import { getChampionByName } from "../../services/championService";
import { getApplicationEmojiMarkupByName } from "../../services/applicationEmojiService";
import { MergedAssignment } from "./types";
import { Client } from "discord.js";
import { createEmojiResolver } from "../../utils/emojiResolver";

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const getEmoji = async (championName: string, client?: Client): Promise<string> => {
  if (!championName) return "";
  const champion = await getChampionByName(championName);
  if (!champion || !champion.discordEmoji) return "";

  let emoji = champion.discordEmoji;

  if (client) {
      const resolver = createEmojiResolver(client);
      // Fix markup IDs
      emoji = resolver(emoji);
      
      // If it wasn't markup (e.g. just "Hercules"), try to find the emoji markup
      if (!emoji.startsWith("<")) {
          const appEmoji = getApplicationEmojiMarkupByName(emoji);
          if (appEmoji) return appEmoji;
          
          const clientEmoji = client.emojis.cache.find(e => e.name === emoji);
          if (clientEmoji) return clientEmoji.toString();
      }
      return emoji;
  }

  if (
    emoji.startsWith("<") &&
    emoji.endsWith(">")
  ) {
    return emoji;
  }
  return getApplicationEmojiMarkupByName(emoji) || "";
};

export const formatAssignment = async (
  assignment: MergedAssignment
): Promise<string> => {
  const { attackerName, defenderName, attackTactic, defenseTactic } =
    assignment;
  const [attackerEmoji, defenderEmoji] = await Promise.all([
    getEmoji(attackerName),
    getEmoji(defenderName),
  ]);

  let assignmentString = `${attackerEmoji} **${attackerName}** vs ${defenderEmoji} **${defenderName}**`;
  if (attackTactic) assignmentString += ` | ${attackTactic}`;
  if (defenseTactic) assignmentString += ` | ${defenseTactic}`;

  return assignmentString;
};
