CREATE TYPE "BattlegroundsTournamentScope" AS ENUM ('COMMUNITY', 'ALLIANCE');

ALTER TYPE "BattlegroundsTournamentFormat" ADD VALUE 'DOUBLE_ELIMINATION';
ALTER TYPE "BattlegroundsTournamentFormat" ADD VALUE 'SWISS_TOP_CUT';
ALTER TYPE "BattlegroundsTournamentFormat" ADD VALUE 'LADDER';

ALTER TABLE "BattlegroundsTournament" ADD COLUMN "scope" "BattlegroundsTournamentScope" NOT NULL DEFAULT 'COMMUNITY';

ALTER TABLE "BattlegroundsTournament" ALTER COLUMN "allianceId" DROP NOT NULL;
ALTER TABLE "BattlegroundsTournament" DROP CONSTRAINT "BattlegroundsTournament_allianceId_fkey";
ALTER TABLE "BattlegroundsTournament" ADD CONSTRAINT "BattlegroundsTournament_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
