import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../", import.meta.url)), "@cerebro/core": fileURLToPath(new URL("../../../../src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["src/tests/game-quests/discovery.test.ts", "web/src/components/discovery/*.test.tsx", "web/src/components/game-quests/quest-opponent-results.test.tsx", "web/src/components/game-quests/quest-map-explorer.test.tsx", "web/src/components/game-quests/quest-reward-presentation.test.tsx", "web/src/app/crystals/crystal-pages.test.tsx", "web/src/app/crystals/crystal-opening-pages.test.tsx", "web/src/app/crystals/crystal-reward-cards.test.tsx"], maxWorkers: 1, testTimeout: 60000 },
});
