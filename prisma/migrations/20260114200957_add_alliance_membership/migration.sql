-- CreateEnum
CREATE TYPE "MembershipRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipRequestType" AS ENUM ('INVITE', 'REQUEST');

-- AlterTable
ALTER TABLE "Alliance" ALTER COLUMN "guildId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AllianceMembershipRequest" (
    "id" TEXT NOT NULL,
    "status" "MembershipRequestStatus" NOT NULL DEFAULT 'PENDING',
    "type" "MembershipRequestType" NOT NULL,
    "allianceId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "inviterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllianceMembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllianceMembershipRequest_allianceId_idx" ON "AllianceMembershipRequest"("allianceId");

-- CreateIndex
CREATE INDEX "AllianceMembershipRequest_playerId_idx" ON "AllianceMembershipRequest"("playerId");

-- AddForeignKey
ALTER TABLE "AllianceMembershipRequest" ADD CONSTRAINT "AllianceMembershipRequest_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMembershipRequest" ADD CONSTRAINT "AllianceMembershipRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMembershipRequest" ADD CONSTRAINT "AllianceMembershipRequest_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
