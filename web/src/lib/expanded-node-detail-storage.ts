import "server-only"
import { createHash } from "node:crypto"
import { readFile, realpath, stat } from "node:fs/promises"
import { join, resolve, sep } from "node:path"
import snapshot from "@cerebro/core/data/game-node-modifiers/v2/index.json"
import { verifiedExpandedDetail, type ExpandedModifierDetail, type ExpandedModifierIndex } from "@cerebro/core/domain/node-modifiers/expansion"
import type { GameModifierRecord } from "@cerebro/core/domain/node-modifiers/public-catalog"

interface StoredModifierIndex extends ExpandedModifierIndex {
  records: (GameModifierRecord & { detailSha256: string })[]
}
const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex")
const isMissing = (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT"

/** Only the index supplies IDs/hashes; request values never become filesystem paths. */
export function createExpandedDetailReader(index: StoredModifierIndex, directories: readonly string[]) {
  const records = new Map(index.records.map(record => [record.id, record]))
  return async (id: string): Promise<ExpandedModifierDetail | undefined> => {
    const record = records.get(id)
    if (!record || !/^[a-f0-9]{64}$/.test(record.detailSha256)) return undefined
    const filename = `${sha256(record.id)}.json`
    for (const directory of directories) {
      try {
        const root = await realpath(directory)
        const file = await realpath(join(root, filename))
        if (!file.startsWith(`${root}${sep}`)) return undefined
        const info = await stat(file)
        if (!info.isFile() || info.size > 32 * 1024 * 1024) return undefined
        const bytes = await readFile(file)
        if (sha256(bytes) !== record.detailSha256) return undefined
        const detail: unknown = JSON.parse(bytes.toString("utf8"))
        // The byte pin binds the reviewed structure. Existing catalog/id/version
        // validation remains the final gate; malformed pinned fixtures fail closed.
        return verifiedExpandedDetail(index, id, detail as ExpandedModifierDetail)
      } catch (error: unknown) {
        if (isMissing(error)) continue
        return undefined
      }
    }
    return undefined
  }
}

// Docker starts in web/; CLI tests start at repository root. Both locations are
// fixed deployment roots, never selected from a request or a directory scan.
export const loadStoredExpandedModifier = createExpandedDetailReader(snapshot, [
  resolve(process.cwd(), "src/data/game-node-modifiers/v2/details"),
  resolve(process.cwd(), "../src/data/game-node-modifiers/v2/details"),
])
