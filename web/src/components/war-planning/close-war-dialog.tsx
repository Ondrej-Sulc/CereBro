"use client";

import { useState, useEffect } from "react";
import { War, WarResult } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateWarDetails, updateWarStatus } from "@/app/planning/actions";
import { useToast } from "@/hooks/use-toast";
import { WarStatus } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ResultSwitch, DeathCounter } from "./war-result-controls";

interface CloseWarDialogProps {
  war: War;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CloseWarDialog({ 
  war, 
  open, 
  onOpenChange,
  onSuccess
}: CloseWarDialogProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [data, setData] = useState({
      result: war.result || WarResult.UNKNOWN,
      enemyDeaths: war.enemyDeaths || 0
  });

  // Re-sync data when war changes or dialog opens
  useEffect(() => {
    if (open) {
        setData({
            result: war.result || WarResult.UNKNOWN,
            enemyDeaths: war.enemyDeaths || 0
        });
    }
  }, [war.id, war.result, war.enemyDeaths, open]);

  const handleCloseWar = async () => {
      setIsUpdating(true);
      
      try {
          // Update Status to FINISHED and record result/deaths in a single transaction
          await updateWarStatus(war.id, WarStatus.FINISHED, {
              result: data.result,
              enemyDeaths: data.enemyDeaths
          });

          toast({ title: "War Finished", description: "War has been closed and results recorded." });
          onOpenChange(false);
          if (onSuccess) onSuccess();
      } catch (error) {
          console.error("Failed to close war:", error);
          const message = error instanceof Error ? error.message : "Could not close war. Please try again.";
          toast({ title: "Update Failed", description: message, variant: "destructive" });
      } finally {
          setIsUpdating(false);
      }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800">
            <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">Finish War</DialogTitle>
                <DialogDescription className="text-slate-400">
                    Before closing this war, please record the final results.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-8 py-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">War Result</Label>
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={data.result}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className={cn(
                                    "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-tighter",
                                    data.result === WarResult.WIN ? "bg-green-500/10 text-green-400" :
                                    data.result === WarResult.LOSS ? "bg-red-500/10 text-red-400" :
                                    "bg-slate-800 text-slate-500"
                                )}
                            >
                                {data.result === WarResult.UNKNOWN ? "Not Set" : data.result}
                            </motion.span>
                        </AnimatePresence>
                    </div>
                    <ResultSwitch value={data.result} onChange={(val) => setData({ ...data, result: val })} />
                </div>
                
                <div className="space-y-4">
                    <Label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Enemy Deaths</Label>
                    <DeathCounter value={data.enemyDeaths} onChange={(val) => setData({ ...data, enemyDeaths: val })} />
                    <p className="text-[11px] text-slate-500 text-center italic">Enter the total number of deaths the opponent had in this war.</p>
                </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                    Cancel
                </Button>
                <Button 
                    onClick={handleCloseWar} 
                    disabled={isUpdating} 
                    className={cn(
                        "min-w-[140px] font-bold transition-all duration-300",
                        data.result === WarResult.WIN ? "bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]" :
                        data.result === WarResult.LOSS ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]" :
                        "bg-slate-700 hover:bg-slate-600 text-white"
                    )}
                >
                    {isUpdating ? "Processing..." : "Finish War"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
