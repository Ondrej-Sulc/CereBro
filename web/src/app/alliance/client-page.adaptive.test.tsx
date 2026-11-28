// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { updatePlayerRole } from "../actions/alliance";
import { AllianceManagementClient } from "./client-page";

vi.mock("../actions/alliance", () => ({ updatePlayerRole: vi.fn(async () => ({ success: true })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@cerebro/core/services/rosterScreenshotQuotaService", () => ({ ALLIANCE_UNLOCK_THRESHOLD_MINOR: 5000 }));

type Props = ComponentProps<typeof AllianceManagementClient>;

function fixture(groups: Array<number | null>, isOfficer = true) {
    return {
        currentUser: { id: "viewer", isOfficer, isBotAdmin: false },
        alliance: {
            id: "alliance",
            name: "Test alliance",
            playerColorPalette: "DEFAULT",
            membershipRequests: [],
        },
        members: groups.map((battlegroup, index) => ({
            id: "member-" + index,
            ingameName: ["Solomon", "Orion", "Nova", "Artemis"][index],
            battlegroup,
            championPrestige: 30000,
            rosterLastUpdatedAt: null,
            _count: { roster: 50 },
        })),
    } as unknown as Props;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

const results = () => host.querySelector("#alliance-battlegroup-results")!;
const cards = () => Array.from(results().querySelectorAll("section[id]"), section => section.id);
const emptyGroups = () => results().querySelector('[aria-labelledby="alliance-empty-battlegroups"]');

async function render(groups: Array<number | null>, isOfficer = true) {
    await act(async () => root.render(<AllianceManagementClient {...fixture(groups, isOfficer)} />));
}

async function click(selector: string, container: ParentNode = host) {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    await act(async () => button!.click());
}

const editGroups = '[aria-label="Edit battlegroups"]';
const solomonAssignment = '[role="combobox"][aria-label="Battlegroup for Solomon"]';
const solomonAvatarLink = 'a[aria-label="View profile for Solomon"]';
const memberMime = "application/x-cerebro-alliance-member";
const memberDragRow = (id: string) => host.querySelector(`a[href="/player/${id}"]`)?.closest('li[draggable="true"]') ?? null;

function dragData() {
    const data = new Map<string, string>();
    return {
        effectAllowed: "uninitialized",
        dropEffect: "none",
        get types() {
            return Array.from(data.keys());
        },
        getData: (type: string) => data.get(type) ?? "",
        setData: (type: string, value: string) => data.set(type, value),
        setDragImage: vi.fn<(image: Element, x: number, y: number) => void>(),
    };
}

async function dragEvent(type: string, target: Element, dataTransfer: ReturnType<typeof dragData>) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    await act(async () => target.dispatchEvent(event));
    return event;
}

async function startSolomonDrag() {
    const row = memberDragRow("member-0");
    expect(row).not.toBeNull();
    const data = dragData();
    await dragEvent("dragstart", row!, data);
    return data;
}

it("opens empty groups from the compact row and returns focus to the group filter", async () => {
    await render([2, null]);
    expect(cards()).toEqual(["battlegroup-2", "unassigned"]);
    expect(emptyGroups()?.querySelectorAll("button")).toHaveLength(2);

    await click('[aria-label="View Battlegroup 1, 0 members"]', emptyGroups()!);
    expect(cards()).toEqual(["battlegroup-1"]);
    expect(emptyGroups()).toBeNull();
    expect(results().textContent).toContain("No members assigned yet.");
    const groupFilter = host.querySelector('[data-battlegroup-filter="1"]');
    expect(groupFilter?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(groupFilter);

    await click('[data-battlegroup-filter="all"]');
    expect(cards()).toEqual(["battlegroup-2", "unassigned"]);
});

it("handles full, empty, and newly populated battlegroups", async () => {
    await render([1, 2, 3, null]);
    expect(cards()).toEqual(["battlegroup-1", "battlegroup-2", "battlegroup-3", "unassigned"]);
    expect(emptyGroups()).toBeNull();

    await render([]);
    expect(cards()).toEqual([]);
    expect(results().textContent).toContain("No alliance members yet.");
    expect(emptyGroups()?.querySelectorAll("button")).toHaveLength(3);

    await render([1]);
    expect(cards()).toEqual(["battlegroup-1"]);
    expect(emptyGroups()?.querySelectorAll("button")).toHaveLength(2);
    expect(host.querySelector('[data-battlegroup-filter="unassigned"]')).toBeNull();
});

it("links member avatars and names to the same profile in board and list views", async () => {
    await render([1, 2]);
    const expectProfileLinks = () => {
        const avatarLink = results().querySelector(solomonAvatarLink);
        expect(avatarLink?.textContent).toBe("SO");
        expect(avatarLink?.getAttribute("href")).toBe("/player/member-0");
        expect(results().querySelector('a[title="Solomon"]')?.getAttribute("href")).toBe("/player/member-0");
    };
    expectProfileLinks();

    const memberView = host.querySelector('[aria-label="Member view"]')!;
    const list = [...memberView.querySelectorAll("button")].find(button => button.textContent?.trim() === "List")!;
    await act(async () => list.click());
    expect(results().querySelector("table")).not.toBeNull();
    expectProfileLinks();
});

it("keeps assignment controls off until an officer enables battlegroup editing", async () => {
    await render([2, null]);
    const toggle = host.querySelector(editGroups);
    expect(toggle).not.toBeNull();
    expect(toggle!.textContent).toContain("Edit groups");
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector(solomonAssignment)).toBeNull();
    expect(memberDragRow("member-0")).toBeNull();

    await click(editGroups);
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector(solomonAssignment)).not.toBeNull();
    expect(memberDragRow("member-0")).not.toBeNull();

    await click(editGroups);
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector(solomonAssignment)).toBeNull();
    expect(memberDragRow("member-0")).toBeNull();

    await render([2, null], false);
    expect(host.querySelector(editGroups)).toBeNull();
    expect(host.querySelector(solomonAssignment)).toBeNull();
    expect(memberDragRow("member-0")).toBeNull();
});

it("provides a member preview and highlights destinations until the drag ends", async () => {
    await render([1, 2]);
    await click(editGroups);
    const row = memberDragRow("member-0")!;
    const destination = results().querySelector("#battlegroup-2")!;
    const avatarLink = row.querySelector(solomonAvatarLink)!;
    expect(avatarLink.getAttribute("draggable")).toBe("false");
    await act(async () => avatarLink.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const data = await startSolomonDrag();
    const preview = data.setDragImage.mock.calls[0]?.[0];

    expect(preview?.textContent).toContain("Solomon");
    expect(preview?.textContent).toContain("SO");
    expect(preview?.querySelector("a")).toBeNull();
    expect(preview?.isConnected).toBe(true);
    expect(row.getAttribute("data-drag-source")).toBe("true");
    expect(row.closest("section")?.hasAttribute("data-drop-state")).toBe(false);
    expect(destination.getAttribute("data-drop-state")).toBe("available");

    await dragEvent("dragover", destination, data);
    expect(destination.getAttribute("data-drop-state")).toBe("active");
    expect(destination.textContent).toContain("Drop here");

    await dragEvent("dragleave", destination, data);
    expect(destination.getAttribute("data-drop-state")).toBe("available");
    await dragEvent("dragend", row, data);
    expect(row.hasAttribute("data-drag-source")).toBe(false);
    expect(destination.hasAttribute("data-drop-state")).toBe(false);
    expect(preview?.isConnected).toBe(false);
    expect(updatePlayerRole).not.toHaveBeenCalled();
});

it("keeps an assignment control press from starting a row drag", async () => {
    await render([1, 2]);
    await click(editGroups);
    const row = memberDragRow("member-0")!;
    const assignment = row.querySelector(solomonAssignment)!;
    assignment.addEventListener("pointerdown", event => event.stopPropagation(), { once: true });
    await act(async () => assignment.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const data = dragData();
    expect((await dragEvent("dragstart", row, data)).defaultPrevented).toBe(true);
    expect(data.getData(memberMime)).toBe("");

    await act(async () => row.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect((await startSolomonDrag()).getData(memberMime)).toBe("member-0");
});

it("moves a member to a battlegroup in the compact empty row", async () => {
    await render([2, null]);
    await click(editGroups);
    const data = await startSolomonDrag();
    expect(data.getData(memberMime)).toBe("member-0");

    const target = emptyGroups()?.querySelector('[aria-label="View Battlegroup 1, 0 members"]');
    expect(target).not.toBeNull();
    expect((await dragEvent("dragover", target!, data)).defaultPrevented).toBe(true);
    await dragEvent("drop", target!, data);

    expect(updatePlayerRole).toHaveBeenCalledExactlyOnceWith("member-0", { battlegroup: 1 });
});

it("accepts a drop on a populated group and pauses assignment controls while saving", async () => {
    let finishMove: (() => void) | undefined;
    vi.mocked(updatePlayerRole).mockReturnValueOnce(new Promise(resolve => {
        finishMove = () => resolve({ success: true });
    }));
    await render([1, 2]);
    await click(editGroups);
    const target = results().querySelector("#battlegroup-2")!;
    const data = await startSolomonDrag();
    await dragEvent("drop", target, data);

    expect(updatePlayerRole).toHaveBeenCalledExactlyOnceWith("member-0", { battlegroup: 2 });
    expect(host.querySelector<HTMLButtonElement>(solomonAssignment)?.disabled).toBe(true);
    expect(memberDragRow("member-1")).toBeNull();

    await act(async () => finishMove?.());
    await render([2, 2]);
    expect(target.textContent).toContain("Solomon");
    expect(host.querySelector<HTMLButtonElement>(solomonAssignment)?.disabled).toBe(false);
});

it("ignores same-group and unrelated drops", async () => {
    await render([2, null]);
    await click(editGroups);
    const ownGroup = results().querySelector("#battlegroup-2");
    expect(ownGroup).not.toBeNull();
    await dragEvent("drop", ownGroup!, await startSolomonDrag());
    expect(updatePlayerRole).not.toHaveBeenCalled();

    const other = dragData();
    other.setData("text/plain", "member-0");
    const target = emptyGroups()?.querySelector('[aria-label="View Battlegroup 1, 0 members"]');
    expect(target).not.toBeNull();
    await dragEvent("drop", target!, other);
    expect(updatePlayerRole).not.toHaveBeenCalled();
});

it("reveals an Unassigned drop target during a drag when all members are assigned", async () => {
    await render([1, 2]);
    await click(editGroups);
    const unassignedDrop = '[data-battlegroup-drop="unassigned"]';
    expect(results().querySelector(unassignedDrop)).toBeNull();

    const data = await startSolomonDrag();
    const target = results().querySelector(unassignedDrop);
    expect(target).not.toBeNull();
    await dragEvent("drop", target!, data);
    expect(updatePlayerRole).toHaveBeenCalledExactlyOnceWith("member-0", { battlegroup: null });
});
