"use client";

import { useState } from "react";
import { War, WarMapType, WarResult } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateWarDetails } from "@/app/planning/actions";
import { useToast } from "@/hooks/use-toast";

interface EditWarDialogProps {
  war: War;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isFinished?: boolean;
}

export function EditWarDialog({ 
  war, 
  trigger, 
  open: controlledOpen, 
  onOpenChange: setControlledOpen,
  isFinished = false
}: EditWarDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? setControlledOpen : setInternalOpen;

  const [isEditing, setIsEditing] = useState(false);
  const [isOffSeasonEdit, setIsOffSeasonEdit] = useState(war.warNumber === null);
  const [editData, setEditData] = useState({
      name: war.name || "",
      enemyAlliance: war.enemyAlliance || "",
      season: war.season,
      warNumber: war.warNumber || 1,
      warTier: war.warTier,
      result: war.result,
      enemyDeaths: war.enemyDeaths || 0
  });

  const handleUpdateWar = async () => {
      setIsEditing(true);
      try {
          await updateWarDetails(war.id, {
              ...editData,
              warNumber: isOffSeasonEdit ? null : editData.warNumber
          });
          toast({ title: "War Updated", description: "Details have been successfully updated." });
          if (onOpenChange) onOpenChange(false);
      } catch (error) {
          console.error("Failed to update war:", error);
          toast({ title: "Update Failed", description: "Could not update war details.", variant: "destructive" });
      } finally {
          setIsEditing(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800">
            <DialogHeader>
                <DialogTitle>Edit War Details</DialogTitle>
                <DialogDescription>
                    Update the war name, opponent, and metadata.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-name">War Name (Optional)</Label>
                    <Input
                        id="edit-name"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="e.g. Tough War"
                        className="bg-slate-900 border-slate-800"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-opponent">Opponent Alliance</Label>
                    <Input
                        id="edit-opponent"
                        value={editData.enemyAlliance}
                        onChange={(e) => setEditData({ ...editData, enemyAlliance: e.target.value })}
                        required
                        className="bg-slate-900 border-slate-800"
                    />
                </div>

                <div className="flex items-center space-x-2 py-1">
                    <Checkbox 
                        id="edit-isOffSeason" 
                        checked={isOffSeasonEdit}
                        onCheckedChange={(checked) => setIsOffSeasonEdit(checked as boolean)}
                    />
                    <Label 
                        htmlFor="edit-isOffSeason" 
                        className="text-sm font-medium leading-none cursor-pointer"
                    >
                        Off Season War
                    </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-season">Season</Label>
                        <Input
                            id="edit-season"
                            type="number"
                            value={editData.season}
                            onChange={(e) => setEditData({ ...editData, season: parseInt(e.target.value) })}
                            className="bg-slate-900 border-slate-800 no-spin-buttons"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-warNumber">War #</Label>
                        {isOffSeasonEdit ? (
                             <Input
                                disabled
                                value="Off-Season"
                                className="bg-slate-900 border-slate-800 opacity-50"
                             />
                        ) : (
                            <Select 
                                value={String(editData.warNumber)} 
                                onValueChange={(val) => setEditData({ ...editData, warNumber: parseInt(val) })}
                            >
                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                                        <SelectItem key={n} value={String(n)}>War {n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-tier">Tier</Label>
                        <Select 
                            value={String(editData.warTier)} 
                            onValueChange={(val) => setEditData({ ...editData, warTier: parseInt(val) })}
                        >
                            <SelectTrigger className="bg-slate-900 border-slate-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-800">
                                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                                    <SelectItem key={n} value={String(n)}>Tier {n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-enemyDeaths">Enemy Deaths</Label>
                        <Input
                            id="edit-enemyDeaths"
                            type="number"
                            value={editData.enemyDeaths}
                            onChange={(e) => setEditData({ ...editData, enemyDeaths: parseInt(e.target.value) || 0 })}
                            className="bg-slate-900 border-slate-800 no-spin-buttons"
                        />
                    </div>
                    {isFinished && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-result">War Result</Label>
                            <Select value={editData.result} onValueChange={(val) => setEditData({ ...editData, result: val as WarResult })}>
                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    <SelectItem value={WarResult.UNKNOWN}>Unknown</SelectItem>
                                    <SelectItem value={WarResult.WIN}>Win</SelectItem>
                                    <SelectItem value={WarResult.LOSS}>Loss</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange && onOpenChange(false)} className="bg-slate-900 border-slate-800 hover:bg-slate-800 hover:text-white">
                    Cancel
                </Button>
                <Button onClick={handleUpdateWar} disabled={isEditing} className="bg-sky-600 hover:bg-sky-500 text-white">
                    {isEditing ? "Updating..." : "Save Changes"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
