import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("../../web/src", import.meta.url)),
    "@cerebro/core": fileURLToPath(new URL("../../src", import.meta.url)),
  } },
  esbuild: { jsx: "automatic" },
  test: { include: ["src/tests/game-quests/*.test.ts", "web/src/components/game-quests/*.test.tsx"], maxWorkers: 1, testTimeout: 30000 },
});
