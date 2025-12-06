'use client'

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createUploadSession } from "@/app/actions/createUploadSession";
import { useTransition } from "react";
import { useToast } from "@/hooks/use-toast";

export function UploadFightButton({ fightId }: { fightId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    return (
        <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 rounded-full bg-slate-800/50 border-slate-700 hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/50 transition-all"
            disabled={isPending}
            onClick={() => startTransition(async () => {
                try {
                    await createUploadSession(fightId);
                } catch (e) {
                    toast({ title: "Error", description: "Failed to start upload session", variant: "destructive" });
                }
            })}
        >
            <Plus className="h-4 w-4" />
        </Button>
    )
}
