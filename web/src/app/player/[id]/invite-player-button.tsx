"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { invitePlayerToAlliance } from "@/app/actions/alliance";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function InvitePlayerButton({
  playerId,
  initialPending,
}: {
  playerId: string;
  initialPending: boolean;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(initialPending);
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    setLoading(true);
    try {
      const result = await invitePlayerToAlliance(playerId);
      if (result && "error" in result) {
        toast({ title: "Invite failed", description: result.error, variant: "destructive" });
        return;
      }
      setPending(true);
      toast({ title: "Invitation sent", description: "The player can accept it from alliance onboarding." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to invite player";
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      className="gap-2"
      disabled={pending || loading}
      onClick={handleInvite}
    >
      <UserPlus className="h-4 w-4" />
      {pending ? "Invite Pending" : loading ? "Sending..." : "Invite Player"}
    </Button>
  );
}
