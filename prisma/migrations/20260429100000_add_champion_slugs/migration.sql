ALTER TABLE "Champion" ADD COLUMN "slug" TEXT;

WITH base_slugs AS (
    SELECT
        "id",
        COALESCE(
            NULLIF(
                trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')),
                ''
            ),
            "id"::text
        ) AS "baseSlug"
    FROM "Champion"
),
numbered_slugs AS (
    SELECT
        "id",
        "baseSlug",
        COUNT(*) OVER (PARTITION BY "baseSlug") AS "slugCount"
    FROM base_slugs
)
UPDATE "Champion"
SET "slug" = CASE
    WHEN numbered_slugs."slugCount" = 1 THEN numbered_slugs."baseSlug"
    ELSE numbered_slugs."baseSlug" || '-dup-' || "Champion"."id"::text
END
FROM numbered_slugs
WHERE "Champion"."id" = numbered_slugs."id";

CREATE UNIQUE INDEX "Champion_slug_key" ON "Champion"("slug");
