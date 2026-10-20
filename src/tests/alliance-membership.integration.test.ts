import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction, Guild } from "discord.js";

const boundaries = vi.hoisted(() => ({
  prisma: {},
  alliance: { findMany: vi.fn() },
  botUser: { upsert: vi.fn(), update: vi.fn() },
}));
vi.mock("../services/prismaService", () => ({ prisma: boundaries.prisma }));
vi.mock("../services/loggerService", () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { handleAllianceManageRemove } from "../commands/alliance/manage/remove";
import { syncRolesForGuild } from "../commands/alliance/sync-roles";
import { createMembershipDatabase } from "./fixtures/alliance-membership";

const db = createMembershipDatabase();
Object.assign(boundaries.prisma, db.prisma, { alliance: boundaries.alliance, botUser: boundaries.botUser });

const alliance = {
  id: "alliance-1", guildId: "guild-1", name: "Alliance", syncRolesFromDiscord: true,
  removeMissingMembers: true, officerRole: "officer-role", plannerRole: null,
  battlegroup1Role: "bg-role", battlegroup2Role: null, battlegroup3Role: null,
};

function guildWithDepartingMember(roles: string[] | null) {
  const member = (id: string, roleIds: string[]) => ({
    id,
    roles: { cache: new Set(roleIds) },
    user: { tag: id },
  });
  const members = [member("officer-discord", ["officer-role", "bg-role"])];
  if (roles) members.push(member("departing-discord", roles));
  return { id: "guild-1", members: { fetch: vi.fn(async () => new Map(members.map((entry) => [entry.id, entry]))) } } as unknown as Guild;
}

function interaction() {
  return {
    guildId: "guild-1", user: { tag: "Officer" },
    options: { getUser: () => ({ id: "departing-discord", tag: "Departing" }) },
    editReply: vi.fn(),
  };
}

describe("Discord alliance membership changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    boundaries.alliance.findMany.mockResolvedValue([alliance]);
    boundaries.botUser.upsert.mockResolvedValue({ id: "bot-user", activeProfileId: "departing" });
  });

  it("releases defense slots through the actual Discord remove handler", async () => {
    const command = interaction();
    await handleAllianceManageRemove(command as unknown as ChatInputCommandInteraction);
    expect(db.read().members[1].allianceId).toBeNull();
    expect(db.read().placements.find((row) => row.id === "assigned")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(command.editReply).toHaveBeenCalledWith({ embeds: expect.any(Array) });
  });

  it.each(["lost-roles", "left-server"])("releases slots when role synchronization detects %s", async (reason) => {
    const result = await syncRolesForGuild(guildWithDepartingMember(reason === "lost-roles" ? [] : null));
    expect(result.removed).toBe(1);
    expect(db.read().members[1].allianceId).toBeNull();
    expect(db.read().placements.find((row) => row.id === "assigned")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
  });

  it("clears only the former alliance's slots on an explicit manual transfer", async () => {
    db.read().members[1].allianceId = "alliance-2";
    const result = await syncRolesForGuild(guildWithDepartingMember(["bg-role"]), "alliance-1", true);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(db.read().members[1]).toMatchObject({ allianceId: "alliance-1", battlegroup: 1, isOfficer: false, isPlanner: false });
    expect(db.read().placements.find((row) => row.id === "foreign")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(db.read().placements.find((row) => row.id === "assigned")?.defenderId).toBe(101);
  });

  it("keeps automatic role sync from transferring a player out of another alliance", async () => {
    db.read().members[1].allianceId = "alliance-2";
    const before = structuredClone(db.read());
    await syncRolesForGuild(guildWithDepartingMember(["bg-role"]), "alliance-1");
    expect(db.read()).toEqual(before);
  });

  it("rolls back a Discord removal if placement cleanup fails", async () => {
    const before = structuredClone(db.read());
    const command = interaction();
    db.prisma.warDefensePlacement.updateMany.mockRejectedValueOnce(new Error("cleanup unavailable"));
    await handleAllianceManageRemove(command as unknown as ChatInputCommandInteraction);
    expect(db.read()).toEqual(before);
    expect(command.editReply).toHaveBeenCalledWith("An error occurred while removing the player.");
  });

  it.each(["lost-roles", "left-server", "manual-transfer"])("rolls back failed %s cleanup during role sync", async (reason) => {
    if (reason === "manual-transfer") db.read().members[1].allianceId = "alliance-2";
    const before = structuredClone(db.read());
    db.prisma.warDefensePlacement.updateMany.mockRejectedValueOnce(new Error("cleanup unavailable"));
    const roles = reason === "lost-roles" ? [] : reason === "left-server" ? null : ["bg-role"];
    const result = await syncRolesForGuild(guildWithDepartingMember(roles), "alliance-1", reason === "manual-transfer");
    expect(result).toEqual({ updated: 0, created: 0, removed: 0 });
    expect(db.read()).toEqual(before);
  });
});
