import { getAbilityCategories, getAbilities } from "./actions"
import { CategoryList } from "./category-list"
import { AbilityList } from "./ability-list"
import { ensureAdmin } from "../actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function AdminAbilitiesPage() {
  await ensureAdmin("MANAGE_CHAMPIONS")

  const categories = await getAbilityCategories()
  const abilities = await getAbilities()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Abilities & Categories</h1>
      </div>
      
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="abilities">All Abilities</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <CategoryList initialCategories={categories} />
        </TabsContent>
        <TabsContent value="abilities" className="mt-6">
          <AbilityList initialAbilities={abilities} allCategories={categories.map(c => ({ id: c.id, name: c.name }))} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
