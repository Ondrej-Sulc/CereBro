"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Swords, Shield, Skull, Diamond } from 'lucide-react';
import { getChampionImageUrl } from '@/lib/championHelper';
import { ChampionImages } from '@/types/champion';

interface Champion {
  id: number;
  name: string;
  images: ChampionImages;
  abilities: { ability: { name: string } }[];
}

interface WarNode {
  id: number;
  nodeNumber: number;
  description?: string;
}

export interface FightDataDisplay {
  nodeId: string;
  attackerId: string;
  defenderId: string;
  prefightChampionIds: string[];
  death: boolean;
}

interface FightBlockDisplayProps {
  fight: FightDataDisplay;
  allChampions: Champion[];
  allNodes: WarNode[];
}

export function FightBlockDisplay({
  fight,
  allChampions,
  allNodes,
}: FightBlockDisplayProps) {
  const selectedNode = useMemo(() => allNodes.find(n => String(n.id) === fight.nodeId), [allNodes, fight.nodeId]);
  const selectedAttacker = useMemo(() => allChampions.find(c => String(c.id) === fight.attackerId), [allChampions, fight.attackerId]);
  const selectedDefender = useMemo(() => allChampions.find(c => String(c.id) === fight.defenderId), [allChampions, fight.defenderId]);
  const selectedPrefightChampions = useMemo(() =>
    allChampions.filter(c => fight.prefightChampionIds.includes(String(c.id))),
    [allChampions, fight.prefightChampionIds]
  );

  return (
    <Card className="bg-muted/50">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-4">
          <div className="w-1/5 flex flex-col items-center gap-2">
            <Label className="text-lg font-semibold">Node</Label>
            <p className="text-2xl font-bold">{selectedNode ? selectedNode.nodeNumber : 'N/A'}</p>
          </div>

          <div className="w-4/5 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 p-4 border rounded-lg bg-background">
              <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-lg font-semibold text-red-500">
                  <Swords className="h-6 w-6" />
                  <h3>Attacker</h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedAttacker && <Image src={getChampionImageUrl(selectedAttacker.images, '128', 'primary')} alt={selectedAttacker.name} width={50} height={50} className="rounded-full" />}
                  <p className="text-lg font-medium">{selectedAttacker?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="font-bold text-2xl text-muted-foreground hidden md:block">VS</div>
              <hr className="w-full md:hidden" />
              <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-lg font-semibold text-blue-500">
                  <Shield className="h-6 w-6" />
                  <h3>Defender</h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDefender && <Image src={getChampionImageUrl(selectedDefender.images, '128', 'primary')} alt={selectedDefender.name} width={50} height={50} className="rounded-full" />}
                  <p className="text-lg font-medium">{selectedDefender?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Diamond className="h-5 w-5 text-muted-foreground" />
                <Label>Prefight Champions:</Label>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedPrefightChampions.length > 0 ? (
                  selectedPrefightChampions.map((champ: Champion) => (
                    <div key={champ.id} className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded-full">
                      <Image src={getChampionImageUrl(champ.images, '64', 'primary')} alt={champ.name} width={20} height={20} className="rounded-full" />
                      <span>{champ.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">None</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <Checkbox id="death-display" checked={fight.death} disabled />
          <div className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-muted-foreground" />
            <Label htmlFor="death-display">Attacker Died?</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}