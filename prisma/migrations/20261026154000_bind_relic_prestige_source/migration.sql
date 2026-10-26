-- Do not infer a capture's source package from today's catalog.
-- Existing unbound rows are hidden until reimported from verified evidence.
ALTER TABLE "GameRelicPrestige" ADD COLUMN "sourcePackageHash" TEXT;
