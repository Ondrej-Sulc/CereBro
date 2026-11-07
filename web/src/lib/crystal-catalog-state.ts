import { isCrystalCategoryId } from "@cerebro/core/domain/crystal-categories"

/** Main pools are a category; accept the old explicit scope as a legacy alias. */
export function crystalCatalogCategory(category?: string | null, legacyScope?: string | null) {
  return category && isCrystalCategoryId(category) ? category : legacyScope === "main" ? "main" : "all"
}
