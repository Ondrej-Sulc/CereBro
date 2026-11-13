import { describe, expect, it } from "vitest";
import { DuelSource, DuelStatus, type Duel } from "@prisma/client";
import { getDuelContent } from "./duel";

function target(source: DuelSource): Duel {
  return { id: 1, championId: 1, playerName: "Target", rank: "7* R4", source,
    status: DuelStatus.ACTIVE, submittedByDiscordId: null, createdAt: new Date(), updatedAt: new Date() };
}

describe("duel source attribution", () => {
  it("labels verified CereBro additions without the user-submission marker", () => {
    const content = getDuelContent([target(DuelSource.CEREBRO)], text => text);
    expect(content).toContain("CereBro");
    expect(content).not.toContain("👤");
  });

  it("retains genuine user and community source attribution", () => {
    expect(getDuelContent([target(DuelSource.USER_SUGGESTION)], text => text)).toContain("👤");
    expect(getDuelContent([target(DuelSource.MCOCHUB)], text => text)).toContain("<:MCOCHUB:0>");
  });
});
