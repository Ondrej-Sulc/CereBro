import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadCloud, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarVideoHeaderProps {
  uploadMode: "single" | "multiple";
  setUploadMode: (mode: "single" | "multiple") => void;
  sourceMode: "upload" | "link";
  setSourceMode: (mode: "upload" | "link") => void;
  canUploadFiles: boolean;
}

export function WarVideoHeader({
  uploadMode,
  setUploadMode,
  sourceMode,
  setSourceMode,
  canUploadFiles,
}: WarVideoHeaderProps) {
  return (
    <div className="glass rounded-xl border border-slate-800/60 p-4 sm:p-6 flex flex-col gap-4 bg-slate-950/30 shadow-sm">
      <h3 className="text-xl font-bold text-white flex items-center gap-3">
        <UploadCloud className="h-6 w-6 text-sky-400" />
        Upload War Video
      </h3>

      {/* Source Mode Toggle (Upload/Link) */}
      <div>
        <Label className="text-sm font-medium text-slate-300 mb-2 block">Video Source</Label>
        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSourceMode("upload")}
            disabled={!canUploadFiles}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              sourceMode === "upload" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
              !canUploadFiles && "opacity-50 cursor-not-allowed"
            )}
          >
            <UploadCloud className="h-4 w-4" /> Upload File
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSourceMode("link")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              sourceMode === "link" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Video className="h-4 w-4" /> Use Link
          </Button>
        </div>
        {!canUploadFiles && (
          <p className="text-xs text-amber-500/80 mt-2">
            Direct file uploads are currently restricted to authorized alliances due to quota limits. Please use a YouTube link.
          </p>
        )}
      </div>

      {/* Upload Mode Toggle (Single/Multiple) */}
      <div>
        <Label className="text-sm font-medium text-slate-300 mb-2 block">Upload Mode</Label>
        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setUploadMode("single")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              uploadMode === "single" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            Single Video (all fights)
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setUploadMode("multiple")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              uploadMode === "multiple" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            Separate Videos (per fight)
          </Button>
        </div>
      </div>
    </div>
  );
}
