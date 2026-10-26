-- Detail-page projection; the complete untouched scaling export is also retained in GameRelicImport.
ALTER TABLE "GameRelic" ADD COLUMN "scalingContexts" JSONB NOT NULL DEFAULT '[]';
