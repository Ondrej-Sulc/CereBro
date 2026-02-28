"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateWarDetails, updateWarStatus } from "@/app/planning/actions";
import { useToast } from "@/hooks/use-toast";
import { WarStatus } from "@prisma/client";

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

  const handleCloseWar = async () => {
      setIsUpdating(true);
      try {
          // 1. Update Details (Result & Deaths)
          await updateWarDetails(war.id, {
              result: data.result,
              enemyDeaths: typeof data.enemyDeaths === 'string' ? parseInt(data.enemyDeaths) || 0 : data.enemyDeaths
          });

          // 2. Update Status to FINISHED
          await updateWarStatus(war.id, WarStatus.FINISHED);

          toast({ title: "War Finished", description: "War has been closed and results recorded." });
          onOpenChange(false);
          if (onSuccess) onSuccess();
      } catch (error) {
          console.error("Failed to close war:", error);
          toast({ title: "Update Failed", description: "Could not close war. Please try again.", variant: "destructive" });
      } finally {
          setIsUpdating(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800">
            <DialogHeader>
                <DialogTitle>Finish War</DialogTitle>
                <DialogDescription>
                    Before closing this war, please record the final results.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="space-y-2">
                    <Label htmlFor="close-result" className="text-sm font-medium text-slate-400">War Result</Label>
                    <Select value={data.result} onValueChange={(val) => setData({ ...data, result: val as WarResult })}>
                        <SelectTrigger id="close-result" className="bg-slate-900 border-slate-800 h-11">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-800">
                            <SelectItem value={WarResult.UNKNOWN}>Unknown / Not Set</SelectItem>
                            <SelectItem value={WarResult.WIN}>Alliance Win</SelectItem>
                            <SelectItem value={WarResult.LOSS}>Alliance Loss</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="close-enemyDeaths" className="text-sm font-medium text-slate-400">Total Enemy Deaths</Label>
                    <Input
                        id="close-enemyDeaths"
                        type="number"
                        value={data.enemyDeaths}
                        onChange={(e) => setData({ ...data, enemyDeaths: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                        onFocus={(e) => e.target.select()}
                        className="bg-slate-900 border-slate-800 h-11 no-spin-buttons text-lg"
                        placeholder="0"
                    />
                    <p className="text-[11px] text-slate-500">Enter the total number of deaths the opponent had in this war.</p>
                </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                    Cancel
                </Button>
                <Button 
                    onClick={handleCloseWar} 
                    disabled={isUpdating} 
                    className="bg-green-600 hover:bg-green-500 text-white min-w-[120px]"
                >
                    {isUpdating ? "Processing..." : "Finish War"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
