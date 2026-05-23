"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import {
  getAllianceDiscordOptions,
  updateAllianceDiscordConfig,
  type AllianceDiscordConfig,
  type DiscordChannelOption,
} from "@/app/actions/alliance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type MissingDiscordConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingBattlegroups: number[];
  context: "attack-plan" | "defense-plan";
  canConfigure: boolean;
  onConfigured?: () => void;
};

const NONE = "__none__";
const MIN_BATTLEGROUP = 1;
const MAX_BATTLEGROUP = 3;

function normalizeBattlegroups(battlegroups: number[]) {
  return [...new Set(
    battlegroups
      .map((bg) => Number(bg))
      .filter((bg) => Number.isInteger(bg) && bg >= MIN_BATTLEGROUP && bg <= MAX_BATTLEGROUP)
  )].sort((a, b) => a - b);
}

export function MissingDiscordConfigDialog({
  open,
  onOpenChange,
  missingBattlegroups,
  context,
  canConfigure,
  onConfigured,
}: MissingDiscordConfigDialogProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AllianceDiscordConfig | null>(null);
  const [channels, setChannels] = useState<DiscordChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sortedBgs = useMemo(() => normalizeBattlegroups(missingBattlegroups), [missingBattlegroups]);
  const planLabel = context === "attack-plan" ? "attack plan" : "defense plan";

  useEffect(() => {
    if (!open || !canConfigure) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    getAllianceDiscordOptions()
      .then((result) => {
        if (cancelled) return;
        if (!result.guildLinked) {
          setLoadError("Discord is not linked for this alliance.");
          return;
        }
        setConfig(result.config);
        setChannels(result.channels);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not load Discord channels.";
        if (!cancelled) {
          setLoadError(message);
          toast({ title: "Failed to load Discord setup", description: message, variant: "destructive" });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, canConfigure, toast]);

  const fieldForBg = (bg: number): keyof AllianceDiscordConfig | null => {
    if (bg === 1) return "battlegroup1ChannelId";
    if (bg === 2) return "battlegroup2ChannelId";
    if (bg === 3) return "battlegroup3ChannelId";
    return null;
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await updateAllianceDiscordConfig(config);
      toast({ title: "Discord channels saved" });
      if (onConfigured) {
        onConfigured();
      } else {
        onOpenChange(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save Discord channels.";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Discord Channels Required
          </DialogTitle>
          <DialogDescription>
            {canConfigure
              ? `Set the missing battlegroup channels before distributing this ${planLabel}.`
              : `An officer must configure Discord battlegroup channels before this ${planLabel} can be distributed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
            Missing channels: {sortedBgs.map((bg) => `BG${bg}`).join(", ")}
          </div>

          {canConfigure ? (
            isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Discord channels...
              </div>
            ) : loadError ? (
              <div className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-100">{loadError}</div>
            ) : config ? (
              <div className="space-y-3">
                {sortedBgs.map((bg) => {
                  const field = fieldForBg(bg);
                  if (!field) return null;
                  return (
                    <div key={bg} className="space-y-1.5">
                      <Label>BG{bg} channel</Label>
                      <Select
                        value={config[field] ?? NONE}
                        onValueChange={(value) => setConfig((current) => current ? {
                          ...current,
                          [field]: value === NONE ? null : value,
                        } : current)}
                        disabled={isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Not configured</SelectItem>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            ) : null
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {canConfigure && (
            <Button onClick={handleSave} disabled={isLoading || isSaving || !!loadError || !config} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save and Retry
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
