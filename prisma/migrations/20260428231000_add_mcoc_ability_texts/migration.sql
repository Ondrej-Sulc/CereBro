-- Add game-extracted champion ability descriptions, glossary terms, and curve storage.

CREATE TABLE "ChampionAbilityText" (
    "id" SERIAL NOT NULL,
    "championId" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "template" JSONB NOT NULL,

    CONSTRAINT "ChampionAbilityText_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChampionAbilityCurve" (
    "id" SERIAL NOT NULL,
    "championId" INTEGER,
    "curveId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "minSig" INTEGER,
    "maxSig" INTEGER,

    CONSTRAINT "ChampionAbilityCurve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameGlossaryTerm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "raw" JSONB,

    CONSTRAINT "GameGlossaryTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChampionAbilityText_championId_sourceId_key" ON "ChampionAbilityText"("championId", "sourceId");
CREATE INDEX "ChampionAbilityText_championId_group_idx" ON "ChampionAbilityText"("championId", "group");
CREATE UNIQUE INDEX "ChampionAbilityCurve_curveId_key" ON "ChampionAbilityCurve"("curveId");

ALTER TABLE "ChampionAbilityText" ADD CONSTRAINT "ChampionAbilityText_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChampionAbilityCurve" ADD CONSTRAINT "ChampionAbilityCurve_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
