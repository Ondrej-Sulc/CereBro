"use client"

import { Button } from "@/components/ui/button"
import { LogIn, Loader2 } from "lucide-react"
import { joinAllianceAsAdmin } from "./join-action"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation"

interface JoinAllianceButtonProps {
    allianceId: string
    allianceName: string
}

export function JoinAllianceButton({ allianceId, allianceName }: JoinAllianceButtonProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    async function handleJoin() {
        if (!confirm(`Are you sure you want to join "${allianceName}"? This will update your active profile to this alliance.`)) {
            return
        }

        setIsLoading(true)
        try {
            await joinAllianceAsAdmin(allianceId)
            toast({ title: `Joined ${allianceName}` })
            router.refresh()
        } catch (error) {
            console.error(error)
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
            toast({ 
                title: "Failed to join alliance", 
                description: errorMessage,
                variant: "destructive" 
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleJoin}
            disabled={isLoading}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
        >
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <LogIn className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Joining..." : "Join"}
        </Button>
    )
}
