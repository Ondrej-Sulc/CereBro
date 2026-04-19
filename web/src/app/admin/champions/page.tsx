import type { Metadata } from "next"
import { getChampions, getAbilities } from "./actions"
import { ChampionList } from "./champion-list"
import { AdminChampionData } from "./champion-card"
import { ensureAdmin } from "../actions"
import { SyncTagsButton } from "./sync-tags-button"

export const metadata: Metadata = {
  title: "Champion Management - CereBro",
  description:
    "Manage champion data and related ability mappings used throughout CereBro.",
}

export default async function AdminChampionsPage() {
  await ensureAdmin("MANAGE_CHAMPIONS")

  const [champions, abilities] = await Promise.all([
    getChampions(),
    getAbilities()
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Champions</h1>
        <SyncTagsButton />
      </div>
      
      <ChampionList 
        initialChampions={champions} 
        allAbilities={abilities} 
      />
    </div>
  )
}
