// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionMemoryProvider, CollectionScreen } from "@/components/collections/collection-navigation";
import { useAscensionEligibilityFilter } from "@/hooks/use-ascension-eligibility-filter";
import { useChampionScopeFilter } from "@/hooks/use-champion-scope-filter";
import { RosterFilters, type RosterFiltersProps } from "./roster-filters";
import { ClassChoices } from "./roster-filter-fields";

vi.mock("next/navigation", () => ({
  useRouter: () => navigationRouter,
  useSearchParams: () => navigationParams ?? new URLSearchParams(window.location.search),
}));

let root: Root;
const navigationRouter = { push: vi.fn(), replace: vi.fn((href: string) => window.history.replaceState(null, "", href)) };
let mobile = false;
let navigationParams: URLSearchParams | null = null;
const noop = () => {};
function Harness({ catalog = false, flat = false }: { catalog?: boolean; flat?: boolean }) {
  const [championScope, setChampionScope] = useChampionScopeFilter();
  const [eligible, setEligible] = useAscensionEligibilityFilter();
  const [stars, setStars] = useState<number[]>([]);
  const [classes, setClasses] = useState<RosterFiltersProps["filterClasses"]>([]);
  const [levels, setLevels] = useState<number[]>(catalog ? [] : [2]);
  const [showUnowned, setShowUnowned] = useState(true);
  const p: RosterFiltersProps = {
    flat,
    championScope, onChampionScopeChange: setChampionScope,
    search: "", onSearchChange: noop, viewMode: "view", onViewModeChange: noop,
    showUnowned, onShowUnownedChange: setShowUnowned, onAddClick: noop,
    sortBy: "NAME", onSortByChange: noop, sortDirection: "ASC", onSortDirectionChange: noop,
    canEdit: false, showOwnershipFilter: flat && !catalog, showRankFilter: !catalog, showAscensionFilter: !catalog,
    visibleChampionCount: 1, countLabel: "1 champion",
    filterStars: stars, onFilterStarsChange: setStars, filterClasses: classes, onFilterClassesChange: setClasses,
    filterRanks: [], onFilterRanksChange: noop, filterAscensionLevels: levels, onFilterAscensionLevelsChange: setLevels,
    ascensionEligible: eligible, onAscensionEligibleChange: setEligible,
    catalogEligibility: catalog,
    tagFilter: [], onTagFilterChange: noop, tagLogic: "AND", onTagLogicChange: noop,
    abilityCategoryFilter: [], onAbilityCategoryFilterChange: noop, abilityCategoryLogic: "OR", onAbilityCategoryLogicChange: noop,
    abilityFilter: [], onAbilityFilterChange: noop, abilityLogic: "AND", onAbilityLogicChange: noop,
    effectForms: [], onEffectFormsChange: noop, effectDirections: [], onEffectDirectionsChange: noop,
    immunityFilter: [], onImmunityFilterChange: noop, immunityLogic: "AND", onImmunityLogicChange: noop,
    includeResistances: true, onIncludeResistancesChange: noop, minResistancePotency: null, onMinResistancePotencyChange: noop,
    initialTags: [], initialAbilityCategories: [], initialAbilities: [], initialImmunities: [],
  };
  return <RosterFilters {...p} />;
}

beforeEach(() => {
  navigationRouter.replace.mockClear();
  mobile = false;
  navigationParams = null;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: noop, removeEventListener: noop }));
  HTMLElement.prototype.scrollIntoView = noop;
  window.history.replaceState(null, "", "/champions?view=catalog&insights=true#results");
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === text)!;

async function click(element: HTMLElement) { expect(element).toBeTruthy(); await act(async () => element.click()); }
const toggle = (scope: ParentNode = document) => scope.querySelector<HTMLButtonElement>('button[aria-label="7\u2605 Ascension"]')!;
const remove = () => document.querySelector<HTMLButtonElement>('button[aria-label="Remove 7\u2605 Ascension eligible filter"]')!;
async function render(catalog = true, flat = false) { await act(async () => root.render(<Harness catalog={catalog} flat={flat} />)); }

it("keeps the one-click ownership toggle in sync with the mobile filter sheet", async () => {
  mobile = true;
  await render(false, true);
  const toggles = (scope: ParentNode = document) => [...scope.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")]
    .filter(item => item.textContent?.trim() === "Owned only");
  const [desktop, mobileToggle] = toggles();
  expect(mobileToggle.getAttribute("aria-pressed")).toBe("false");
  await click(mobileToggle);
  expect(desktop.getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelector('[aria-label="Remove Owned only filter"]')).toBeTruthy();
  expect(window.location.search).not.toContain("championScope");

  await click(document.querySelector<HTMLButtonElement>('button[aria-controls$="-mobile"]')!);
  const sheet = document.querySelector('[role="dialog"]')!;
  const [sheetToggle] = toggles(sheet);
  expect(sheetToggle.getAttribute("aria-pressed")).toBe("true");
  await click(sheetToggle);
  expect(mobileToggle.getAttribute("aria-pressed")).toBe("false");
  expect(document.querySelector('[aria-label="Remove Owned only filter"]')).toBeNull();
});

it("keeps ownership out of the catalog and offers Any availability alongside Playable and NPC & legacy", async () => {
  await render(true, true);
  expect(document.body.textContent).not.toContain("Owned only");
  const trigger = document.querySelector<HTMLElement>('[aria-label="Champion availability"]')!;
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  expect(options.map(option => option.textContent)).toEqual(["Playable", "NPC & legacy", "Any availability"]);
  const any = options[2];
  await act(async () => { any.focus(); any.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  expect(window.location.search).toContain("championScope=all");
  expect(document.querySelector('[aria-label="Remove Any availability filter"]')).toBeTruthy();
});

it.each([false, true])("selects NPC availability and resets through the shared filter UI (mobile %s)", async useMobile => {
  mobile = useMobile; await render();
  let scopeRoot: ParentNode = document;
  if (useMobile) {
    await click(document.querySelector<HTMLButtonElement>('button[aria-controls$="-mobile"]')!);
    scopeRoot = document.querySelector('[role="dialog"]')!;
  }
  const triggers = [...scopeRoot.querySelectorAll<HTMLElement>('[aria-label="Champion availability"]')];
  const trigger = useMobile ? triggers[0] : triggers[triggers.length - 1];
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === "NPC & legacy")!;
  expect(option).toBeTruthy();
  await act(async () => { option.focus(); option.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  expect(window.location.search).toContain("championScope=nonPlayable");
  if (useMobile) await click([...scopeRoot.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Clear all")!);
  else await click(document.querySelector<HTMLButtonElement>('[aria-label="Remove NPC & legacy filter"]')!);
  expect(window.location.search).not.toContain("championScope");
  expect(window.location.search).toContain("insights=true"); expect(window.location.hash).toBe("#results");
});

it.each([true, false])("offers a focusable seven-star toggle without checkbox/help/scope picker (catalog %s)", async catalog => {
  await render(catalog);
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  expect(document.querySelector('input[type="checkbox"], [aria-label="Ascension eligibility"], [aria-label="Ascension eligibility scope"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Recorded path at matching stars");
  expect(document.body.textContent).not.toContain("Primordial Dust");
  toggle().focus();
  expect(document.activeElement).toBe(toggle());
  await click(toggle());
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelectorAll('button[aria-label="Remove 7\u2605 Ascension eligible filter"]')).toHaveLength(1);
  expect(window.location.search).toContain("ascensionEligible=true&ascensionScope=seven-star");
  if (!catalog) expect(document.querySelector('[aria-label="Ascension level: 2"]')).not.toBeNull();
  await click(remove());
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  if (!catalog) expect(document.querySelector('[aria-label="Remove Ascension 2 filter"]')).not.toBeNull();
});
it("preserves rarity/class on toggle/removal and resets criteria", async () => {
  await render();
  await click(button("6\u2605")); await click(button("Science")); await click(toggle()); await click(remove());
  expect(button("6\u2605").getAttribute("aria-pressed")).toBe("true");
  expect(button("Science").getAttribute("aria-pressed")).toBe("true");
  await click(toggle()); await click(button("Clear all"));
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  expect(document.querySelector('[aria-label="Active filters"]')).toBeNull();
  expect(window.location.search).toBe("?view=catalog&insights=true");
  expect(window.location.hash).toBe("#results");
});
it.each(["", "all", "primordial-dust", "seven-star", "invalid"])("migrates enabled legacy URL scope '%s' to seven stars", async scope => {
  window.history.replaceState(null, "", "/champions?view=catalog&ascensionEligible=true&ascensionScope=" + scope + "&other=kept#results");
  await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  expect(window.location.search).toContain("ascensionScope=seven-star");
  expect(window.location.search).toContain("other=kept"); expect(window.location.hash).toBe("#results");
  if (scope !== "seven-star") expect(navigationRouter.replace).toHaveBeenCalledWith(expect.stringContaining("ascensionScope=seven-star"), { scroll: false });
  else expect(navigationRouter.replace).not.toHaveBeenCalled();
});
it.each(["false", "invalid"])("keeps explicit %s off and drops stale scope", async value => {
  window.history.replaceState(null, "", "/champions?ascensionEligible=" + value + "&ascensionScope=primordial-dust");
  await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  expect(window.location.search).not.toContain("ascensionScope");
});
it("ignores an orphaned scope", async () => {
  window.history.replaceState(null, "", "/champions?ascensionScope=primordial-dust#results"); await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).toBe("");
});
it.each(["toggle", "active rule", "clear all"])("keeps removal via %s while the legacy Next snapshot lags", async source => {
  window.history.replaceState(null, "", "/champions?view=catalog&ascensionEligible=true&ascensionScope=primordial-dust#results");
  navigationParams = new URLSearchParams(window.location.search); await render();
  await click(source === "toggle" ? toggle() : source === "active rule" ? remove() : button("Clear all"));
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).toBe("?view=catalog");
  // The earlier streaming legacy normalization can finish after local removal.
  window.history.replaceState(null, "", "/champions?view=catalog&ascensionEligible=true&ascensionScope=seven-star#results");
  navigationParams = new URLSearchParams(window.location.search); await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).toBe("?view=catalog");
  navigationParams = new URLSearchParams(window.location.search); await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).toBe("?view=catalog"); expect(window.location.hash).toBe("#results");
});
it("restores migrated memory by view/profile and remembers removal", async () => {
  const show = async (view: "catalog" | "personal", profileId = "one", query = "") => {
    window.history.replaceState(null, "", "/champions?view=" + view + query);
    await act(async () => root.render(<CollectionMemoryProvider>
      <CollectionScreen key={profileId + ":" + view} section="champions" view={view} profileId={profileId} signedIn canUsePersonal><Harness catalog /></CollectionScreen>
    </CollectionMemoryProvider>));
  };
  await show("catalog", "one", "&ascensionEligible=true&ascensionScope=all"); await show("personal");
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); await show("catalog", "two");
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); await show("catalog");
  expect(toggle().getAttribute("aria-pressed")).toBe("true"); expect(window.location.search).toContain("ascensionScope=seven-star");
  await click(remove()); await show("personal"); await show("catalog");
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
});
it.each(["all", "seven-star", "invalid"])("clears orphan scope %s even when enabled eligibility was remembered", async scope => {
  const show = async (view: "catalog" | "personal", query = "") => {
    window.history.replaceState(null, "", `/champions?view=${view}${query}#results`);
    await act(async () => root.render(<CollectionMemoryProvider>
      <CollectionScreen key={view} section="champions" view={view} profileId="one" signedIn canUsePersonal><Harness catalog /></CollectionScreen>
    </CollectionMemoryProvider>));
  };
  await show("catalog", "&ascensionEligible=true&ascensionScope=seven-star");
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  await show("personal");
  await show("catalog", `&ascensionScope=${scope}&other=kept`);
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  expect(window.location.search).toBe("?view=catalog&other=kept");
  expect(window.location.hash).toBe("#results");
  await show("personal"); await show("catalog");
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
});
it.each([true, false])("places mobile eligibility correctly and resets from sheet (catalog %s)", async catalog => {
  mobile = true; await render(catalog);
  await click(document.querySelector<HTMLButtonElement>('button[aria-controls$="-mobile"]')!);
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  if (catalog) expect(toggle(dialog)).toBeNull();
  else { await click(toggle(dialog)); expect(toggle(dialog).getAttribute("aria-pressed")).toBe("true"); expect(dialog.querySelector('[aria-label="Ascension"]')).not.toBeNull(); }
  await click([...dialog.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Clear all")!);
  await click([...dialog.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Show 1 champions")!);
  expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).not.toContain("ascension");
});
it("follows back/forward without reviving absent eligibility", async () => {
  window.history.replaceState(null, "", "/champions?view=catalog"); await render();
  window.history.pushState(null, "", "/champions?view=catalog&ascensionEligible=true&ascensionScope=all"); await render();
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  window.history.pushState(null, "", "/champions?view=catalog&ascensionEligible=false"); await render();
  const travel = async (direction: "back" | "forward") => {
    await new Promise<void>(resolve => { window.addEventListener("popstate", () => resolve(), { once: true }); window.history[direction](); }); await render();
  };
  await travel("back"); expect(toggle().getAttribute("aria-pressed")).toBe("true");
  await travel("back"); expect(toggle().getAttribute("aria-pressed")).toBe("false"); expect(window.location.search).toBe("?view=catalog");
  await travel("forward"); expect(toggle().getAttribute("aria-pressed")).toBe("true");
});

it("exposes Superior when the active catalog contains bosses and keeps selected classes clearable", async () => {
  const onChange = vi.fn();
  await act(async () => root.render(<ClassChoices values={[]} onChange={onChange} counts={{ SCIENCE: 2 }} />));
  expect(document.body.textContent).not.toContain("Superior");
  await act(async () => root.render(<ClassChoices values={[]} onChange={onChange} counts={{ SUPERIOR: 4 }} />));
  await click(button("Superior"));
  expect(onChange).toHaveBeenCalledWith(["SUPERIOR"]);
  await act(async () => root.render(<ClassChoices values={["SUPERIOR"]} onChange={onChange} counts={{ SUPERIOR: 0 }} />));
  expect(button("Superior").disabled).toBe(false);
  await click(button("Superior"));
  expect(onChange).toHaveBeenLastCalledWith([]);
});
