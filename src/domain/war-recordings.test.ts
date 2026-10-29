import { describe, expect, it } from "vitest";
import { getFightRecordings, fightHasRecording, getVideoFights, canViewFightRecording } from "./war-recordings";

const video = (id: string) => ({ id, url: `https://youtu.be/${id}`, status: "PUBLISHED", visibility: "public" });

describe("fight recordings", () => {
  it('keeps visibility and moderation separate for every recording', () => {
    const viewer = { id: 'viewer', allianceId: 'alliance' };
    expect(canViewFightRecording({ status: 'PUBLISHED', visibility: 'public' }, 'other', null)).toBe(true);
    expect(canViewFightRecording({ status: 'PUBLISHED', visibility: 'alliance' }, 'other', viewer)).toBe(false);
    expect(canViewFightRecording({ status: 'PUBLISHED', visibility: 'alliance' }, 'alliance', viewer)).toBe(true);
    expect(canViewFightRecording({ status: 'UPLOADED', visibility: 'public' }, 'alliance', viewer)).toBe(false);
    expect(canViewFightRecording({ status: 'UPLOADED', visibility: 'public', submittedById: 'viewer' }, 'alliance', viewer)).toBe(true);
    expect(canViewFightRecording({ status: 'REJECTED', visibility: 'public', submittedById: 'viewer' }, 'alliance', viewer)).toBe(false);
  });
  it("keeps ordered recordings and deduplicates the legacy primary video", () => {
    expect(getFightRecordings({ video: video("first"), recordings: [
      { position: 1, video: video("second") }, { position: 0, video: video("first") },
    ] }).map(v => v.id)).toEqual(["first", "second"]);
  });

  it("preserves a recording submitted by an older app during rollout", () => {
    expect(getFightRecordings({ video: video("new"), recordings: [
      { position: 0, video: video("old") },
    ] }).map(v => v.id)).toEqual(["old", "new"]);
  });

  it("can qualify any recording without qualifying other recordings", () => {
    expect(fightHasRecording({ status: "PUBLISHED", visibility: "public" })).toEqual({ OR: [
      { video: { is: { status: "PUBLISHED", visibility: "public" } } },
      { recordings: { some: { video: { is: { status: "PUBLISHED", visibility: "public" } } } } },
    ] });
  });

  it("returns one fight when a video is both primary and in its recording collection", () => {
    const first = { id: "fight-1", death: 1 };
    expect(getVideoFights({ fights: [first], fightLinks: [{ fight: first }, { fight: { id: "fight-2", death: 0 } }] }))
      .toEqual([first, { id: "fight-2", death: 0 }]);
  });
});
