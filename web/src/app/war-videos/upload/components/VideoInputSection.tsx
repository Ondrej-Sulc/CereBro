import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoInputSectionProps {
  uploadMode: "single" | "multiple";
  sourceMode: "upload" | "link";
  videoFile: File | null;
  setVideoFile: (file: File | null) => void;
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  errors: Record<string, string>;
}

export function VideoInputSection({
  uploadMode,
  sourceMode,
  videoFile,
  setVideoFile,
  videoUrl,
  setVideoUrl,
  errors,
}: VideoInputSectionProps) {
  if (uploadMode !== "single") return null;

  return (
    <div className="glass rounded-xl border border-slate-800/60 p-4 sm:p-6 bg-slate-950/30 shadow-sm">
      {sourceMode === 'upload' ? (
        <>
          <Label htmlFor="videoFile" className="text-sm font-bold text-slate-300 mb-3 block">Video File</Label>
          <Label htmlFor="videoFile" className={cn(
            "flex flex-col items-center justify-center p-8 border border-dashed rounded-lg cursor-pointer",
            "bg-slate-900/50 border-slate-700/50 hover:border-sky-500/50 transition-colors",
            videoFile ? "border-sky-500/50 text-sky-400" : "text-slate-400"
          )}>
            <UploadCloud className="h-10 w-10 mb-2" />
            <span className="text-lg font-semibold mb-1">
              {videoFile ? videoFile.name : "Drag & drop video here, or click to select"}
            </span>
            <Input
              id="videoFile"
              type="file"
              accept="video/*"
              onChange={(e) =>
                setVideoFile(e.target.files ? e.target.files[0] : null)
              }
              required
              className="hidden"
            />
          </Label>
          {errors.videoFile && (
            <p className="text-sm text-red-400 mt-2">{errors.videoFile}</p>
          )}
        </>
      ) : (
        <>
          <Label htmlFor="videoUrl" className="text-sm font-medium text-slate-300 mb-3 block">Video URL</Label>
          <Input
            id="videoUrl"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            required
            className="bg-slate-900/50 border-slate-700/50 h-12 text-base placeholder:text-slate-600"
          />
          {errors.videoUrl && (
            <p className="text-sm text-red-400 mt-2">{errors.videoUrl}</p>
          )}
        </>
      )}
    </div>
  );
}
