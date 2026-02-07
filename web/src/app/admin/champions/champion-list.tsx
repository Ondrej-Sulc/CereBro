"use client"

import Image from "next/image"
import { useState } from "react"
import { Ability, ChampionClass } from "@prisma/client"
import { AdminChampionCard, AdminChampionData } from "./champion-card"
import { ChampionEditor } from "./champion-editor"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { CLASSES, CLASS_ICONS } from "@/app/profile/roster/constants"
import { cn } from "@/lib/utils"
import { getChampionClassColors } from "@/lib/championClassHelper"

interface ChampionListProps {
  initialChampions: AdminChampionData[]
  allAbilities: Ability[]
}

export function ChampionList({ initialChampions, allAbilities }: ChampionListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState<ChampionClass | null>(null)
  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(null)

  const filteredChampions = initialChampions.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = selectedClass ? c.class === selectedClass : true
    return matchesSearch && matchesClass
  })

  const selectedChampion = initialChampions.find(c => c.id === selectedChampionId) || null
  
  // Create a simplified list for the editor's synergy dropdown
  const simpleChampionList = initialChampions.map(c => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search champions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button 
                variant={selectedClass === null ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedClass(null)}
                className="text-xs"
            >
                All
            </Button>
            {CLASSES.map(c => {
                const colors = getChampionClassColors(c)
                const isSelected = selectedClass === c
                return (
                    <Button
                        key={c}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedClass(isSelected ? null : c)}
                        className={cn(
                            "text-xs border transition-all gap-1.5 pl-1.5 pr-2.5",
                            isSelected 
                                ? cn(colors.bg, colors.border, colors.text, "brightness-125 font-bold") 
                                : "opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className="relative w-4 h-4">
                            <Image 
                                src={CLASS_ICONS[c as keyof typeof CLASS_ICONS]} 
                                alt={c} 
                                fill 
                                className="object-contain" 
                            />
                        </div>
                        {c}
                    </Button>
                )
            })}
          </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
        {filteredChampions.map((champion) => (
            <AdminChampionCard 
                key={champion.id} 
                champion={champion}
                onClick={() => setSelectedChampionId(champion.id)}
            />
        ))}
      </div>

      {filteredChampions.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
            No champions found matching your criteria.
        </div>
      )}

      <ChampionEditor 
        champion={selectedChampion} 
        allChampions={simpleChampionList}
        allAbilities={allAbilities}
        open={!!selectedChampion}
        onOpenChange={(open) => !open && setSelectedChampionId(null)}
      />
    </div>
  )
}
