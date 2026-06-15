CREATE TYPE "BattlegroundsMatchBracket" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL');

ALTER TABLE "BattlegroundsTournamentMatch"
ADD COLUMN "bracket" "BattlegroundsMatchBracket" NOT NULL DEFAULT 'WINNERS';

DROP INDEX "BattlegroundsTournamentMatch_tournamentId_round_matchNumber_key";

CREATE UNIQUE INDEX "BattlegroundsTournamentMatch_tournamentId_bracket_round_matchNumber_key"
ON "BattlegroundsTournamentMatch"("tournamentId", "bracket", "round", "matchNumber");

CREATE INDEX "BattlegroundsTournamentMatch_tournamentId_bracket_idx"
ON "BattlegroundsTournamentMatch"("tournamentId", "bracket");
