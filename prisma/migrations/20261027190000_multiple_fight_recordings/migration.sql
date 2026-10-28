BEGIN;

CREATE TABLE "WarFightVideo" (
    "fightId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarFightVideo_pkey" PRIMARY KEY ("fightId", "videoId")
);

CREATE INDEX "WarFightVideo_fightId_position_idx" ON "WarFightVideo"("fightId", "position");
CREATE INDEX "WarFightVideo_videoId_idx" ON "WarFightVideo"("videoId");
ALTER TABLE "WarFightVideo" ADD CONSTRAINT "WarFightVideo_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "WarFight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarFightVideo" ADD CONSTRAINT "WarFightVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "WarVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

LOCK TABLE "WarFight" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "WarFightVideo" ("fightId", "videoId", "position", "createdAt")
SELECT "id", "videoId", 0, "createdAt" FROM "WarFight" WHERE "videoId" IS NOT NULL;

-- Preserve submissions from old bot/web instances while services roll over.
-- Updating the legacy link adds a recording instead of discarding earlier ones.
CREATE FUNCTION preserve_legacy_fight_recording() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."videoId" IS NOT NULL THEN
        INSERT INTO "WarFightVideo" ("fightId", "videoId", "position")
        SELECT NEW."id", NEW."videoId", COALESCE(MAX("position") + 1, 0)
        FROM "WarFightVideo" WHERE "fightId" = NEW."id"
        ON CONFLICT ("fightId", "videoId") DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preserve_legacy_fight_recording
AFTER INSERT OR UPDATE OF "videoId" ON "WarFight"
FOR EACH ROW EXECUTE FUNCTION preserve_legacy_fight_recording();

COMMIT;
