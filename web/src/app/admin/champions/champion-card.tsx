"use client"

import Image from "next/image"
import { ChampionClass, ChampionAbilityLink, Ability, Attack, Hit, AttackType } from "@prisma/client"
import { ChampionImages } from "@/types/champion"
import { cn } from "@/lib/utils"
import { getChampionImageUrl } from "@/lib/championHelper"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { Badge } from "@/components/ui/badge"
import { Zap, Shield } from "lucide-react"

export type AdminChampionData = {
    id: number
    name: string
    shortName: string
    class: ChampionClass
    images: ChampionImages
    releaseDate: Date
    obtainable: string[]
    _count: { abilities: number }
    attacks: (Attack & { hits: Hit[] })[]
    abilities: (ChampionAbilityLink & { 
        ability: Ability,
        synergyChampions: {
            champion: {
                id: number
                name: string
                images: ChampionImages
            }
        }[]
    })[]
}

interface AdminChampionCardProps {
    champion: AdminChampionData
    onClick: () => void
}

export function AdminChampionCard({ champion, onClick }: AdminChampionCardProps) {
    const classColors = getChampionClassColors(champion.class)

    return (
        <div 
            className={cn(
                "group relative aspect-square rounded-lg overflow-hidden border cursor-pointer bg-slate-900 transition-all hover:scale-[1.05]",
                classColors.bg,
                "border-slate-800 hover:border-slate-500 hover:shadow-lg"
            )}
            onClick={onClick}
        >
            {/* Background Image */}
            <Image 
                src={getChampionImageUrl(champion.images, '128')} 
                alt={champion.name}
                fill
                sizes="(max-width: 768px) 25vw, (max-width: 1200px) 15vw, 10vw"
                className="object-cover transition-transform group-hover:scale-110 p-1"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90" />

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <h3 className="text-[10px] font-bold text-white truncate leading-tight text-center">{champion.name}</h3>
            </div>
        </div>
    )
}
