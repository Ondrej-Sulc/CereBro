CREATE TYPE "ResistanceMechanism" AS ENUM ('RESISTANCE', 'POTENCY', 'DAMAGE', 'DURATION', 'POTENCY_AND_DURATION');
CREATE TABLE "ChampionAbilityResistance" (
    "championAbilityLinkId" INTEGER NOT NULL,
    "effectId" INTEGER NOT NULL,
    "mechanism" "ResistanceMechanism" NOT NULL,
    "percent" DOUBLE PRECISION,
    "sourceHash" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    CONSTRAINT "ChampionAbilityResistance_pkey" PRIMARY KEY ("championAbilityLinkId", "effectId"),
    CONSTRAINT "ChampionAbilityResistance_percent_check" CHECK ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 10000)),
    CONSTRAINT "ChampionAbilityResistance_sourceHash_check" CHECK ("sourceHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "ChampionAbilityResistance_effectId_idx" ON "ChampionAbilityResistance"("effectId");
ALTER TABLE "ChampionAbilityResistance" ADD CONSTRAINT "ChampionAbilityResistance_championAbilityLinkId_fkey" FOREIGN KEY ("championAbilityLinkId") REFERENCES "ChampionAbilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChampionAbilityResistance" ADD CONSTRAINT "ChampionAbilityResistance_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Ability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
