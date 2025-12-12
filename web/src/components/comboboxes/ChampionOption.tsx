import React from 'react';
import { SelectItem } from '@/components/ui/select';

interface Champion {
  id: number;
  name: string;
}

interface ChampionOptionProps {
  champion: Champion;
}

// Using React.memo to prevent re-rendering if the champion prop does not change.
export const ChampionOption = React.memo(function ChampionOption({ champion }: ChampionOptionProps) {
  return (
    <SelectItem value={String(champion.id)}>
      {champion.name}
    </SelectItem>
  );
});
