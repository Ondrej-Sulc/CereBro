// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { getNodeLocations, getRewardDiscovery } from "@cerebro/core/data/game-discovery";
import { rewardSourcesHref, matchesDiscoveryQuery } from "@cerebro/core/domain/game-discovery";
import { DiscoveryLocations } from "./discovery-locations";
import { RewardSourceLink } from "./reward-source-link";

vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}/> }));
const render = (element: React.ReactNode) => { const host = document.createElement("div"); host.innerHTML = renderToStaticMarkup(element); return host; };

it("shows current native node uses with direct quest and Tower destinations", () => {
  const rows = getNodeLocations("avx_hp_pct800");
  const host = render(<DiscoveryLocations rows={rows} base="/nodes/avx_hp_pct800" filters={{ section: "Class Tower" }}/>);
  const links = [...host.querySelectorAll<HTMLAnchorElement>("[data-discovery-location]")];
  expect(links.length).toBeGreaterThan(0);
  expect(links.every(a => a.href.includes("/quests/towers/") && a.href.includes("modifier=avx_hp_pct800"))).toBe(true);
  expect(host.textContent).not.toMatch(/sourceHash|versionHash|raw data/i);
});

it("preserves exact reward identity and scope through search and pagination", () => {
  const reward = getRewardDiscovery("res", "sc")!;
  const host = render(<DiscoveryLocations rows={reward.sources} base="/rewards" fixed={{ type: "res", item: "sc" }} filters={{ section: "Class Tower", scope: "Floor rewards" }} rewards/>);
  expect(host.querySelector<HTMLInputElement>('[name="item"]')?.value).toBe("sc");
  expect(host.querySelector<HTMLSelectElement>('[name="scope"]')?.value).toBe("Floor rewards");
  const links = [...host.querySelectorAll<HTMLAnchorElement>("[data-discovery-location]")];
  expect(links).toHaveLength(20);
  expect(links.every(a => new URL(a.href).searchParams.has("rewardFloor"))).toBe(true);
  const next = [...host.querySelectorAll<HTMLAnchorElement>('nav a')].find(a => a.textContent?.includes("Next"))!;
  expect(new URL(next.href).searchParams.get("item")).toBe("sc");
  expect(new URL(next.href).searchParams.get("scope")).toBe("Floor rewards");
});

it("keeps potential outcomes explicit and shows quantity ranges without adding grants together", () => {
  const host = render(<DiscoveryLocations base="/rewards" filters={{}} rewards rows={[
    { key: "a", title: "Test quest", context: "", section: "Story", href: "/quests/test#quest-rewards", scope: "potentialCompletionRewards", quantity: 2, minQuantity: 1, maxQuantity: 5 },
    { key: "b", title: "Test quest", context: "", section: "Story", href: "/quests/test#quest-rewards", scope: "firstCompletionRewards", quantity: 2 },
  ]}/>);
  expect(host.textContent).toContain("Possible outcome");
  expect(host.textContent).toContain("1–5");
  expect(host.querySelectorAll("[data-discovery-location]")).toHaveLength(2);
});

it("links each native reward variant independently and omits unknown placeholders", () => {
  const host = render(<><RewardSourceLink type="inv" token="rankup_3_4"/><RewardSourceLink type="inv" token="rankup_2_3"/><RewardSourceLink type="inv" token="unknown_rewards"/></>);
  const links = [...host.querySelectorAll('a')];
  expect(links.map(a => a.getAttribute("href"))).toEqual([rewardSourcesHref("inv", "rankup_3_4"), rewardSourcesHref("inv", "rankup_2_3")]);
});

it("accepts familiar punctuation-free item and block searches and rejects unknown node identities", () => {
  expect(matchesDiscoveryQuery("Tier 6 Basic ISO-8", "iso8")).toBe(true);
  expect(matchesDiscoveryQuery("Skill Tower · Block 100", "skill block100")).toBe(true);
  expect(matchesDiscoveryQuery("Skill Tower · Block 100", "mystic")).toBe(false);
  expect(getNodeLocations("__proto__")).toEqual([]);
});
