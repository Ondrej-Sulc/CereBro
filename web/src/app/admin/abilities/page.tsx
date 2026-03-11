import { getAbilityCategories } from "./actions"
import { CategoryList } from "./category-list"
import { ensureAdmin } from "../actions"

export default async function AdminAbilityCategoriesPage() {
  await ensureAdmin("MANAGE_CHAMPIONS")

  const categories = await getAbilityCategories()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ability Categories</h1>
      </div>
      
      <CategoryList initialCategories={categories} />
    </div>
  )
}
