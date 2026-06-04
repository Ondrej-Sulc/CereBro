CREATE TYPE "BattlegroundsTournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'SWISS', 'ROUND_ROBIN');
CREATE TYPE "BattlegroundsTournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'ARCHIVED');
CREATE TYPE "TournamentParticipantStatus" AS ENUM ('INVITED', 'CONFIRMED', 'CHECKED_IN', 'DROPPED');
CREATE TYPE "BattlegroundsMatchStatus" AS ENUM ('PENDING', 'READY', 'PLAYING', 'REPORTED', 'DISPUTED', 'FINAL');

CREATE TABLE "BattlegroundsTournament" (
  "id" TEXT NOT NULL,
  "allianceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "format" "BattlegroundsTournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
  "status" "BattlegroundsTournamentStatus" NOT NULL DEFAULT 'DRAFT',
  "checkInStartsAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BattlegroundsTournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattlegroundsTournamentParticipant" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "seed" INTEGER,
  "battlegroup" INTEGER,
  "status" "TournamentParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "checkedInAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BattlegroundsTournamentParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattlegroundsTournamentMatch" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "matchNumber" INTEGER NOT NULL,
  "status" "BattlegroundsMatchStatus" NOT NULL DEFAULT 'PENDING',
  "homeParticipantId" TEXT,
  "awayParticipantId" TEXT,
  "winnerParticipantId" TEXT,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "scheduledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BattlegroundsTournamentMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BattlegroundsTournament_allianceId_status_idx" ON "BattlegroundsTournament"("allianceId", "status");
CREATE INDEX "BattlegroundsTournament_createdById_idx" ON "BattlegroundsTournament"("createdById");
CREATE INDEX "BattlegroundsTournament_startsAt_idx" ON "BattlegroundsTournament"("startsAt");

CREATE UNIQUE INDEX "BattlegroundsTournamentParticipant_tournamentId_playerId_key" ON "BattlegroundsTournamentParticipant"("tournamentId", "playerId");
CREATE UNIQUE INDEX "BattlegroundsTournamentParticipant_tournamentId_seed_key" ON "BattlegroundsTournamentParticipant"("tournamentId", "seed");
CREATE INDEX "BattlegroundsTournamentParticipant_playerId_idx" ON "BattlegroundsTournamentParticipant"("playerId");
CREATE INDEX "BattlegroundsTournamentParticipant_tournamentId_battlegroup_idx" ON "BattlegroundsTournamentParticipant"("tournamentId", "battlegroup");

CREATE UNIQUE INDEX "BattlegroundsTournamentMatch_tournamentId_round_matchNumber_key" ON "BattlegroundsTournamentMatch"("tournamentId", "round", "matchNumber");
CREATE INDEX "BattlegroundsTournamentMatch_tournamentId_status_idx" ON "BattlegroundsTournamentMatch"("tournamentId", "status");
CREATE INDEX "BattlegroundsTournamentMatch_homeParticipantId_idx" ON "BattlegroundsTournamentMatch"("homeParticipantId");
CREATE INDEX "BattlegroundsTournamentMatch_awayParticipantId_idx" ON "BattlegroundsTournamentMatch"("awayParticipantId");
CREATE INDEX "BattlegroundsTournamentMatch_winnerParticipantId_idx" ON "BattlegroundsTournamentMatch"("winnerParticipantId");

ALTER TABLE "BattlegroundsTournament" ADD CONSTRAINT "BattlegroundsTournament_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournament" ADD CONSTRAINT "BattlegroundsTournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentParticipant" ADD CONSTRAINT "BattlegroundsTournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "BattlegroundsTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentParticipant" ADD CONSTRAINT "BattlegroundsTournamentParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentMatch" ADD CONSTRAINT "BattlegroundsTournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "BattlegroundsTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentMatch" ADD CONSTRAINT "BattlegroundsTournamentMatch_homeParticipantId_fkey" FOREIGN KEY ("homeParticipantId") REFERENCES "BattlegroundsTournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentMatch" ADD CONSTRAINT "BattlegroundsTournamentMatch_awayParticipantId_fkey" FOREIGN KEY ("awayParticipantId") REFERENCES "BattlegroundsTournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BattlegroundsTournamentMatch" ADD CONSTRAINT "BattlegroundsTournamentMatch_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "BattlegroundsTournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
