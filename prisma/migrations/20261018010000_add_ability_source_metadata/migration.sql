BEGIN;

CREATE TYPE "AbilityEffectForm" AS ENUM ('UNKNOWN', 'BUFF', 'DEBUFF', 'PASSIVE');
CREATE TYPE "AbilityEffectDirection" AS ENUM ('UNKNOWN', 'GAIN', 'INFLICT');

ALTER TABLE "ChampionAbilityLink"
  ADD COLUMN "effectForm" "AbilityEffectForm" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "effectDirection" "AbilityEffectDirection" NOT NULL DEFAULT 'UNKNOWN';

-- Preserve every source string; backfill only unambiguous leading form annotations.
UPDATE "ChampionAbilityLink"
SET "effectForm" = UPPER(SUBSTRING(TRIM("source") FROM '(?i)^(buff|debuff|passive)(?:[[:space:]]*[,;:]|[[:space:]]*$)'))::"AbilityEffectForm"
WHERE TRIM("source") ~* '^(buff|debuff|passive)([[:space:]]*[,;:]|[[:space:]]*$)'
  AND TRIM("source") !~* '^(buff|debuff|passive)[[:space:]]*[,;:][[:space:]]*(buff|debuff|passive)([[:space:]]*[,;:]|[[:space:]]*$)';

DROP INDEX "ChampionAbilityLink_championId_abilityId_type_source_key";
CREATE UNIQUE INDEX "ChampionAbilityLink_source_identity_key"
  ON "ChampionAbilityLink"("championId", "abilityId", "type", "source", "effectForm", "effectDirection");

COMMIT;
