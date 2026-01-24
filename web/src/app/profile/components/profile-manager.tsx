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
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProfileManagerProps {
  profiles: Player[];
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
        await switchProfile(id);
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
        await createProfile(newProfileName);
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
        await renameProfile(editingProfile.id, editingProfile.name);
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
        await deleteProfile(id);
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
    <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-200">Manage Profiles</h3>
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
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Profile
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

      <div className="space-y-2">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          return (
            <div
              key={profile.id}
              className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                isActive
                  ? "bg-indigo-500/10 border-indigo-500/50"
                  : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="font-medium text-slate-200">{profile.ingameName}</div>
                {isActive && (
                  <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                      className="h-8 w-8 text-slate-400 hover:text-white"
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
                      className="h-8 w-8 text-slate-400 hover:text-red-400"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
