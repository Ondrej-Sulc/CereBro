-- Persist the selected champion rarity for quest planning counters and prefights.
-- Rank and other roster details remain resolved from the player's current roster.
ALTER TABLE "PlayerQuestEncounter"
ADD COLUMN "selectedChampionStars" INTEGER,
ADD COLUMN "prefightChampionStars" INTEGER;

CREATE INDEX "PlayerQuestEncounter_selectedChampionId_selectedChampionStars_idx"
ON "PlayerQuestEncounter"("selectedChampionId", "selectedChampionStars");

CREATE INDEX "PlayerQuestEncounter_prefightChampionId_prefightChampionStars_idx"
ON "PlayerQuestEncounter"("prefightChampionId", "prefightChampionStars");
