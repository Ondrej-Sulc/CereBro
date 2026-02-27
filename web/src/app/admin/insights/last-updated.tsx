"use client";

import { useState, useEffect } from "react";

export function LastUpdated({ createdAtIso }: { createdAtIso: string }) {
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    const d = new Date(createdAtIso);
    if (isNaN(d.getTime())) {
      setTimestamp("…");
    } else {
      setTimestamp(d.toLocaleTimeString());
    }
  }, [createdAtIso]);

  return (
    <div className="text-sm text-muted-foreground italic">
       Last updated: {timestamp || "..."}
    </div>
  );
}
