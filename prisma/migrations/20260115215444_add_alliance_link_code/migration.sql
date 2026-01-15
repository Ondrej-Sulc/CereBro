/*
  Warnings:

  - A unique constraint covering the columns `[linkCode]` on the table `Alliance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "linkCode" TEXT,
ADD COLUMN     "linkCodeExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_linkCode_key" ON "Alliance"("linkCode");
