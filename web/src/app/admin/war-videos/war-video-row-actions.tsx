"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ExternalLink, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

interface WarVideoRowActionsProps {
  videoId: string;
  status: string;
}

async function postVideoAction(path: string, videoId: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Request failed");
  }
}

export function WarVideoRowActions({ videoId, status }: WarVideoRowActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const canReview = status === "UPLOADED";

  const approve = async () => {
    setIsApproving(true);
    try {
      await postVideoAction("/api/admin/war-videos/approve", videoId);
      toast({ title: "Video approved" });
      router.refresh();
    } catch (error) {
      const description = error instanceof Error ? error.message : "Request failed";
      toast({ title: "Approval failed", description, variant: "destructive" });
    } finally {
      setIsApproving(false);
    }
  };

  const reject = async () => {
    setIsRejecting(true);
    try {
      await postVideoAction("/api/admin/war-videos/reject", videoId);
      toast({ title: "Video rejected" });
      router.refresh();
    } catch (error) {
      const description = error instanceof Error ? error.message : "Request failed";
      toast({ title: "Rejection failed", description, variant: "destructive" });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button asChild variant="outline" size="sm" className="h-8">
        <Link href={`/war-videos/${videoId}`}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Review
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm" className="h-8">
        <Link href={`/war-videos/${videoId}/edit`}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Link>
      </Button>
      {canReview && (
        <>
          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={approve} disabled={isApproving || isRejecting}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {isApproving ? "Approving" : "Approve"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8" disabled={isApproving || isRejecting}>
                <Trash className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject this war video?</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks the submission as rejected. If the video was uploaded through CereBro and the YouTube URL can be parsed, CereBro may also delete the YouTube video.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={reject}>
                  {isRejecting ? "Rejecting" : "Reject video"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
