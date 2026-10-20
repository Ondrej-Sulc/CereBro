BEGIN;

CREATE TABLE "ChampionAbilityOverview" (
  "championAbilityLinkId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "reviewHash" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChampionAbilityOverview_pkey" PRIMARY KEY ("championAbilityLinkId"),
  CONSTRAINT "ChampionAbilityOverview_text_length" CHECK (char_length("text") BETWEEN 1 AND 360),
  CONSTRAINT "ChampionAbilityOverview_championAbilityLinkId_fkey" FOREIGN KEY ("championAbilityLinkId") REFERENCES "ChampionAbilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

COMMIT;
