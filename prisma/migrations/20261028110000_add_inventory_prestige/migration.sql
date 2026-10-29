-- Explicit opt-in: existing imported/manual prestige values remain authoritative.
ALTER TABLE "Player" ADD COLUMN "relicPrestigeFromInventory" BOOLEAN NOT NULL DEFAULT false;
