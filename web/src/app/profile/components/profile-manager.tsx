'use client';

import { useState, useTransition } from "react";
import { Player } from "@prisma/client";
import { createProfile, deleteProfile, renameProfile, switchProfile } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, Info, MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { LocalDate } from "@/components/LocalDate";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alliance } from "@prisma/client";

type PlayerWithExtras = Player & {
    alliance: Alliance | null;
    roster: { updatedAt: Date }[];
};

interface ProfileManagerProps {
  profiles: PlayerWithExtras[];
  activeProfileId: string;
}

export function ProfileManager({ profiles, activeProfileId }: ProfileManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [newProfileName, setNewProfileName] = useState("");
  const [editingProfile, setEditingProfile] = useState<{ id: string; name: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSwitch = (id: string) => {
    startTransition(async () => {
      try {
        const result = await switchProfile(id);
        if (result && 'error' in result) {
            toast({ 
                title: "Failed to switch profile",
                description: result.error,
                variant: "destructive"
            });
            return;
        }
        toast({ title: "Profile switched successfully" });
        router.refresh();
      } catch (error) {
        toast({ 
          title: "Failed to switch profile",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    });
  };

  const handleCreate = () => {
    if (!newProfileName.trim()) return;
    
    startTransition(async () => {
      try {
        const result = await createProfile(newProfileName);
        if (result && 'error' in result) {
            toast({ 
                title: "Failed to create profile",
                description: result.error,
                variant: "destructive"
            });
            return;
        }
        setNewProfileName("");
        setIsCreateOpen(false);
        toast({ title: "Profile created successfully" });
        router.refresh();
      } catch (error) {
        toast({ 
          title: "Failed to create profile",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    });
  };

  const handleRename = () => {
    if (!editingProfile || !editingProfile.name.trim()) return;

    startTransition(async () => {
      try {
        const result = await renameProfile(editingProfile.id, editingProfile.name);
        if (result && 'error' in result) {
            toast({ 
                title: "Failed to rename profile",
                description: result.error,
                variant: "destructive"
            });
            return;
        }
        setEditingProfile(null);
        setIsEditOpen(false);
        toast({ title: "Profile renamed successfully" });
        router.refresh();
      } catch (error) {
        toast({ 
          title: "Failed to rename profile",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const result = await deleteProfile(id);
        if (result && 'error' in result) {
            toast({ 
                title: "Failed to delete profile",
                description: result.error,
                variant: "destructive"
            });
            return;
        }
        toast({ title: "Profile deleted successfully" });
        router.refresh();
      } catch (error) {
        toast({ 
          title: "Failed to delete profile",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <section id="game-profiles" aria-labelledby="game-profiles-heading" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-3.5 py-3.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <h2 id="game-profiles-heading" className="text-base font-semibold text-white">Game profiles</h2>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1">
                <Info className="w-4 h-4 text-slate-500 hover:text-slate-400 transition-colors" />
                <span className="sr-only">About Profiles</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-800 border-slate-700 text-slate-200 p-3 text-sm">
              <p>Profiles allow you to manage multiple in-game accounts. Each profile has its own roster, prestige history, and alliance membership.</p>
            </PopoverContent>
          </Popover>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800">
              <Plus className="size-3.5" aria-hidden="true" />
              New profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Profile</DialogTitle>
              <DialogDescription>
                Add a new in-game profile to your account.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="In-Game Name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isPending || !newProfileName.trim()}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="divide-y divide-slate-800">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          return (
            <li
              key={profile.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 transition-colors sm:px-4 ${
                isActive
                  ? "bg-indigo-400/[0.07]"
                  : "hover:bg-slate-800/40"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Link href={`/player/${profile.id}`}>
                  <Avatar className="size-8 shrink-0 rounded-lg border border-slate-700 transition-shadow hover:ring-2 hover:ring-indigo-500">
                    <AvatarImage src={profile.avatar || undefined} alt={profile.ingameName} />
                    <AvatarFallback className="rounded-lg bg-slate-800 text-xs font-semibold">
                      {profile.ingameName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link 
                      href={`/player/${profile.id}`}
                      className="break-words text-sm font-medium text-slate-100 transition-colors hover:text-indigo-200 hover:underline [overflow-wrap:anywhere]"
                    >
                      {profile.ingameName}
                    </Link>
                    {isActive && (
                      <Badge variant="secondary" className="h-5 gap-1 border-indigo-400/20 bg-indigo-400/15 px-1.5 text-[10px] text-indigo-200">
                        <CheckCircle2 className="size-3" aria-hidden="true" /> Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {profile.alliance && (
                      <Link 
                          href={`/alliance/${profile.alliance.id}`}
                          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-sky-400 transition-colors"
                      >
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="break-words">{profile.alliance.name}</span>
                      </Link>
                    )}
                    {profile.roster?.[0] && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        <span>Updated <LocalDate value={profile.roster[0].updatedAt} /></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {!isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={"Switch to " + profile.ingameName}
                    className="rounded-lg px-2 text-xs text-indigo-200 hover:bg-indigo-400/10 hover:text-white"
                    onClick={() => handleSwitch(profile.id)}
                    disabled={isPending}
                  >
                    Switch
                  </Button>
                )}

                <Dialog open={isEditOpen && editingProfile?.id === profile.id} onOpenChange={(open) => {
                  setIsEditOpen(open);
                  if (!open) setEditingProfile(null);
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Rename " + profile.ingameName}
                      className="size-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                      onClick={() => {
                        setEditingProfile({ id: profile.id, name: profile.ingameName });
                        setIsEditOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rename Profile</DialogTitle>
                      <DialogDescription>
                        Update the name for this profile.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Input
                        placeholder="In-Game Name"
                        value={editingProfile?.name || ""}
                        onChange={(e) => setEditingProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleRename} disabled={isPending || !editingProfile?.name.trim()}>
                        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Delete " + profile.ingameName}
                      className="size-8 rounded-lg text-slate-400 hover:bg-red-400/10 hover:text-red-300"
                      disabled={profiles.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete <strong>{profile.ingameName}</strong>? This action cannot be undone and will remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(profile.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
