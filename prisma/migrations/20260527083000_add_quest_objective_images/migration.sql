ALTER TABLE "QuestObjective" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "QuestObjective" ADD COLUMN "imageFit" TEXT DEFAULT 'cover';
ALTER TABLE "QuestObjective" ADD COLUMN "imagePosition" TEXT DEFAULT 'center';
