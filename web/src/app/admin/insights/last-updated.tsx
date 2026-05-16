"use client";

export function LastUpdated({ createdAtIso }: { createdAtIso: string }) {
  const date = new Date(createdAtIso);
  const timestamp = Number.isNaN(date.getTime()) ? "..." : date.toLocaleTimeString();

  return (
    <div className="text-sm text-muted-foreground italic">
       Last updated: {timestamp}
    </div>
  );
}
