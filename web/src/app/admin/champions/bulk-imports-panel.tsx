"use client"

import { BookOpenText, Database, Tags } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportGameStatsButton } from "./import-game-stats-button"
import { SyncTagsButton } from "./sync-tags-button"
import { ImportGameDescriptionsButton } from "./import-game-descriptions-button"

export function BulkImportsPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Game Stats
          </CardTitle>
          <CardDescription>
            Upload the generated mcoc_game_stats.json export and import tier, rank, prestige, rating, and combat stat rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportGameStatsButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Champion Tags
          </CardTitle>
          <CardDescription>
            Upload champion_display.json and tags.json to sync game tag assignments onto CereBro champions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncTagsButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="h-4 w-4" />
            Champion Text
          </CardTitle>
          <CardDescription>
            Upload champions.json and glossary.json to import game ability text templates, bios, special attacks, and glossary terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportGameDescriptionsButton />
        </CardContent>
      </Card>
    </div>
  )
}
