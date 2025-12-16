import React from "react";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface UploadOverlayProps {
  isSubmitting: boolean;
  currentUpload: string;
  uploadProgress: number;
}

export function UploadOverlay({
  isSubmitting,
  currentUpload,
  uploadProgress,
}: UploadOverlayProps) {
  if (!isSubmitting) return null;

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
      <Label className="text-xl font-semibold text-white mb-4">{currentUpload}</Label>
      <Progress value={uploadProgress} className="w-1/2 h-2" />
      <p className="text-sm text-slate-400 mt-4">{uploadProgress}% complete</p>
    </div>
  );
}
