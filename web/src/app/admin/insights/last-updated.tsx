"use client";

import { useState, useEffect } from "react";

export function LastUpdated({ createdAtIso }: { createdAtIso: string }) {
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    setTimestamp(new Date(createdAtIso).toLocaleTimeString());
  }, [createdAtIso]);

  return (
    <div className="text-sm text-muted-foreground italic">
       Last updated: {timestamp || "..."}
    </div>
  );
}
