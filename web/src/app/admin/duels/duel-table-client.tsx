"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DuelSource, DuelStatus } from "@prisma/client";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  bulkUpdateDuels,
  countMatchingDuels,
  deleteDuel,
  updateDuelDetails,
  updateDuelStatus,
} from "./actions";
import {
  DuelFilterInput,
  DuelStatusFilter,
  formatDuelFilterSummary,
} from "./filters";

export interface DuelTableRow {
  id: number;
  playerName: string;
  rank: string | null;
  source: DuelSource;
  status: DuelStatus;
  submittedByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
  champion: {
    id: number;
    name: string;
  };
}

interface DuelChampionOption {
  id: number;
  name: string;
}

interface DuelTableClientProps {
  duels: DuelTableRow[];
  champions: DuelChampionOption[];
  filter: Required<DuelFilterInput>;
  total: number;
  page: number;
  pageCount: number;
}

const sourceLabels: Record<DuelSource, string> = {
  USER_SUGGESTION: "User",
  GUIA_MTC: "GuiaMTC",
  COCPIT: "CoCPit",
  MCOCHUB: "MCOCHUB",
};

const statusLabels: Record<DuelStatus, string> = {
  ACTIVE: "Active",
  SUGGESTED: "Suggested",
  OUTDATED: "Outdated",
  ARCHIVED: "Archived",
};

function statusBadgeClass(status: DuelStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "SUGGESTED":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "OUTDATED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "ARCHIVED":
      return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function availableTargets(status: DuelStatusFilter): DuelStatus[] {
  switch (status) {
    case "SUGGESTED":
      return [DuelStatus.ACTIVE, DuelStatus.ARCHIVED];
    case "OUTDATED":
      return [DuelStatus.ACTIVE, DuelStatus.ARCHIVED];
    case "ACTIVE":
      return [DuelStatus.ARCHIVED];
    case "ARCHIVED":
      return [DuelStatus.ACTIVE];
    default:
      return [DuelStatus.ACTIVE, DuelStatus.ARCHIVED];
  }
}

function actionLabel(targetStatus: DuelStatus, sourceStatus?: DuelStatusFilter) {
  if (targetStatus === "ACTIVE") {
    return sourceStatus === "OUTDATED" ? "Mark Active" : "Approve";
  }
  if (targetStatus === "ARCHIVED") {
    return sourceStatus === "SUGGESTED" ? "Reject" : "Archive";
  }
  return statusLabels[targetStatus];
}

function buildPageHref(filter: Required<DuelFilterInput>, page: number) {
  const params = new URLSearchParams();
  params.set("status", filter.status);
  params.set("source", filter.source);
  if (filter.q) params.set("q", filter.q);
  if (page > 1) params.set("page", String(page));
  return `/admin/duels?${params.toString()}`;
}

export function DuelTableClient({
  duels,
  champions,
  filter,
  total,
  page,
  pageCount,
}: DuelTableClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<{
    scope: "selected" | "all";
    targetStatus: DuelStatus;
    count: number;
    summary: string;
  } | null>(null);
  const [editingDuel, setEditingDuel] = useState<DuelTableRow | null>(null);

  const visibleIds = useMemo(() => duels.map((duel) => duel.id), [duels]);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const currentStatus = filter.status;
  const targetStatuses = availableTargets(currentStatus);
  const canApplyToAll = currentStatus !== "all";

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function confirmSelected(targetStatus: DuelStatus) {
    const count = selectedIds.size;
    if (count === 0) return;
    setConfirmAction({
      scope: "selected",
      targetStatus,
      count,
      summary: `${count.toLocaleString()} selected ${count === 1 ? "duel" : "duels"}`,
    });
  }

  function confirmAllMatching(targetStatus: DuelStatus) {
    if (currentStatus === "all") return;
    startTransition(async () => {
      try {
        const count = await countMatchingDuels({
          filter,
          fromStatus: currentStatus as DuelStatus,
        });
        setConfirmAction({
          scope: "all",
          targetStatus,
          count,
          summary: formatDuelFilterSummary(filter, currentStatus as DuelStatus),
        });
      } catch (error) {
        toast({
          title: "Could not count matching duels",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    });
  }

  function executeConfirmedAction() {
    if (!confirmAction) return;

    startTransition(async () => {
      try {
        const result =
          confirmAction.scope === "selected"
            ? await updateDuelStatus({
                ids: [...selectedIds],
                status: confirmAction.targetStatus,
              })
            : await bulkUpdateDuels({
                filter,
                fromStatus: currentStatus as DuelStatus,
                toStatus: confirmAction.targetStatus,
              });

        toast({
          title: "Duels updated",
          description: `${result.updatedCount.toLocaleString()} ${result.updatedCount === 1 ? "duel was" : "duels were"} updated.`,
        });
        setSelectedIds(new Set());
        setConfirmAction(null);
        router.refresh();
      } catch (error) {
        toast({
          title: "Update failed",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    });
  }

  function quickUpdate(ids: number[], targetStatus: DuelStatus) {
    startTransition(async () => {
      try {
        const result = await updateDuelStatus({ ids, status: targetStatus });
        toast({
          title: "Duel updated",
          description: `${result.updatedCount.toLocaleString()} ${result.updatedCount === 1 ? "duel was" : "duels were"} updated.`,
        });
        router.refresh();
      } catch (error) {
        toast({
          title: "Update failed",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    });
  }

  async function handleDelete(id: number) {
    try {
      await deleteDuel({ id });
      toast({ title: "Duel deleted" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm">
            <span className="font-semibold">{selectedIds.size.toLocaleString()}</span> selected
          </div>
          <div className="flex flex-wrap gap-2">
            {targetStatuses.map((targetStatus) => (
              <Button
                key={`selected-${targetStatus}`}
                size="sm"
                variant={targetStatus === "ARCHIVED" ? "destructive" : "default"}
                onClick={() => confirmSelected(targetStatus)}
                disabled={isPending}
              >
                {targetStatus === "ACTIVE" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                {actionLabel(targetStatus, currentStatus)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {canApplyToAll && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm">
            <div className="font-medium">Apply to all matching filter</div>
            <div className="text-xs text-muted-foreground">
              Server-counted action for large queues: {formatDuelFilterSummary(filter, currentStatus as DuelStatus)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {targetStatuses.map((targetStatus) => (
              <Button
                key={`all-${targetStatus}`}
                size="sm"
                variant={targetStatus === "ARCHIVED" ? "destructive" : "outline"}
                onClick={() => confirmAllMatching(targetStatus)}
                disabled={isPending}
              >
                {actionLabel(targetStatus, currentStatus)} all
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select visible duels"
                  checked={allVisibleSelected ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                  onCheckedChange={(value) => toggleAllVisible(value === true)}
                />
              </TableHead>
              <TableHead>Champion</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No duels match this filter.
                </TableCell>
              </TableRow>
            ) : (
              duels.map((duel) => (
                <TableRow key={duel.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${duel.playerName}`}
                      checked={selectedIds.has(duel.id)}
                      onCheckedChange={(value) => toggleRow(duel.id, value === true)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{duel.champion.name}</TableCell>
                  <TableCell>{duel.playerName}</TableCell>
                  <TableCell className="text-muted-foreground">{duel.rank || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sourceLabels[duel.source]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("w-fit", statusBadgeClass(duel.status))}>
                      {statusLabels[duel.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
                    {duel.submittedByDiscordId || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(duel.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {duel.status === "SUGGESTED" && (
                        <>
                          <Button size="sm" className="h-8" onClick={() => quickUpdate([duel.id], DuelStatus.ACTIVE)} disabled={isPending}>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8" onClick={() => quickUpdate([duel.id], DuelStatus.ARCHIVED)} disabled={isPending}>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      {duel.status === "OUTDATED" && (
                        <>
                          <Button size="sm" className="h-8" onClick={() => quickUpdate([duel.id], DuelStatus.ACTIVE)} disabled={isPending}>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Active
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8" onClick={() => quickUpdate([duel.id], DuelStatus.ARCHIVED)} disabled={isPending}>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Archive
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingDuel(duel)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive">
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this duel target?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes {duel.playerName} for {duel.champion.name}. Use archive for normal review cleanup.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(duel.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page.toLocaleString()} of {pageCount.toLocaleString()} - {total.toLocaleString()} matching
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={buildPageHref(filter, Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
            <Link href={buildPageHref(filter, Math.min(pageCount, page + 1))}>Next</Link>
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bulk duel update</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {confirmAction?.count.toLocaleString()} {confirmAction?.count === 1 ? "duel" : "duels"} to{" "}
              {confirmAction ? statusLabels[confirmAction.targetStatus] : ""}. Scope: {confirmAction?.summary}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction} disabled={isPending}>
              {isPending ? "Updating" : "Update duels"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditDuelDialog
        key={editingDuel?.id ?? "no-duel"}
        duel={editingDuel}
        champions={champions}
        open={!!editingDuel}
        onOpenChange={(open) => !open && setEditingDuel(null)}
        onSaved={() => {
          setEditingDuel(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function EditDuelDialog({
  duel,
  champions,
  open,
  onOpenChange,
  onSaved,
}: {
  duel: DuelTableRow | null;
  champions: DuelChampionOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [championId, setChampionId] = useState(() => (duel ? String(duel.champion.id) : ""));
  const [playerName, setPlayerName] = useState(() => duel?.playerName ?? "");
  const [rank, setRank] = useState(() => duel?.rank ?? "");
  const [source, setSource] = useState<DuelSource>(() => duel?.source ?? "USER_SUGGESTION");
  const [status, setStatus] = useState<DuelStatus>(() => duel?.status ?? "SUGGESTED");

  function save() {
    if (!duel) return;

    startTransition(async () => {
      try {
        await updateDuelDetails({
          id: duel.id,
          championId: Number.parseInt(championId, 10),
          playerName,
          rank,
          source,
          status,
        });
        toast({ title: "Duel updated" });
        onSaved();
      } catch (error) {
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Duel Target</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Champion</label>
            <Select value={championId} onValueChange={setChampionId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {champions.map((champion) => (
                  <SelectItem key={champion.id} value={String(champion.id)}>
                    {champion.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Player Name</label>
            <Input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Rank</label>
            <Input value={rank} onChange={(event) => setRank(event.target.value)} placeholder="Optional" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Source</label>
              <Select value={source} onValueChange={(value) => setSource(value as DuelSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DuelSource).map((item) => (
                    <SelectItem key={item} value={item}>
                      {sourceLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as DuelStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DuelStatus).map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending || !playerName.trim() || !championId}>
            {isPending ? "Saving" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
