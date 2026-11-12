import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ isUserBotAdmin: mocks.admin }));
vi.mock("@/lib/expanded-node-modifiers", () => ({ getExpandedNodeModifier: mocks.load, expandedNodeIndex: { profile: { bcgSha256: "internal-proof" } } }));
import { GET } from "./route";
const request = () => GET(new Request("https://example.test/nodes/native/source"), { params: Promise.resolve({ id: "native" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue(false); mocks.load.mockResolvedValue({ definition: { id: "native" } }); });
it("does not return internal definitions or read source storage for a non-admin", async () => {
  const response = await request();
  expect(response.status).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("internal-proof");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("preserves the complete export for an administrator with private caching", async () => {
  mocks.admin.mockResolvedValue(true);
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ definition: { id: "native" }, provenance: { bcgSha256: "internal-proof" } });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toContain("Cookie");
});
it("retains a no-store not-found response for missing admin exports", async () => {
  mocks.admin.mockResolvedValue(true); mocks.load.mockResolvedValue(undefined);
  const response = await request();
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
