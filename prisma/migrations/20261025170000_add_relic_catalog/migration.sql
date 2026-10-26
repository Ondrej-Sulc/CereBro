CREATE TABLE "GameRelicImport" (
 "id" TEXT NOT NULL, "generatedAt" TIMESTAMP(3) NOT NULL, "manifest" JSONB NOT NULL, "snapshot" JSONB NOT NULL,
 "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GameRelicImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GameRelic" (
 "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "shortName" TEXT NOT NULL, "type" TEXT NOT NULL,
 "class" "ChampionClass" NOT NULL, "familyKey" TEXT NOT NULL, "primaryAttribute" TEXT, "secondaryAttribute" TEXT,
 "portraitPath" TEXT NOT NULL, "definition" JSONB NOT NULL, "sourceHash" TEXT NOT NULL,
 "isCurrent" BOOLEAN NOT NULL DEFAULT true, "importId" TEXT NOT NULL,
 CONSTRAINT "GameRelic_pkey" PRIMARY KEY ("id"), CONSTRAINT "GameRelic_type_check" CHECK ("type" IN ('battlecast','statcast'))
);
CREATE TABLE "GameRelicRarity" (
 "relicId" TEXT NOT NULL, "sourceRarityId" TEXT NOT NULL, "stars" INTEGER NOT NULL, "sourceOrderIndex" INTEGER NOT NULL,
 "maxRank" INTEGER NOT NULL, "maxSignature" INTEGER NOT NULL, "selectable" BOOLEAN NOT NULL,
 "isCurrent" BOOLEAN NOT NULL DEFAULT true, "raw" JSONB NOT NULL,
 CONSTRAINT "GameRelicRarity_pkey" PRIMARY KEY ("relicId","sourceRarityId"),
 CONSTRAINT "GameRelicRarity_progression_check" CHECK ("stars" BETWEEN 1 AND 7 AND "sourceOrderIndex">=0 AND "maxRank">0 AND "maxSignature">=0)
);
CREATE TABLE "GameRelicSocketItem" (
 "id" TEXT NOT NULL,"name" TEXT NOT NULL,"type" TEXT NOT NULL,"definition" JSONB NOT NULL,"sourceHash" TEXT NOT NULL,
 "isCurrent" BOOLEAN NOT NULL DEFAULT true,"importId" TEXT NOT NULL, CONSTRAINT "GameRelicSocketItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameRelic_slug_key" ON "GameRelic"("slug");
CREATE INDEX "GameRelic_isCurrent_type_class_idx" ON "GameRelic"("isCurrent","type","class");
CREATE INDEX "GameRelic_familyKey_idx" ON "GameRelic"("familyKey");
CREATE UNIQUE INDEX "GameRelicRarity_relicId_stars_key" ON "GameRelicRarity"("relicId","stars");
ALTER TABLE "GameRelic" ADD CONSTRAINT "GameRelic_importId_fkey" FOREIGN KEY ("importId") REFERENCES "GameRelicImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameRelicSocketItem" ADD CONSTRAINT "GameRelicSocketItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "GameRelicImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameRelicRarity" ADD CONSTRAINT "GameRelicRarity_relicId_fkey" FOREIGN KEY ("relicId") REFERENCES "GameRelic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
