-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN "tag" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "inviteOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_tag_key" ON "Alliance"("tag");
