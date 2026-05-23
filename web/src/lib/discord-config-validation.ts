export type MissingDiscordChannelErrorPayload = {
  code: "MISSING_DISCORD_CHANNELS";
  missingBattlegroups: number[];
  context: "attack-plan" | "defense-plan";
};

const PREFIX = "DISCORD_CONFIG_ERROR:";

export function createMissingDiscordChannelMessage(payload: MissingDiscordChannelErrorPayload): string {
  const normalized: MissingDiscordChannelErrorPayload = {
    code: "MISSING_DISCORD_CHANNELS",
    missingBattlegroups: [...new Set(payload.missingBattlegroups)]
      .filter((bg) => Number.isInteger(bg) && bg >= 1 && bg <= 3)
      .sort((a, b) => a - b),
    context: payload.context,
  };

  return `${PREFIX}${JSON.stringify(normalized)}`;
}

export function parseMissingDiscordChannelMessage(message: string): MissingDiscordChannelErrorPayload | null {
  if (!message.startsWith(PREFIX)) return null;

  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as Partial<MissingDiscordChannelErrorPayload>;
    if (
      parsed.code !== "MISSING_DISCORD_CHANNELS" ||
      (parsed.context !== "attack-plan" && parsed.context !== "defense-plan") ||
      !Array.isArray(parsed.missingBattlegroups)
    ) {
      return null;
    }

    const missingBattlegroups = parsed.missingBattlegroups
      .filter((bg): bg is number => Number.isInteger(bg) && bg >= 1 && bg <= 3)
      .sort((a, b) => a - b);

    if (missingBattlegroups.length === 0) return null;

    return {
      code: "MISSING_DISCORD_CHANNELS",
      context: parsed.context,
      missingBattlegroups: [...new Set(missingBattlegroups)],
    };
  } catch {
    return null;
  }
}

export type BattlegroupChannelConfig = {
  battlegroup1ChannelId: string | null;
  battlegroup2ChannelId: string | null;
  battlegroup3ChannelId: string | null;
};

export function findMissingBattlegroupChannels(
  config: BattlegroupChannelConfig,
  requiredBattlegroups: number[]
): number[] {
  return [...new Set(requiredBattlegroups)]
    .filter((bg) => Number.isInteger(bg) && bg >= 1 && bg <= 3)
    .filter((bg) => {
      const channelId = bg === 1
        ? config.battlegroup1ChannelId
        : bg === 2
          ? config.battlegroup2ChannelId
          : config.battlegroup3ChannelId;

      return !channelId;
    })
    .sort((a, b) => a - b);
}
