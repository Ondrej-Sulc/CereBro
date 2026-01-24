-- CreateEnum
CREATE TYPE "WarResult" AS ENUM ('WIN', 'LOSS', 'UNKNOWN');

-- AlterTable
ALTER TABLE "War" ADD COLUMN     "name" TEXT,
ADD COLUMN     "result" "WarResult" NOT NULL DEFAULT 'UNKNOWN';
