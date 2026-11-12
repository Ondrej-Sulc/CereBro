import { describe, expect, it } from "vitest";
import { gameIconMaskUrl, gameIconSourceUrl } from "./game-icon-url";

describe("same-origin native icon URLs", () => {
  it.each([
    ["glossary-icons", "bulwark.svg"],
    ["game-effect-icons", "auto_block-b0cb207cee27aa80.svg"],
  ])("retains the exact bound %s filename", (family, file) => {
    const source = "https://storage.googleapis.com/champion-images/mcoc/" + family + "/" + file;
    expect(gameIconMaskUrl(source)).toBe("/api/game-icons/" + family + "/" + file);
    expect(gameIconSourceUrl(family, file)).toBe(source);
  });
  it.each([
    "/icons/stats/health.svg", "/game-node-icons/native.svg",
    "https://example.com/icon.svg",
    "https://storage.googleapis.com.attacker.invalid/champion-images/mcoc/glossary-icons/fury.svg",
    "https://user@storage.googleapis.com/champion-images/mcoc/glossary-icons/fury.svg",
    "https://storage.googleapis.com/other-bucket/fury.svg",
    "https://storage.googleapis.com/champion-images/mcoc/glossary-icons/fury.svg?token=private",
  ])("does not rewrite local or unapproved sources: %s", source => {
    expect(gameIconMaskUrl(source)).toBe(source);
  });
  it.each([
    ["other", "fury.svg"], ["glossary-icons", "../secret.svg"],
    ["glossary-icons", "%2fsecret.svg"], ["glossary-icons", "fury.svg?url=other"],
    ["glossary-icons", "fury.png"],
  ])("rejects an unsupported upstream path: %s/%s", (family, file) => {
    expect(gameIconSourceUrl(family, file)).toBeNull();
  });
});
