import { getChampions, getAbilities } from "./actions"
import { ChampionList } from "./champion-list"

export default async function AdminChampionsPage() {
  const [champions, abilities] = await Promise.all([
    getChampions(),
    getAbilities()
  ])

  // Transform the data to match the expected type if necessary, 
  // but since we included the relation in getChampions, it should be fine.
  // The _count property might need to be ignored or handled if strict typing is an issue,
  // but let's pass it as is.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Champions</h1>
      </div>
      
      <ChampionList 
        initialChampions={champions} 
        allAbilities={abilities} 
      />
    </div>
  )
}
