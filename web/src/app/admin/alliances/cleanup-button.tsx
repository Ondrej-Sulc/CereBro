"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2, Sparkles } from "lucide-react"
import { cleanupEmptyAlliances } from "./actions"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function CleanupAlliancesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleCleanup = async () => {
    setIsLoading(true)
    try {
      const { count } = await cleanupEmptyAlliances()
      toast({
        title: "Cleanup Complete",
        description: `Successfully deleted ${count} empty alliance records.`,
      })
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "An error occurred during cleanup.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 transition-all">
          <Trash2 className="h-4 w-4" />
          <span>Cleanup Orphans</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Delete Empty Alliances?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove all alliance records that currently have **0 members**. 
            Associated data like war history for these abandoned records will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm Cleanup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
