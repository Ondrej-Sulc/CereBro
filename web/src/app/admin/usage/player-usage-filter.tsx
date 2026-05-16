"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { AsyncPlayerSearchCombobox } from "@/components/comboboxes/AsyncPlayerSearchCombobox";
import { Button } from "@/components/ui/button";

type PlayerUsageFilterProps = {
  selectedPlayerName?: string;
};

export function PlayerUsageFilter({ selectedPlayerName = "" }: PlayerUsageFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasSelectedPlayer = searchParams.has("playerId");

  function setSelectedPlayer(playerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (playerId) {
      params.set("playerId", playerId);
    } else {
      params.delete("playerId");
    }

    router.push(params.size > 0 ? `?${params.toString()}` : "/admin/usage");
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
      <AsyncPlayerSearchCombobox
        value={selectedPlayerName}
        onSelect={(id) => setSelectedPlayer(id)}
        placeholder="Search player usage..."
        className="md:w-[320px]"
      />
      {hasSelectedPlayer && (
        <Button type="button" variant="ghost" onClick={() => setSelectedPlayer("")} className="w-fit">
          Clear
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
