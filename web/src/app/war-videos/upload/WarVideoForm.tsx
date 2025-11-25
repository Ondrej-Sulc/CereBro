"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { FightBlock, FightData } from "@/components/FightBlock";
import { UploadCloud, Plus, Swords } from "lucide-react";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { War, WarFight, Player as PrismaPlayer, WarNode as PrismaWarNode } from '@prisma/client';



interface PreFilledFight extends WarFight {
  war: War;
  player: PrismaPlayer;
  attacker: Champion;
  defender: Champion;
  node: PrismaWarNode;
  prefightChampions: Champion[];
}

interface WarVideoFormProps {
  token: string;
  initialChampions: Champion[];
  initialNodes: PrismaWarNode[];
  initialPlayers: PrismaPlayer[];
  initialUserId: string;
  preFilledFights: PreFilledFight[] | null;
}

export function WarVideoForm({
  token,
  initialChampions,
  initialNodes,
  initialPlayers,
  initialUserId,
  preFilledFights,
}: WarVideoFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [uploadMode, setUploadMode] = useState<"single" | "multiple">("single");
  const [sourceMode, setSourceMode] = useState<"upload" | "link">("upload");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [fights, setFights] = useState<FightData[]>(() => {
    if (preFilledFights && preFilledFights.length > 0) {
      return preFilledFights.map(pf => ({
        id: pf.id, // Use the WarFight ID
        nodeId: String(pf.nodeId),
        attackerId: String(pf.attackerId),
        defenderId: String(pf.defenderId),
        prefightChampionIds: pf.prefightChampions.map(c => String(c.id)),
        death: pf.death,
        videoFile: null, // No video file initially
        battlegroup: pf.battlegroup ?? undefined,
      }));
    }
    return [
      {
        id: uuidv4(),
        nodeId: "",
        attackerId: "",
        defenderId: "",
        prefightChampionIds: [],
        death: false,
        videoFile: null,
      },
    ];
  });

  const [season, setSeason] = useState<string>(() => preFilledFights?.[0]?.war?.season?.toString() || "");
  const [warNumber, setWarNumber] = useState<string>(() => preFilledFights?.[0]?.war?.warNumber?.toString() || "");
  const [warTier, setWarTier] = useState<string>(() => preFilledFights?.[0]?.war?.warTier?.toString() || "");
  const [battlegroup, setBattlegroup] = useState<string>(() => {
    if (preFilledFights?.[0]?.battlegroup) {
      return preFilledFights[0].battlegroup.toString();
    }
    const defaultPlayer = initialPlayers.find(p => p.id === initialUserId);
    if (defaultPlayer?.battlegroup) {
      return defaultPlayer.battlegroup.toString();
    }
    return "";
  });
  const [playerInVideoId, setPlayerInVideoId] = useState<string>(() => preFilledFights?.[0]?.player?.id || initialUserId);
  const [visibility, setVisibility] = useState<"public" | "alliance">("public");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOffseason, setIsOffseason] = useState<boolean>(() => preFilledFights?.[0]?.war?.warNumber === null || preFilledFights?.[0]?.war?.warNumber === 0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentUpload, setCurrentUpload] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Effect to update offseason state if warNumber changes
  useEffect(() => {
    setIsOffseason(warNumber === "0" || warNumber === "");
  }, [warNumber]);

  // Effect to update battlegroup if playerInVideoId changes and not pre-filled
  useEffect(() => {
    if (!preFilledFights) { // Only update if not pre-filled
      const selectedPlayer = initialPlayers.find(p => p.id === playerInVideoId);
      if (selectedPlayer?.battlegroup) {
        setBattlegroup(selectedPlayer.battlegroup.toString());
      } else {
        setBattlegroup("");
      }
    }
  }, [playerInVideoId, initialPlayers, preFilledFights]);

  // Memoized derived data
  const prefightChampions = useMemo(() => {
    const champs = initialChampions.filter((champ) =>
      champ.abilities?.some((link) => link.ability.name === "Pre-Fight Ability")
    );
    // Sort logic: Magneto (House Of X) and Odin first, then alphabetical
    return champs.sort((a, b) => {
      const priorityNames = ["Magneto (House Of X)", "Odin"];
      const aPriority = priorityNames.indexOf(a.name);
      const bPriority = priorityNames.indexOf(b.name);

      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority; // Keep relative order of priority champs
      }
      if (aPriority !== -1) return -1; // a is priority, goes first
      if (bPriority !== -1) return 1; // b is priority, goes first
      
      return a.name.localeCompare(b.name); // Default alphabetical
    });
  }, [initialChampions]);

  const warNumberOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: `War ${i + 1}`,
      })),
    []
  );

  const warTierOptions = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        value: String(i + 1),
        label: `Tier ${i + 1}`,
      })),
    []
  );

  const battlegroupOptions = useMemo(
    () => [
      { value: '1', label: 'Battlegroup 1' },
      { value: '2', label: 'Battlegroup 2' },
      { value: '3', label: 'Battlegroup 3' },
    ],
    []
  );

  const playerOptions = useMemo(
    () =>
      initialPlayers.map((player) => ({
        value: player.id,
        label: player.ingameName,
      })),
    [initialPlayers]
  );

  const handleSourceModeChange = useCallback((value: "upload" | "link") => {
    setSourceMode(value);
  }, []);

  const handleUploadModeChange = useCallback((value: "single" | "multiple") => {
    setUploadMode(value);
  }, []);

  const handleVisibilityChange = useCallback((value: "public" | "alliance") => {
    setVisibility(value);
  }, []);

  const handleFightChange = useCallback((updatedFight: FightData) => {
    setFights((prevFights) =>
      prevFights.map((fight) =>
        fight.id === updatedFight.id ? updatedFight : fight
      )
    );
  }, []);

  const handleAddFight = useCallback(() => {
    setFights((prevFights) => [
      ...prevFights,
      {
        id: uuidv4(),
        nodeId: "",
        attackerId: "",
        defenderId: "",
        prefightChampionIds: [],
        death: false,
        videoFile: null,
      },
    ]);
  }, []);

  const handleRemoveFight = useCallback((fightId: string) => {
    setFights((prevFights) =>
      prevFights.filter((fight) => fight.id !== fightId)
    );
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (uploadMode === "single") {
      if (sourceMode === 'upload' && !videoFile) {
        newErrors.videoFile = "Video file is required.";
      } else if (sourceMode === 'link' && !videoUrl) {
        newErrors.videoUrl = "Video URL is required.";
      }
    }
    if (!season) newErrors.season = "Season is required.";
    if (!isOffseason && !warNumber)
      newErrors.warNumber = "War number is required.";
    if (!warTier) newErrors.warTier = "War tier is required.";
    if (!battlegroup) newErrors.battlegroup = "Battlegroup is required.";

    fights.forEach((fight) => {
      if (uploadMode === "multiple") {
        if (sourceMode === 'upload' && !fight.videoFile) {
          newErrors[`videoFile-${fight.id}`] = "Video file is required for each fight.";
        } else if (sourceMode === 'link' && !fight.videoUrl) {
          newErrors[`videoUrl-${fight.id}`] = "Video URL is required for each fight.";
        }
      }
      if (!fight.attackerId)
        newErrors[`attackerId-${fight.id}`] = "Attacker is required.";
      if (!fight.defenderId)
        newErrors[`defenderId-${fight.id}`] = "Defender is required.";
      if (!fight.nodeId)
        newErrors[`nodeId-${fight.id}`] = "War node is required.";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadVideo = useCallback(
    async (formData: FormData, fightIds: string[], title: string) => {
      if ('BackgroundFetchManager' in self) {
        const sw = await navigator.serviceWorker.ready;
        const fetchId = `upload-${fightIds.join('-')}-${Date.now()}`;

        const bgFetch = await sw.backgroundFetch.fetch(
          fetchId,
          ['/api/war-videos/upload'],
          {
            title: title,
            icons: [
              {
                sizes: '192x192',
                src: '/CereBro_logo_256.png',
                type: 'image/png',
              },
            ],
            downloadTotal:
              uploadMode === 'single'
                ? videoFile?.size ?? 0
                : fights.find((f) => fightIds.includes(f.id))?.videoFile?.size ?? 0,
          }
        );

        const response = await fetch('/api/war-videos/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Background-Fetch-Id': bgFetch.id,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed for fights ${fightIds.join(', ')}`);
        }

        return response.json();

      } else {
        // Fallback to XMLHttpRequest
        return new Promise<{ videoIds: string[] }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentCompleted = Math.round(
                (event.loaded * 100) / event.total
              );
              setUploadProgress(percentCompleted);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } catch (e) {
                reject(new Error('Invalid response from server'));
              }
            } else {
              let errorMessage = `Upload failed for fights ${fightIds.join(', ')}`;
              try {
                const errorData = JSON.parse(xhr.responseText);
                errorMessage = errorData.error || errorMessage;
                if (errorData.details) {
                  errorMessage += `: ${errorData.details}`;
                }
              } catch (e) {
                // If JSON parsing fails, use the raw response text if available
                if (xhr.responseText) {
                  errorMessage = xhr.responseText;
                }
              }
              reject(new Error(errorMessage));
            }
          };

          xhr.onerror = () => {
            reject(new Error(`Network error during upload for fights ${fightIds.join(', ')}`));
          };

          xhr.open('POST', '/api/war-videos/upload', true);
          xhr.send(formData);
        });
      }
    },
    [fights, uploadMode, videoFile]
  );

  const linkVideo = useCallback(
    async (body: object) => {
      const response = await fetch('/api/war-videos/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link video');
      }

      return response.json();
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm() || isSubmitting) return;
      setIsSubmitting(true);
      setUploadProgress(0);

      try {
        if (sourceMode === 'link') {
          // --- Handle URL Submission ---
          setCurrentUpload("Linking video...");
          const commonPayload = {
            token,
            visibility,
            description,
            playerId: playerInVideoId,
          };

          if (uploadMode === 'single') {
            if (preFilledFights) {
              const result = await linkVideo({
                ...commonPayload,
                videoUrl,
                fightUpdates: fights,
              });
              toast({ title: "Success!", description: "Video has been linked to all fights." });
              if (result.videoIds && result.videoIds.length > 0) {
                router.push(`/war-videos/${result.videoIds[0]}`);
              } else {
                router.push("/war-videos");
              }
            } else { // New: send full fight data for creation
              const result = await linkVideo({
                ...commonPayload,
                videoUrl,
                fights: fights, // send full objects
                season: season,
                warNumber: isOffseason ? null : warNumber,
                warTier: warTier,
                battlegroup: battlegroup,
              });
              toast({ title: "Success!", description: "Video has been linked to all fights." });
              if (result.videoIds && result.videoIds.length > 0) {
                router.push(`/war-videos/${result.videoIds[0]}`);
              } else {
                router.push("/war-videos");
              }
            }
          } else { // 'multiple' mode
            const allLinkedVideoIds = [];
            const commonPayload = { // Moved commonPayload outside the loop
              token,
              visibility,
              description,
              playerId: playerInVideoId,
            };

            for (let i = 0; i < fights.length; i++) {
              const fight = fights[i];
              setCurrentUpload(`Linking fight ${i + 1} of ${fights.length}...`);

              if (preFilledFights) {
                const result = await linkVideo({
                  ...commonPayload,
                  videoUrl: fight.videoUrl,
                  fightUpdates: [fight],
                });
                if (result.videoIds && result.videoIds.length > 0) {
                  allLinkedVideoIds.push(result.videoIds[0]);
                }
              } else {
                // New: send full fight data for creation
                const result = await linkVideo({
                  ...commonPayload,
                  videoUrl: fight.videoUrl,
                  fights: [fight], // send single fight
                  season: season,
                  warNumber: isOffseason ? null : warNumber,
                  warTier: warTier,
                  battlegroup: battlegroup,
                });
                if (result.videoIds && result.videoIds.length > 0) {
                  allLinkedVideoIds.push(result.videoIds[0]);
                }
              }
            }
            toast({ title: "Success!", description: "All videos have been linked." });
            if (allLinkedVideoIds.length > 0) {
              router.push(`/war-videos/${allLinkedVideoIds[0]}`);
            } else {
              router.push("/war-videos");
            }
          }
        } else {
          // --- Handle File Upload ---
          const useBackgroundFetch = 'BackgroundFetchManager' in self;
          const getTitle = (fight: FightData) => {
            const selectedAttacker = initialChampions.find((c) => String(c.id) === fight.attackerId);
            const selectedDefender = initialChampions.find((c) => String(c.id) === fight.defenderId);
            const selectedNode = initialNodes.find((n) => String(n.id) === fight.nodeId);
            const selectedPlayer = initialPlayers.find((p) => p.id === playerInVideoId);
            const attackerName = selectedAttacker?.name || "Unknown";
            const defenderName = selectedDefender?.name || "Unknown";
            const nodeNumber = selectedNode?.nodeNumber || "??";
            const playerName = selectedPlayer?.ingameName || "Unknown";
            return `MCOC AW: S${season} W${isOffseason ? "Offseason" : warNumber} T${warTier} - ${attackerName} vs ${defenderName} on Node ${nodeNumber} by ${playerName}`;
          };

          if (useBackgroundFetch) {
            toast({ title: "Upload Started", description: "Your video(s) are now uploading in the background. You can leave this page." });
          }

          if (uploadMode === "single") {
            setCurrentUpload("Uploading video...");
            const formData = new FormData();
            formData.append("token", token);
            formData.append("videoFile", videoFile!);
            formData.append("visibility", visibility);
            formData.append("description", description);
            if (playerInVideoId) formData.append("playerId", playerInVideoId);
            formData.append("title", getTitle(fights[0]));
            formData.append("mode", "single");

            if (preFilledFights) {
              formData.append("fightUpdates", JSON.stringify(fights));
            } else {
              formData.append("fights", JSON.stringify(fights));
              formData.append("season", season);
              if (!isOffseason) formData.append("warNumber", warNumber);
              formData.append("warTier", warTier);
              formData.append("battlegroup", battlegroup);
            }

            const result = await uploadVideo(formData, fights.map(f => f.id), getTitle(fights[0]));
            if (!useBackgroundFetch) {
              toast({ title: "Success!", description: "All fights have been submitted." });
              if (result.videoIds && result.videoIds.length > 0) {
                router.push(`/war-videos/${result.videoIds[0]}`);
              } else {
                router.push("/war-videos");
              }
            }
          } else { // 'multiple' mode
            const allUploadedVideoIds = [];
            for (let i = 0; i < fights.length; i++) {
              const fight = fights[i];
              setCurrentUpload(`Uploading fight ${i + 1} of ${fights.length}...`);
              setUploadProgress(0);
              const formData = new FormData();
              formData.append("token", token);
              formData.append("videoFile", fight.videoFile!);
              formData.append("visibility", visibility);
              formData.append("description", description);
              if (playerInVideoId) formData.append("playerId", playerInVideoId);
              formData.append("title", getTitle(fight));
              formData.append("mode", "multiple");

              if (preFilledFights) {
                formData.append("fightUpdates", JSON.stringify([fight]));
              } else {
                formData.append("fights", JSON.stringify([fight])); // send single fight
                formData.append("season", season);
                if (!isOffseason) formData.append("warNumber", warNumber);
                formData.append("warTier", warTier);
                formData.append("battlegroup", battlegroup);
              }

              const result = await uploadVideo(formData, [fight.id], getTitle(fight));
              if (result.videoIds && result.videoIds.length > 0) {
                allUploadedVideoIds.push(result.videoIds[0]);
              }
            }
            if (!useBackgroundFetch) {
              toast({ title: "Success!", description: "All videos have been uploaded." });
              if (allUploadedVideoIds.length > 0) {
                router.push(`/war-videos/${allUploadedVideoIds[0]}`);
              } else {
                router.push("/war-videos");
              }
            }
          }
          if (useBackgroundFetch) {
            router.push("/war-videos");
          }
        }
      } catch (error: any) {
        console.error("Submission error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        toast({
          title: "Upload Failed",
          description: error.message || "An unknown error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
        setCurrentUpload("");
      }
    },
    [
      token,
      videoFile,
      videoUrl,
      fights,
      season,
      warNumber,
      warTier,
      visibility,
      description,
      playerInVideoId,
      isSubmitting,
      router,
      toast,
      isOffseason,
      initialChampions,
      initialNodes,
      initialPlayers,
      uploadMode,
      sourceMode,
      uploadVideo,
      linkVideo,
      battlegroup,
    ]
  );

  const isSubmitDisabled = () => {
    if (isSubmitting || !token) return true;
    if (uploadMode === "single") {
      if (sourceMode === 'upload') return !videoFile;
      if (sourceMode === 'link') return !videoUrl;
    }
    if (uploadMode === "multiple") {
      if (sourceMode === 'upload') return fights.some((f) => !f.videoFile);
      if (sourceMode === 'link') return fights.some((f) => !f.videoUrl);
    }
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {/* Video Configuration Section */}
      <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-sky-400" />
          Video Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">Video Source</Label>
            <RadioGroup
              value={sourceMode}
              onValueChange={handleSourceModeChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upload" id="upload" />
                <Label htmlFor="upload" className="text-sm text-slate-300">Upload File</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link" id="link" />
                <Label htmlFor="link" className="text-sm text-slate-300">Use Link</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">Upload Mode</Label>
            <RadioGroup
              value={uploadMode}
              onValueChange={handleUploadModeChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="text-sm text-slate-300">Single Video (for all fights)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multiple" id="multiple" />
                <Label htmlFor="multiple" className="text-sm text-slate-300">Separate Video (for each fight)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      {uploadMode === "single" && (
        <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6">
          {sourceMode === 'upload' ? (
            <>
              <Label className="text-sm font-medium text-slate-300 mb-3 block">Video File</Label>
              <div className="flex items-center gap-4">
                <Label htmlFor="videoFile" className="cursor-pointer">
                  <div
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "flex items-center gap-2 bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-sky-500/50 transition-colors"
                    )}
                  >
                    <UploadCloud className="h-5 w-5" />
                    <span>Choose Video</span>
                  </div>
                </Label>
                <Input
                  id="videoFile"
                  type="file"
                  accept="video/*"
                  onChange={(e) =>
                    setVideoFile(e.target.files ? e.target.files[0] : null)
                  }
                  required
                  className="hidden"
                />
                {videoFile && (
                  <p className="text-sm text-slate-300">{videoFile.name}</p>
                )}
              </div>
              {errors.videoFile && (
                <p className="text-sm text-red-400 mt-2">{errors.videoFile}</p>
              )}
            </>
          ) : (
            <>
              <Label htmlFor="videoUrl" className="text-sm font-medium text-slate-300 mb-3 block">Video URL</Label>
              <Input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="bg-slate-900/50 border-slate-700/50"
              />
              {errors.videoUrl && (
                <p className="text-sm text-red-400 mt-2">{errors.videoUrl}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Fights Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Swords className="h-5 w-5 text-sky-400" />
          Fight Details
        </h3>
        {fights.map((fight) => (
          <FightBlock
            key={fight.id}
            fight={fight}
            onFightChange={handleFightChange}
            onRemove={handleRemoveFight}
            canRemove={fights.length > 1}
            initialChampions={initialChampions}
            initialNodes={initialNodes}
            prefightChampions={prefightChampions}
            uploadMode={uploadMode}
            sourceMode={sourceMode}
            errors={errors}
          />
        ))}
        <Button type="button" variant="outline" onClick={handleAddFight} className="w-full bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-sky-500/50 transition-colors">
          <Plus className="mr-2 h-4 w-4" />
          Add Another Fight
        </Button>
      </div>

      {/* War Details Section */}
      <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">War Details</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOffseason"
              checked={isOffseason}
              onCheckedChange={(checked) => setIsOffseason(Boolean(checked))}
            />
            <Label htmlFor="isOffseason" className="text-sm text-slate-300">Offseason</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="season" className="text-sm font-medium text-slate-300 mb-2 block">Season</Label>
            <Input
              id="season"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              required
              className="bg-slate-900/50 border-slate-700/50"
            />
            {errors.season && (
              <p className="text-sm text-red-400 mt-2">{errors.season}</p>
            )}
          </div>

          <div>
            <Label htmlFor="warNumber" className="text-sm font-medium text-slate-300 mb-2 block">War Number</Label>
            <MemoizedSelect
              value={warNumber}
              onValueChange={setWarNumber}
              placeholder="Select number..."
              options={warNumberOptions}
              required={!isOffseason}
              disabled={isOffseason}
              contentClassName="max-h-60 overflow-y-auto"
            />
            {errors.warNumber && (
              <p className="text-sm text-red-400 mt-2">{errors.warNumber}</p>
            )}
          </div>

          <div>
            <Label htmlFor="warTier" className="text-sm font-medium text-slate-300 mb-2 block">War Tier</Label>
            <MemoizedSelect
              value={warTier}
              onValueChange={setWarTier}
              placeholder="Select tier..."
              options={warTierOptions}
              required
              contentClassName="max-h-60 overflow-y-auto"
            />
            {errors.warTier && (
              <p className="text-sm text-red-400 mt-2">{errors.warTier}</p>
            )}
          </div>
          <div>
            <Label htmlFor="battlegroup" className="text-sm font-medium text-slate-300 mb-2 block">Battlegroup</Label>
            <MemoizedSelect
              value={battlegroup}
              onValueChange={setBattlegroup}
              placeholder="Select battlegroup..."
              options={battlegroupOptions}
              required
              disabled={!!preFilledFights}
            />
            {errors.battlegroup && (
              <p className="text-sm text-red-400 mt-2">{errors.battlegroup}</p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6 space-y-6">
        <div>
          <Label htmlFor="playerInVideo" className="text-sm font-medium text-slate-300 mb-2 block">Player in Video</Label>
          <MemoizedSelect
            value={playerInVideoId}
            onValueChange={setPlayerInVideoId}
            placeholder="Select player..."
            options={playerOptions}
          />
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-300 mb-2 block">Visibility</Label>
          <RadioGroup
            value={visibility}
            onValueChange={handleVisibilityChange}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="public" id="public" />
              <Label htmlFor="public" className="text-sm text-slate-300">Public</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="alliance" id="alliance" />
              <Label htmlFor="alliance" className="text-sm text-slate-300">Alliance Only</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium text-slate-300 mb-2 block">Video Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any relevant details about the fight, prefights used, etc."
            className="bg-slate-900/50 border-slate-700/50 min-h-[100px]"
          />
        </div>
      </div>

      {isSubmitting && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
          <Label className="text-xl font-semibold text-white mb-4">{currentUpload}</Label>
          <Progress value={uploadProgress} className="w-1/2 h-2" />
          <p className="text-sm text-slate-400 mt-4">{uploadProgress}% complete</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitDisabled()}
        className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all text-base py-6"
      >
        {isSubmitting ? "Uploading..." : "Upload Video(s)"}
      </Button>
    </form>
  );
}
