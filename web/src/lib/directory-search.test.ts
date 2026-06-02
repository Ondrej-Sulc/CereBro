import { describe, expect, it } from "vitest";
import {
  allianceMemberFilterMatches,
  buildAllianceSearchBaseWhere,
  buildPlayerSearchOrderBy,
  buildPlayerSearchWhere,
  normalizeAllianceSearch,
  normalizeDirectoryTab,
  normalizePlayerSearch,
  paginate,
  rankAllianceDirectoryMatch,
  rankPlayerDirectoryMatch,
} from "./directory-search";

describe("directory search", () => {
  it("normalizes invalid params to defaults", () => {
    expect(normalizeDirectoryTab({ tab: "bad" })).toBe("players");

    expect(normalizePlayerSearch({
      playerRoster: "bad",
      playerBattlegroup: "9",
      playerSort: "bad",
      playerOrder: "sideways",
      playerPage: "-5",
    })).toMatchObject({
      roster: "all",
      battlegroup: "all",
      sort: "name",
      order: "asc",
      page: 1,
    });

    expect(normalizeAllianceSearch({
      allianceMembers: "bad",
      allianceAccess: "bad",
      allianceSort: "bad",
      allianceOrder: "sideways",
      alliancePage: "nope",
    })).toMatchObject({
      members: "all",
      access: "all",
      sort: "name",
      order: "asc",
      page: 1,
    });
  });

  it("builds player name, alliance, roster, and battlegroup filters", () => {
    const where = buildPlayerSearchWhere(normalizePlayerSearch({
      playerQuery: "doom",
      playerAllianceQuery: "xmn",
      playerRoster: "with",
      playerBattlegroup: "2",
    }));

    expect(where).toEqual({
      AND: [
        { ingameName: { contains: "doom", mode: "insensitive" } },
        {
          alliance: {
            is: {
              OR: [
                { name: { contains: "xmn", mode: "insensitive" } },
                { tag: { contains: "xmn", mode: "insensitive" } },
              ],
            },
          },
        },
        { roster: { some: {} } },
        { battlegroup: 2 },
      ],
    });
  });

  it("supports players without roster and unassigned battlegroup", () => {
    expect(buildPlayerSearchWhere(normalizePlayerSearch({
      playerRoster: "without",
      playerBattlegroup: "none",
    }))).toEqual({
      AND: [
        { roster: { none: {} } },
        { battlegroup: null },
      ],
    });
  });

  it("builds player sort order", () => {
    expect(buildPlayerSearchOrderBy(normalizePlayerSearch({
      playerSort: "prestige",
      playerOrder: "desc",
    }))).toEqual({ championPrestige: { sort: "desc", nulls: "last" } });

    expect(buildPlayerSearchOrderBy(normalizePlayerSearch({
      playerSort: "roster",
      playerOrder: "desc",
    }))).toEqual({ roster: { _count: "desc" } });
  });

  it("builds alliance visibility, query, and invite-only filters", () => {
    expect(buildAllianceSearchBaseWhere(normalizeAllianceSearch({
      allianceQuery: "xmn",
      allianceAccess: "invite-only",
    }))).toEqual({
      AND: [
        { members: { some: {} } },
        {
          NOT: [
            { name: { equals: "GLOBAL", mode: "insensitive" } },
            { tag: { equals: "GLOBAL", mode: "insensitive" } },
          ],
        },
        {
          OR: [
            { name: { contains: "xmn", mode: "insensitive" } },
            { tag: { contains: "xmn", mode: "insensitive" } },
          ],
        },
        { inviteOnly: true },
      ],
    });
  });

  it("matches alliance member buckets", () => {
    expect(allianceMemberFilterMatches(10, "1-10")).toBe(true);
    expect(allianceMemberFilterMatches(11, "1-10")).toBe(false);
    expect(allianceMemberFilterMatches(11, "11-30")).toBe(true);
    expect(allianceMemberFilterMatches(31, "31-plus")).toBe(true);
  });

  it("paginates arrays with one-indexed pages", () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it("ranks player name matches by exactness before profile strength", () => {
    const exactMatch = rankPlayerDirectoryMatch({
      query: "doom",
      ingameName: "Doom",
      rosterCount: 1,
      championPrestige: 100,
    });
    const containsMatch = rankPlayerDirectoryMatch({
      query: "doom",
      ingameName: "The Doom Lord",
      rosterCount: 300,
      championPrestige: 100_000,
    });

    expect(exactMatch).toBeLessThan(containsMatch);
  });

  it("uses roster and prestige as player tie-breakers", () => {
    const strongProfile = rankPlayerDirectoryMatch({
      query: "doom",
      ingameName: "Doom Jr",
      allianceName: "Battle Realm",
      rosterCount: 150,
      championPrestige: 25_000,
    });
    const thinProfile = rankPlayerDirectoryMatch({
      query: "doom",
      ingameName: "Doom Sr",
      rosterCount: 0,
      championPrestige: null,
    });

    expect(strongProfile).toBeLessThan(thinProfile);
  });

  it("ranks alliance tag matches and open populated alliances higher", () => {
    const tagMatch = rankAllianceDirectoryMatch({
      query: "xmn",
      name: "X-Men",
      tag: "XMN",
      memberCount: 30,
      inviteOnly: false,
    });
    const nameContainsMatch = rankAllianceDirectoryMatch({
      query: "xmn",
      name: "Team XMN",
      tag: null,
      memberCount: 30,
      inviteOnly: false,
    });
    const inviteOnlyMatch = rankAllianceDirectoryMatch({
      query: "xmn",
      name: "X-Men",
      tag: "XMN",
      memberCount: 1,
      inviteOnly: true,
    });

    expect(tagMatch).toBeLessThan(nameContainsMatch);
    expect(tagMatch).toBeLessThan(inviteOnlyMatch);
  });
});
