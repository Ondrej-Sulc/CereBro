import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentBuilder, ChatInputCommandInteraction, InteractionEditReplyOptions } from "discord.js";
import { parse } from "csv-parse/sync";
import { handleExport } from "../commands/roster/export";

const db = vi.hoisted(() => ({
  botUser: { findUnique: vi.fn() },
  player: { findFirst: vi.fn() },
  roster: { findMany: vi.fn() },
}));
vi.mock("../services/prismaService.js", () => ({ prisma: db }));

async function exportedCsv() {
  const editReply = vi.fn<(options: InteractionEditReplyOptions) => Promise<void>>().mockResolvedValue(undefined);
  const interaction = {
    user: { id: "discord-player" },
    isChatInputCommand: () => true,
    options: { get: () => null },
    deferReply: vi.fn(),
    editReply,
  };
  await handleExport(interaction as unknown as ChatInputCommandInteraction);
  const attachment = editReply.mock.calls[0][0].files?.[0];
  expect(attachment).toBeInstanceOf(AttachmentBuilder);
  const buffer = (attachment as AttachmentBuilder).attachment;
  expect(Buffer.isBuffer(buffer)).toBe(true);
  return (buffer as Buffer).toString("utf8");
}

beforeEach(() => {
  vi.clearAllMocks();
  db.botUser.findUnique.mockResolvedValue({ isBotAdmin: false });
  db.player.findFirst.mockResolvedValue({ id: "player", ingameName: "Summoner" });
});

describe("roster CSV export", () => {
  it("preserves the original columns and exports exact signature and ascension levels for header-based consumers", async () => {
    db.roster.findMany.mockResolvedValue([
      { champion: { name: "Doctor Doom" }, stars: 7, rank: 4, isAwakened: true, isAscended: true, sigLevel: 173, ascensionLevel: 5 },
      { champion: { name: "Hulk" }, stars: 6, rank: 5, isAwakened: false, isAscended: false, sigLevel: 0, ascensionLevel: 0 },
    ]);

    const csv = await exportedCsv();
    expect(csv).toBe('Champion,Stars,Rank,IsAwakened,IsAscended,SigLevel,AscensionLevel\n"Doctor Doom",7,4,true,true,173,5\n"Hulk",6,5,false,false,0,0\n');
    const rows: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    expect(rows).toEqual([
      { Champion: "Doctor Doom", Stars: "7", Rank: "4", IsAwakened: "true", IsAscended: "true", SigLevel: "173", AscensionLevel: "5" },
      { Champion: "Hulk", Stars: "6", Rank: "5", IsAwakened: "false", IsAscended: "false", SigLevel: "0", AscensionLevel: "0" },
    ]);
  });

  it("exports zero for unawakened or unknown signature levels and normalizes legacy ascension without changing stored rows", async () => {
    const roster = [
      { champion: { name: "Hulk" }, stars: 6, rank: 5, isAwakened: false, isAscended: true, sigLevel: 100, ascensionLevel: 0 },
      { champion: { name: "Thor" }, stars: 7, rank: 3, isAwakened: true, isAscended: true, sigLevel: null, ascensionLevel: null },
      { champion: { name: "Vision" }, stars: 6, rank: 1, isAwakened: false, isAscended: false, sigLevel: null, ascensionLevel: null },
    ];
    const original = structuredClone(roster);
    db.roster.findMany.mockResolvedValue(roster);

    const rows: Record<string, string>[] = parse(await exportedCsv(), { columns: true });
    expect(rows.map(row => [row.SigLevel, row.AscensionLevel])).toEqual([["0", "1"], ["0", "1"], ["0", "0"]]);
    expect(roster).toEqual(original);
  });

  it("round-trips champion names containing CSV punctuation", async () => {
    db.roster.findMany.mockResolvedValue([
      { champion: { name: 'Hero, the "Champion"\nVariant' }, stars: 7, rank: 2, isAwakened: true, isAscended: false, sigLevel: 1, ascensionLevel: 0 },
    ]);

    const rows: Record<string, string>[] = parse(await exportedCsv(), { columns: true });
    expect(rows[0].Champion).toBe('Hero, the "Champion"\nVariant');
    expect(rows[0].SigLevel).toBe("1");
  });
});
