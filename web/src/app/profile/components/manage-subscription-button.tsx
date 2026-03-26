"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/support/portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: "/profile" }),
      });

      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Could not open billing portal. Please try again.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isLoading}
        className="text-slate-200 border-slate-700 hover:bg-slate-800 flex items-center gap-2"
      >
        <Settings className="w-4 h-4" />
        {isLoading ? "Opening..." : "Manage Subscription"}
      </Button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
