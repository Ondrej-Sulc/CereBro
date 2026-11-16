// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement, type AnchorHTMLAttributes, type ComponentProps, type ImgHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import RewardSourcesPage from "@/app/rewards/page";
import { getRewardDiscovery, listDiscoverableRewards } from "@cerebro/core/data/game-discovery";
import { rewardIdentity, rewardSourcesHref } from "@cerebro/core/domain/game-discovery";
import { projectRewardRow } from "@/lib/game-quests/presentation";
import { RewardSearch } from "./reward-search";

vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
  void prefetch;
  return <a {...props} />;
} }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
  // eslint-disable-next-line @next/next/no-img-element -- The framework image boundary is irrelevant to public finder semantics.
  <img alt="" {...props} />
) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ push: vi.fn() }) }));

async function render(params: Record<string, string> = {}) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(await RewardSourcesPage({ searchParams: Promise.resolve(params) }));
  return host;
}

it("offers useful starting searches and a clearly labelled reward catalog", async () => {
  const host = await render();
  expect(host.querySelector("h1")?.textContent).toBe("Find a reward");
  const shortcuts = host.querySelector('nav[aria-label="Quick reward searches"]');
  expect(shortcuts).not.toBeNull();
  expect([...shortcuts!.querySelectorAll("a")].map(link => link.textContent)).toEqual(["Catalysts", "Crystals", "Rank-up gems", "ISO-8"]);
  expect(host.querySelector('ul[aria-label="Rewards"] > li')).not.toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain(`${listDiscoverableRewards().length} rewards`);
});

it("keeps exact reward identities while using readable names and singular source copy", async () => {
  const reward = listDiscoverableRewards().find(row => row.locations === 1 && /[A-Z]{4}/.test(projectRewardRow(row.sample, "", "test").name))!;
  const view = projectRewardRow(reward.sample, "", "test");
  const host = await render({ q: view.name });
  const link = [...host.querySelectorAll('ul[aria-label="Rewards"] a')].find(row => row.getAttribute("href") === rewardSourcesHref(reward.type, reward.token))!;
  expect(link).toBeDefined();
  expect(link.textContent).toContain("1 source");
  expect(link.textContent).not.toContain("1 sources");
  expect(link.querySelector("h3")?.textContent).not.toBe(view.name);
  expect(link.querySelector("img,svg")).not.toBeNull();
});

it("finds seven-star crystals through the same shorthand used by autocomplete", async () => {
  const host = await render({ q: "7* crystal" });
  const cards = [...host.querySelectorAll('ul[aria-label="Rewards"] > li')];
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.every(card => /7(?:-|\s)?star|7★/i.test(card.textContent ?? "") && /crystal/i.test(card.textContent ?? ""))).toBe(true);
  expect(host.querySelector<HTMLInputElement>('[name="q"]')?.value).toBe("7* crystal");
  expect(host.querySelector('a[href="/rewards"]')?.textContent).toBe("Clear search");
});

it("explains an empty search and provides a way back to all rewards", async () => {
  const host = await render({ q: "zzzz-no-such-reward-zzzz" });
  expect(host.querySelector('ul[aria-label="Rewards"]')).toBeNull();
  expect(host.textContent).toContain("No rewards found");
  expect(host.textContent).toContain("zzzz-no-such-reward-zzzz");
  expect([...host.querySelectorAll('a[href="/rewards"]')].some(link => link.textContent?.trim() === "Browse all rewards")).toBe(true);
});

it("keeps the search query when browsing result pages", async () => {
  const host = await render({ q: "crystal" });
  const next = [...host.querySelectorAll('nav[aria-label="Reward pages"] a')].find(link => link.textContent?.includes("Next"))!;
  expect(next).toBeDefined();
  const destination = new URL(next.getAttribute("href")!, "https://example.test");
  expect(destination.searchParams.get("q")).toBe("crystal");
  expect(destination.searchParams.get("page")).toBe("2");
});

it("keeps unknown reward identities out of the source-detail view", async () => {
  await expect(RewardSourcesPage({ searchParams: Promise.resolve({ type: "inv", item: "not-a-public-item" }) })).rejects.toThrow("NOT_FOUND");
});

it("passes only the complete minimal public reward projection to autocomplete", async () => {
  function findSearch(node: ReactNode): ReactElement<ComponentProps<typeof RewardSearch>> | undefined {
    if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
    if (node.type === RewardSearch) return node as ReactElement<ComponentProps<typeof RewardSearch>>;
    return Children.toArray(node.props.children).map(findSearch).find(Boolean);
  }
  const page = await RewardSourcesPage({ searchParams: Promise.resolve({ q: "crystal" }) });
  const search = findSearch(page)!;
  expect(search).toBeDefined();
  expect(search.props.initialQuery).toBe("crystal");
  const originals = listDiscoverableRewards();
  expect(search.props.options).toHaveLength(originals.length);
  expect(new Set(search.props.options.map(option => option.key))).toEqual(new Set(originals.map(row => rewardIdentity(row.type, row.token))));
  for (const option of search.props.options) {
    expect(Object.keys(option).sort()).toEqual(["href", "imageUrl", "key", "name", "rarity", "sources"]);
    expect(option.href).toMatch(/^\/rewards\?type=/);
    expect(option.name).not.toBe("");
  }
});

it("retains rank and rarity overlays on the exact item card", async () => {
  const reward = listDiscoverableRewards().find(row => projectRewardRow(row.sample, "", "test").rankChange)!;
  const view = projectRewardRow(reward.sample, "", "test");
  const host = await render({ q: view.name });
  const link = [...host.querySelectorAll('ul[aria-label="Rewards"] a')].find(row => row.getAttribute("href") === rewardSourcesHref(reward.type, reward.token))!;
  expect(link).toBeDefined();
  expect(link.querySelector('[data-reward-rank]')?.getAttribute("data-reward-rank")).toBe(`${view.rankChange!.from}-${view.rankChange!.to}`);
  if (view.itemRarity) expect(link.querySelector('[data-reward-stars]')?.getAttribute("data-reward-stars")).toBe(String(view.itemRarity));
});

it("preserves the source-detail view and its exact location links", async () => {
  const item = listDiscoverableRewards().find(row => row.type === "res" && row.token === "sc")!;
  const reward = getRewardDiscovery(item.type, item.token)!;
  const host = await render({ type: item.type, item: item.token });
  expect(host.querySelector("h1")?.textContent).toBe("Gold");
  expect(host.querySelector("#locations-heading")?.textContent).toBe("Where to earn it");
  expect(host.querySelector('[data-discovery-location]')?.getAttribute("href")).toBe(reward.sources[0].href);
  expect(host.querySelector('nav[aria-label="Quick reward searches"]')).toBeNull();
  expect(host.querySelector('[name="type"]')?.getAttribute("value")).toBe(item.type);
  expect(host.querySelector('[name="item"]')?.getAttribute("value")).toBe(item.token);
});
