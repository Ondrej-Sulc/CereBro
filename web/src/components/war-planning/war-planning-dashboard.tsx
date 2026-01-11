"use client";

import { useState, useEffect } from "react";
import { War, WarStatus, WarMapType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Swords, 
  Shield, 
  Calendar, 
  ArrowRight, 
  LayoutDashboard,
  Archive,
  Trophy,
  History,
  Rocket,
  Trash2,
  Settings,
  Ban,
  Map as MapIcon,
  Grid3x3,
  ChevronDown
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { createWar, deleteWar } from "@/app/planning/actions";
import { useToast } from "@/hooks/use-toast";

interface WarPlanningDashboardProps {
  wars: War[];
  defaultSeason: number;
  defaultWarNumber: number;
  defaultTier: number;
  userTimezone: string | null;
  isBotAdmin: boolean;
  isOfficer: boolean;
  bgColors?: Record<number, string>;
}

export default function WarPlanningDashboard({
  wars,
  defaultSeason,
  defaultWarNumber,
  defaultTier,
  userTimezone,
  isBotAdmin,
  isOfficer,
  bgColors
}: WarPlanningDashboardProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState<WarMapType>(WarMapType.STANDARD);
  const [isOffSeason, setIsOffSeason] = useState(false);

  const activeWars = wars.filter((w) => w.status === WarStatus.PLANNING);
  const archivedWars = wars.filter((w) => w.status === WarStatus.FINISHED);

  // Pre-fill logic based on last war if available
  useEffect(() => {
      if (wars.length > 0) {
          setSelectedMapType(wars[0].mapType);
      }
  }, [wars]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Alliance War Hub
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage and plan Alliance Wars.
          </p>
        </div>
        
        <div className="flex-wrap flex flex-row items-center gap-2">
            {isBotAdmin && (
                <>
                    <Link href="/admin/nodes">
                        <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                            <Settings className="mr-2 h-4 w-4" />
                            Nodes
                        </Button>
                    </Link>
                    <Link href="/admin/tactics">
                        <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                            <Swords className="mr-2 h-4 w-4" />
                            Tactics
                        </Button>
                    </Link>
                    <Link href="/admin/bans">
                        <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                            <Ban className="mr-2 h-4 w-4" />
                            Bans
                        </Button>
                    </Link>
                </>
            )}
            {isOfficer && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                  <Button size="lg" className="bg-sky-600 hover:bg-sky-500 text-white shadow-glow transition-all">
                  <Plus className="mr-2 h-5 w-5" />
                  Start New War
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800">
                  <DialogHeader>
                  <DialogTitle>Start New War</DialogTitle>
                  <DialogDescription>
                      Set up details for the next Alliance War.
                  </DialogDescription>
                  </DialogHeader>
                  <form action={createWar} className="grid gap-4 py-4">
                  <input type="hidden" name="isOffSeason" value={isOffSeason ? "true" : "false"} />
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                      <Label htmlFor="season">Season</Label>
                      <Input
                          id="season"
                          name="season"
                          type="number"
                          required
                          defaultValue={defaultSeason}
                          className="bg-slate-900 border-slate-800 no-spin-buttons"
                      />
                      </div>
                      <div className="space-y-2">
                      <Label htmlFor="warNumber">War #</Label>
                      <Input
                          id="warNumber"
                          name="warNumber"
                          type="number"
                          disabled={isOffSeason}
                          defaultValue={defaultWarNumber}
                          className="bg-slate-900 border-slate-800 no-spin-buttons disabled:opacity-50"
                      />
                      </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 py-2">
                    <Checkbox 
                      id="isOffSeason" 
                      checked={isOffSeason}
                      onCheckedChange={(checked) => setIsOffSeason(checked as boolean)}
                    />
                    <Label 
                      htmlFor="isOffSeason" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Off Season War
                    </Label>
                  </div>

                  <div className="space-y-2">
                      <Label htmlFor="tier">Tier</Label>
                      <Input
                      id="tier"
                      name="tier"
                      type="number"
                      required
                      defaultValue={defaultTier}
                      className="bg-slate-900 border-slate-800 no-spin-buttons"
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="mapType">Map Type</Label>
                      <Select name="mapType" defaultValue={selectedMapType} onValueChange={(val) => setSelectedMapType(val as WarMapType)}>
                          <SelectTrigger className="bg-slate-900 border-slate-800">
                              <SelectValue placeholder="Select Map Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800">
                              <SelectItem value={WarMapType.STANDARD}>Standard Map (50 Nodes)</SelectItem>
                              <SelectItem value={WarMapType.BIG_THING}>Big Thing (10 Nodes)</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="opponent">Opponent Alliance</Label>
                      <Input
                      id="opponent"
                      name="opponent"
                      type="text"
                      required
                      placeholder="e.g. [TAG] Alliance Name"
                      className="bg-slate-900 border-slate-800"
                      />
                  </div>
                  <div className="flex justify-end pt-4">
                      <Button type="submit" className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-900/20 transition-all duration-300 transform hover:scale-[1.02]">
                      <Rocket className="mr-2 h-4 w-4" />
                      Create War Plan
                      </Button>
                  </div>
                  </form>
              </DialogContent>
              </Dialog>
            )}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Current War Plans */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold text-sky-400">
          <LayoutDashboard className="h-6 w-6" />
          <h2>Current War Plans</h2>
        </div>
        
        {activeWars.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-800 rounded-lg bg-slate-950/50 text-center text-slate-500">
            <p>No active war plans. Start a new war to begin planning.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeWars.map((war) => (
              <WarCard key={war.id} war={war} isActive userTimezone={userTimezone} isOfficer={isOfficer} />
            ))}
          </div>
        )}
      </section>

      {/* Archive Section */}
      <section className="space-y-4 pt-8">
         <div className="flex items-center gap-2 text-xl font-semibold text-slate-400">
          <History className="h-6 w-6" />
          <h2>Past Wars</h2>
        </div>

        {archivedWars.length === 0 ? (
           <p className="text-slate-500">No past wars found.</p>
        ) : (
          <Accordion type="multiple" defaultValue={[String(Math.max(...archivedWars.map(w => w.season)))]} className="w-full space-y-4">
            {Object.entries(
              archivedWars.reduce((acc, war) => {
                const season = war.season;
                if (!acc[season]) acc[season] = [];
                acc[season].push(war);
                return acc;
              }, {} as Record<number, War[]>)
            )
            .sort(([seasonA], [seasonB]) => Number(seasonB) - Number(seasonA))
            .map(([season, seasonWars]) => (
              <AccordionItem key={season} value={season} className="border border-slate-800 rounded-lg bg-slate-950/20 px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-slate-200">Season {season}</span>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-slate-700">
                      {seasonWars.length} Wars
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {seasonWars
                      .sort((a, b) => (b.warNumber || 0) - (a.warNumber || 0)) // Sort by war number descending within season
                      .map((war) => (
                        <WarCard key={war.id} war={war} userTimezone={userTimezone} isOfficer={isOfficer} />
                      ))
                    }
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
    </div>
  );
}

function WarCard({ war, isActive = false, userTimezone, isOfficer }: { war: War; isActive?: boolean; userTimezone?: string | null; isOfficer?: boolean }) {
  const [dateString, setDateString] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
     const date = new Date(war.createdAt);
     setDateString(date.toLocaleDateString(undefined, { 
       timeZone: userTimezone || undefined 
     }));
  }, [war.createdAt, userTimezone]);

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 group border-slate-800",
      isActive 
        ? "bg-slate-950/80 hover:border-sky-500/50 shadow-lg hover:shadow-sky-500/10" 
        : "bg-slate-950/40 hover:bg-slate-950/60 hover:border-slate-700"
    )}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
           <div className="space-y-1">
             <CardTitle className={cn(
               "text-xl flex items-center gap-2",
               isActive ? "text-white" : "text-slate-300"
             )}>
                <Swords className={cn("h-5 w-5", isActive ? "text-red-500" : "text-slate-500")} />
                {war.enemyAlliance}
             </CardTitle>
             <CardDescription className="flex items-center gap-2">
                Season {war.season} <span className="text-slate-600">•</span> War {war.warNumber || '?'}
             </CardDescription>
           </div>
           {isActive && (
             <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10 animate-pulse">
               Active
             </Badge>
           )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-slate-400">
             <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-800">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                <span>Tier {war.warTier}</span>
             </div>
             <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-800" title="Map Type">
                {war.mapType === WarMapType.BIG_THING ? (
                  <>
                    <Grid3x3 className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-purple-300">Big Thing</span>
                  </>
                ) : (
                  <>
                    <MapIcon className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-indigo-300">Standard</span>
                  </>
                )}
             </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-1">
             <Calendar className="h-3 w-3" />
             <span>{dateString || "Loading..."}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t border-slate-800/50 bg-slate-900/20 gap-2">
        <Link href={`/planning/${war.id}`} className="flex-1">
          <Button variant={isActive ? "default" : "secondary"} className={cn(
            "w-full gap-2 transition-all",
            isActive ? "bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-600/50 hover:border-sky-500" : ""
          )}>
            {isActive ? "Open War Plan" : "View War Details"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        
        {isOfficer && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-950 border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the war plan against <span className="text-white font-semibold">{war.enemyAlliance}</span> and all associated fight data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-900 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    try {
                      await deleteWar(war.id);
                      toast({
                        title: "War Deleted",
                        description: `War against ${war.enemyAlliance} has been deleted.`
                      });
                    } catch (error) {
                      console.error("Failed to delete war:", error);
                      toast({
                        title: "Delete Failed",
                        description: "Could not delete the war plan. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete War
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}
