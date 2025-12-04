-- CreateEnum
CREATE TYPE "WarMapType" AS ENUM ('STANDARD', 'BIG_THING');

-- AlterTable
ALTER TABLE "War" ADD COLUMN     "mapType" "WarMapType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "WarNodeAllocation" ADD COLUMN     "mapType" "WarMapType" NOT NULL DEFAULT 'STANDARD';
