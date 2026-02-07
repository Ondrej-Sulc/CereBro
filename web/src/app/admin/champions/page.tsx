import { getChampions, getAbilities } from "./actions"
import { ChampionList } from "./champion-list"
import { AdminChampionData } from "./champion-card"

export default async function AdminChampionsPage() {
  const [champions, abilities] = await Promise.all([
    getChampions(),
    getAbilities()
  ])

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
