import { useMemo } from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChampionCombobox } from '@/components/ChampionCombobox';
import { MultiChampionCombobox } from '@/components/MultiChampionCombobox';
import { NodeCombobox } from '@/components/NodeCombobox';
import { Swords, Shield, Skull, Diamond, X, UploadCloud, Video } from 'lucide-react';
import { getChampionImageUrl } from '@/lib/championHelper';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { WarNode } from '@prisma/client';
import { getChampionClassColors } from '@/lib/championClassHelper';
import { Champion } from '@/types/champion';
import { Input } from './ui/input';

export interface FightData {
  id: string;
  nodeId: string;
  attackerId: string;
  defenderId: string;
  prefightChampionIds: string[];
  death: boolean;
  videoFile?: File | null;
  videoUrl?: string;
  battlegroup?: number;
}

interface FightBlockProps {
  fight: FightData;
  onFightChange: (fight: FightData) => void;
  onRemove: (fightId: string) => void;
  canRemove: boolean;
  initialChampions: Champion[];
  initialNodes: WarNode[];
  prefightChampions: Champion[];
  uploadMode: 'single' | 'multiple';
  sourceMode: 'upload' | 'link';
}

export function FightBlock({
  fight,
  onFightChange,
  onRemove,
  canRemove,
  initialChampions,
  initialNodes,
  prefightChampions,
  uploadMode,
  sourceMode,
}: FightBlockProps) {
  
  const selectedAttacker = useMemo(() => initialChampions.find(c => String(c.id) === fight.attackerId), [initialChampions, fight.attackerId]);
  const selectedDefender = useMemo(() => initialChampions.find(c => String(c.id) === fight.defenderId), [initialChampions, fight.defenderId]);

  const updateFight = (updates: Partial<FightData>) => {
    onFightChange({ ...fight, ...updates });
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border bg-slate-900/40 transition-all duration-300",
      fight.death 
        ? "border-red-500/30 bg-red-950/10 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]" 
        : "border-slate-800/50 hover:border-slate-700/50 hover:shadow-lg hover:shadow-black/20"
    )}>
      
            {/* --- Header: Node & Actions --- */}
            <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-950/30 px-4 py-3">
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Node</span>
                      <NodeCombobox
                          nodes={initialNodes}
                          value={fight.nodeId}
                          onSelect={(val) => updateFight({ nodeId: val })}
                          placeholder="#"
                          className="h-7 w-[80px] bg-slate-900 border-slate-700 text-sm"
                      />
                  </div>
              </div>
              
              {canRemove && (
                  <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:bg-red-500/10 hover:text-red-400 -mr-2"
                      onClick={() => onRemove(fight.id)}
                  >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove fight</span>
                  </Button>
              )}
            </div>
      
            <div className="p-4 space-y-4">
                
                {/* --- Matchup Section --- */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    {/* Attacker Card */}
                    <div className="flex-1 flex items-center gap-3 w-full">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <Swords className="h-4 w-4 text-sky-400" />
                            <span>Attacker</span>
                        </div>
                        <ChampionCombobox 
                          champions={initialChampions} 
                          value={fight.attackerId} 
                          onSelect={(val) => updateFight({ attackerId: val })} 
                          placeholder="Select attacker..." 
                          className={cn("w-full bg-slate-950/50 border-slate-700/50", selectedAttacker && getChampionClassColors(selectedAttacker.class).text)}
                        />
                    </div>
      
                    {/* VS Divider (Desktop) */}
                    <div className="hidden sm:flex items-center justify-center px-1 text-slate-700 font-black text-xs italic opacity-50">VS</div>
                    <hr className="w-full sm:hidden border-slate-700/50" />
      
                    {/* Defender Card */}
                    <div className="flex-1 flex items-center gap-3 w-full justify-end">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <span>Defender</span>
                            <Shield className="h-4 w-4 text-amber-500" />
                        </div>
                        <ChampionCombobox 
                          champions={initialChampions} 
                          value={fight.defenderId} 
                          onSelect={(val) => updateFight({ defenderId: val })} 
                          placeholder="Select defender..." 
                          className={cn("w-full bg-slate-950/50 border-slate-700/50 text-right", selectedDefender && getChampionClassColors(selectedDefender.class).text)}
                        />
                    </div>
                </div>
      
                {/* --- Footer: Meta & Options --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2 border-t border-slate-800/50">
                    
                    {/* Prefights */}
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Diamond className="h-3 w-3 text-purple-400" />
                            Prefight Champions
                        </Label>
                        <MultiChampionCombobox
                            champions={prefightChampions}
                            selectedIds={fight.prefightChampionIds}
                            onSelectionChange={(val) => updateFight({ prefightChampionIds: val })}
                            className="bg-slate-950/30 border-slate-800 rounded-md"
                        />
                    </div>
      
                    {/* Options & Video */}
                    <div className="flex flex-col gap-4 justify-start">
                                                            {/* Death Toggle */}
                                                            <label 
                                                              className={cn(
                                                                  "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all",
                                                                  fight.death 
                                                                      ? "bg-red-500/10 border-red-500/30" 
                                                                      : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
                                                              )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Skull className={cn("h-4 w-4", fight.death ? "text-red-400" : "text-slate-500")} />
                                                                    <span className={cn("text-sm font-medium", fight.death ? "text-red-200" : "text-slate-400")}>Attacker Died</span>
                                                                </div>
                                                                <Checkbox 
                                                                  id={`death-${fight.id}`} 
                                                                  checked={fight.death} 
                                                                  onCheckedChange={(c) => updateFight({ death: !!c })} 
                                                                  className={cn("data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500")}
                                                                />
                                                            </label>                        {/* Individual Video Input (Multiple Mode) */}
                        {uploadMode === 'multiple' && (
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <Video className="h-3 w-3 text-sky-400" />
                                    Fight Video
                                </Label>
                                {sourceMode === 'upload' ? (
                                  <div className="flex items-center gap-2">
                                      <Label 
                                          htmlFor={`videoFile-${fight.id}`} 
                                          className="flex-1 cursor-pointer flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all text-sm text-slate-300"
                                      >
                                          <UploadCloud className="h-4 w-4" />
                                          <span className="truncate max-w-[150px]">{fight.videoFile ? fight.videoFile.name : 'Choose File'}</span>
                                      </Label>
                                      <Input 
                                          id={`videoFile-${fight.id}`} 
                                          type="file" 
                                          accept="video/*" 
                                          onChange={(e) => updateFight({ videoFile: e.target.files ? e.target.files[0] : null })}
                                          className="hidden" 
                                      />
                                  </div>
                                ) : (
                                  <Input
                                      id={`videoUrl-${fight.id}`}
                                      type="url"
                                      value={fight.videoUrl || ''}
                                      onChange={(e) => updateFight({ videoUrl: e.target.value })}
                                      placeholder="https://youtube.com/..."
                                      className="h-9 bg-slate-950/30 border-slate-800 text-sm"
                                  />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>    </div>
  );
}