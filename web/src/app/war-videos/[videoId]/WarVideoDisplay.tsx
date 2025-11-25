'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getChampionImageUrl } from '@/lib/championHelper';
import { WarNode, Player, ChampionClass, War } from '@prisma/client';
import { Check, Trash, Swords, Shield, Diamond, CircleDot, Info } from 'lucide-react';
import { getChampionClassColors } from '@/lib/championClassHelper';
import { cn } from '@/lib/utils';
import { Champion } from '@/types/champion';

interface WarFight {
  id: string;
  death: boolean;
  battlegroup: number | null;
  attacker: Champion;
  defender: Champion;
  prefightChampions: Champion[];
  node: WarNode;
  player: Player | null;
  war: War;
}

interface WarVideo {
  id: string;
  url: string | null;
  status: string;
  visibility: string;
  submittedBy: Player;
  createdAt: Date;
  fights: WarFight[];
}

interface WarVideoDisplayProps {
  warVideo: WarVideo;
  isAdmin: boolean;
}

function getYouTubeVideoId(url: string | null): string | null {
  if (!url) return null;

  let videoId: string | null = null;

  // Regex to match YouTube video IDs from various URL formats.
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      videoId = match[1];
      break;
    }
  }

  // Fallback for cases where the ID might just be in the path
  if (!videoId) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://` + url);
      const pathSegments = urlObj.pathname.split('/');
      const potentialId = pathSegments[pathSegments.length - 1];
      if (potentialId && potentialId.length === 11) {
        videoId = potentialId;
      }
    } catch (e) {
      // Ignore URL parsing errors if regex fails
    }
  }

  return videoId;
}

export default function WarVideoDisplay({ warVideo, isAdmin }: WarVideoDisplayProps) {
  const router = useRouter();
  const { toast } = useToast();
  const videoId = getYouTubeVideoId(warVideo.url);

  if (!warVideo.fights || warVideo.fights.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6">
          <h1 className="text-xl font-bold text-white mb-2">No Fight Data</h1>
          <p className="text-slate-400">This video has no associated fight data.</p>
        </div>
      </div>
    );
  }

  // Get war info from the first fight (all fights should be from the same war)
  const war = warVideo.fights[0].war;

  const handleApprove = async () => {
    const response = await fetch('/api/admin/war-videos/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: warVideo.id }),
    });

    if (response.ok) {
      toast({ title: 'Video Approved' });
      router.refresh();
    } else {
      const { error } = await response.json();
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    const response = await fetch('/api/admin/war-videos/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: warVideo.id }),
    });

    if (response.ok) {
      toast({ title: 'Video Rejected' });
      router.push('/'); // Redirect to home after rejection
    } else {
      const { error } = await response.json();
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  // Sort fights by node number
  const sortedFights = [...warVideo.fights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      {/* Header Section */}
      <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {`MCOC AW: S${war.season} W${war.warNumber || 'Offseason'} T${war.warTier}${war.enemyAlliance ? ` vs ${war.enemyAlliance}` : ''}`}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>Submitted by <span className="text-sky-400 font-medium">{warVideo.submittedBy.ingameName}</span></span>
            <span className="hidden sm:inline">•</span>
            <span>{new Date(warVideo.createdAt).toISOString().split('T')[0]}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-purple-400 font-medium">{warVideo.fights.length} {warVideo.fights.length === 1 ? 'Fight' : 'Fights'}</span>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && warVideo.status === 'UPLOADED' && (
        <div className="glass rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex flex-wrap gap-4">
          <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white border-0">
            <Check className="mr-2 h-4 w-4" /> Approve
          </Button>
          <Button variant="destructive" onClick={handleReject}>
            <Trash className="mr-2 h-4 w-4" /> Reject
          </Button>
        </div>
      )}

      {/* Video Player */}
      {videoId && (
        <div className="rounded-xl overflow-hidden border border-slate-800/50 shadow-2xl bg-black">
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fights List Section */}
        <div className="lg:col-span-2 space-y-6">
          {sortedFights.map((fight) => (
            <div key={fight.id} className="glass rounded-xl border border-slate-800/50 overflow-hidden">
              {/* Node Header & Outcome */}
              <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
                    Node {fight.node.nodeNumber}
                  </span>
                </div>
                <Badge
                  variant={fight.death ? "destructive" : "default"}
                  className={cn(
                    "font-semibold px-3 py-1",
                    fight.death
                      ? "bg-gradient-to-r from-red-600/80 to-red-700/80 text-red-100 hover:from-red-600 hover:to-red-700 border-red-500/50"
                      : "bg-gradient-to-r from-green-600/80 to-green-700/80 text-green-100 hover:from-green-600 hover:to-green-700 border-green-500/50"
                  )}
                >
                  {fight.death ? '💀 Death' : '✓ Solo'}
                </Badge>
              </div>

              <div className="p-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                {/* Attacker */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.attacker.class as ChampionClass).bg)} />
                    <Image
                      src={getChampionImageUrl(fight.attacker.images as any, '128', 'primary')}
                      alt={fight.attacker.name}
                      width={56}
                      height={56}
                      className={cn("relative rounded-full ring-2", getChampionClassColors(fight.attacker.class as ChampionClass).border)}
                    />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className={cn("font-bold text-sm sm:text-lg leading-tight truncate", getChampionClassColors(fight.attacker.class as ChampionClass).text)}>
                      {fight.attacker.name}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">
                      {fight.attacker.class}
                    </span>
                  </div>
                </div>

                {/* VS */}
                <div className="flex items-center justify-center">
                  <Swords className="h-5 w-5 text-slate-600/50" />
                </div>

                {/* Defender */}
                <div className="flex items-center justify-end gap-3 min-w-0 text-right">
                  <div className="min-w-0 flex flex-col items-end">
                    <span className={cn("font-bold text-sm sm:text-lg leading-tight truncate", getChampionClassColors(fight.defender.class as ChampionClass).text)}>
                      {fight.defender.name}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">
                      {fight.defender.class}
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.defender.class as ChampionClass).bg)} />
                    <Image
                      src={getChampionImageUrl(fight.defender.images as any, '128', 'primary')}
                      alt={fight.defender.name}
                      width={56}
                      height={56}
                      className={cn("relative rounded-full ring-2", getChampionClassColors(fight.defender.class as ChampionClass).border)}
                    />
                  </div>
                </div>
              </div>

              {/* Prefights Footer */}
              {fight.prefightChampions.length > 0 && (
                <div className="bg-slate-900/50 border-t border-slate-800/50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-purple-400 font-medium">
                      <Diamond className="h-4 w-4" />
                      <span>Prefights:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {fight.prefightChampions.map((champ) => (
                        <div key={champ.id} className="flex items-center gap-2 bg-purple-900/20 border border-purple-500/20 rounded-full pr-3 py-1 pl-1">
                          <Image src={getChampionImageUrl(champ.images as any, '64', 'primary')} alt={champ.name} width={24} height={24} className="rounded-full" />
                          <span className="text-xs font-medium text-purple-200">{champ.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* War Details Section */}
        <div className="space-y-6">
          <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-sky-400" />
              War Details
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {/* War Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Season</p>
                  <p className="font-bold text-white text-lg">{war.season}</p>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">War</p>
                  <p className="font-bold text-white text-lg">{war.warNumber || '-'}</p>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Tier</p>
                  <p className="font-bold text-white text-lg">{war.warTier}</p>
                </div>
              </div>

              {/* Player Info */}
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Player</span>
                  {warVideo.fights[0]?.battlegroup && (
                    <Badge variant="outline" className="border-purple-500/50 bg-purple-900/20 text-purple-300 text-xs">
                      BG {warVideo.fights[0].battlegroup}
                    </Badge>
                  )}
                </div>
                <p className="font-bold text-white text-lg truncate">{warVideo.submittedBy.ingameName}</p>
              </div>

              {/* Video Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50 text-center">
                  <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Status</p>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs">{warVideo.status}</Badge>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50 text-center">
                  <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Visibility</p>
                  <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs">{warVideo.visibility}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
