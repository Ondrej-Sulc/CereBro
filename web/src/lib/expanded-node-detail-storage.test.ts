import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import snapshot from "@cerebro/core/data/game-node-modifiers/v2/index.json"
import { createExpandedDetailReader, loadStoredExpandedModifier } from "./expanded-node-detail-storage"

vi.mock("server-only", () => ({}))
const io = vi.hoisted(() => ({ reads: vi.fn() }))
vi.mock("node:fs/promises", async original => {
  const actual = await original<typeof import("node:fs/promises")>()
  return { ...actual, readFile: (...args: Parameters<typeof actual.readFile>) => { io.reads(); return actual.readFile(...args) } }
})

const roots: string[] = []
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const first = snapshot.records[0]
const fileName = `${hash(first.id)}.json`
const original = readFileSync(resolve("src/data/game-node-modifiers/v2/details", fileName))
function fixture(bytes: Buffer = original, expectedHash = hash(bytes)) {
  const root = mkdtempSync(join(tmpdir(), "node-detail-storage-")); roots.push(root)
  const details = join(root, "details"); mkdirSync(details)
  writeFileSync(join(details, fileName), bytes)
  const index = { ...snapshot, records: [{ ...first, detailSha256: expectedHash }] }
  return { root, details, index, read: createExpandedDetailReader(index, [join(root, "absent"), details]) }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); io.reads.mockClear() })

describe("source-bound node detail storage", () => {
  it("loads one exact validated detail without traversing other frozen shards", async () => {
    const { read } = fixture()
    const detail = await read(first.id)
    expect(detail?.definition.id).toBe(first.id)
    expect(detail?.catalogHash).toBe(snapshot.catalogHash)
    expect(io.reads).toHaveBeenCalledTimes(1)
  })
  it("rejects unlisted and traversal IDs before reading any file", async () => {
    const { read } = fixture()
    for (const id of ["../index", "__proto__", `${first.id}/..`, "unknown"]) expect(await read(id)).toBeUndefined()
    expect(io.reads).not.toHaveBeenCalled()
  })
  it("rejects changed bytes even when the definition remains structurally valid", async () => {
    const { read } = fixture(Buffer.concat([original, Buffer.from("\n")]), first.detailSha256)
    expect(await read(first.id)).toBeUndefined()
  })
  it("rejects malformed or mismatched source versions after the byte check", async () => {
    for (const value of [{}, { ...(JSON.parse(original.toString()) as Record<string, unknown>), catalogHash: "wrong" }]) {
      const { read } = fixture(Buffer.from(JSON.stringify(value)))
      expect(await read(first.id)).toBeUndefined()
    }
  })
  it("fails closed when the recorded file is missing", async () => {
    const { read, details } = fixture()
    rmSync(join(details, fileName))
    expect(await read(first.id)).toBeUndefined()
  })
  it("preserves every frozen loader filename and content binding", async () => {
    const loader = readFileSync(resolve("src/data/game-node-modifiers/v2/detail-loaders.js"), "utf8")
    const matches = [...loader.matchAll(/"([^"]+)": \(\) => import\("\.\/details\/([a-f0-9]{64})\.json"\)/g)]
    expect(matches).toHaveLength(snapshot.records.length)
    const records = new Map(snapshot.records.map(record => [record.id, record]))
    for (const [, id, file] of matches) {
      expect(file).toBe(hash(id))
      expect(hash(readFileSync(resolve("src/data/game-node-modifiers/v2/details", `${file}.json`)))).toBe(records.get(id)?.detailSha256)
    }
    expect((await loadStoredExpandedModifier(first.id))?.definition.id).toBe(first.id)
  }, 30_000) // Full frozen corpus integrity audit, not a request-path latency test.
})
