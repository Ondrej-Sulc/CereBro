import { beforeEach, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { gameRelic: { findMany } } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { getHomeFeaturedRelics } from "./home-featured-relics";

const battlecast = { id: "relic_gambit_offense", name: "Gambit Battlecast", slug: "gambit-offense", type: "battlecast", portraitPath: "https://example.com/gambit.png" };
const statcast = { id: "relic_statcast_hulkling_bprf", name: "Hulkling Statcast", slug: "statcast-hulkling-bprf", type: "statcast", portraitPath: "https://example.com/hulkling.png" };

beforeEach(() => { findMany.mockReset(); });

it("returns the two distinct relic types with deployed names, routes and artwork", async () => {
  findMany.mockResolvedValue([statcast, battlecast]);
  expect(await getHomeFeaturedRelics()).toEqual([
    { name: battlecast.name, href: "/relics/gambit-offense", type: "battlecast", artworkUrl: battlecast.portraitPath },
    { name: statcast.name, href: "/relics/statcast-hulkling-bprf", type: "statcast", artworkUrl: statcast.portraitPath },
  ]);
});

it("does not advertise missing routes, placeholder artwork or a mismatched relic type", async () => {
  findMany.mockResolvedValue([{ ...battlecast, portraitPath: "data:image/gif;base64,placeholder" }, { ...statcast, slug: null }]);
  expect(await getHomeFeaturedRelics()).toEqual([]);
  findMany.mockResolvedValue([{ ...battlecast, type: "statcast" }]);
  expect(await getHomeFeaturedRelics()).toEqual([]);
});

it("keeps a partial deployed selection without fabricating its missing counterpart", async () => {
  findMany.mockResolvedValue([statcast]);
  expect(await getHomeFeaturedRelics()).toEqual([
    { name: statcast.name, href: "/relics/statcast-hulkling-bprf", type: "statcast", artworkUrl: statcast.portraitPath },
  ]);
  findMany.mockResolvedValue([]);
  expect(await getHomeFeaturedRelics()).toEqual([]);
});
