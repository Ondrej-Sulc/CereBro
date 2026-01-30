import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { Champion } from "@/types/champion";
import { War, WarFight, Player as PrismaPlayer, WarNode as PrismaWarNode } from '@prisma/client';
import { FightData } from "@/components/FightBlock";

interface PlayerWithAlliance extends PrismaPlayer {
  alliance?: {
    canUploadFiles: boolean;
  } | null;
}

export interface PreFilledFight extends WarFight {
  war: War;
  player: PrismaPlayer;
  attacker: Champion;
  defender: Champion;
  node: PrismaWarNode;
  prefightChampions: Champion[];
}

export interface UseWarVideoFormProps {
  token: string;
  initialChampions: Champion[];
  initialNodes: PrismaWarNode[];
  initialPlayers: PlayerWithAlliance[];
  initialUserId: string;
  preFilledFights: PreFilledFight[] | null;
}

export function useWarVideoForm({
  token,
  initialChampions,
  initialNodes,
  initialPlayers,
  initialUserId,
  preFilledFights,
}: UseWarVideoFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [uploadMode, setUploadMode] = useState<"single" | "multiple">("single");
  const [sourceMode, setSourceMode] = useState<"upload" | "link">("link");
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
        death: 0,
        videoFile: null,
      },
    ];
  });

  const [season, setSeason] = useState<string>(() => preFilledFights?.[0]?.war?.season?.toString() || "");
  const [warNumber, setWarNumber] = useState<string>(() => preFilledFights?.[0]?.war?.warNumber?.toString() || "");
  const [warTier, setWarTier] = useState<string>(() => preFilledFights?.[0]?.war?.warTier?.toString() || "");
  const [mapType, setMapType] = useState<string>(() => preFilledFights?.[0]?.war?.mapType || "STANDARD");
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
  const [customPlayerName, setCustomPlayerName] = useState<string>(""); // New state for custom names
  const [visibility, setVisibility] = useState<"public" | "alliance">("public");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOffseason, setIsOffseason] = useState<boolean>(() => preFilledFights?.[0]?.war?.warNumber === null || preFilledFights?.[0]?.war?.warNumber === 0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentUpload, setCurrentUpload] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Wake Lock Ref
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const currentUser = useMemo(() => 
    initialPlayers.find(p => p.id === initialUserId), 
    [initialPlayers, initialUserId]
  );
  const canUploadFiles = !!currentUser?.alliance?.canUploadFiles;
  const isSolo = !currentUser?.alliance; // User has no alliance

  // Context Mode: 'alliance' (normal) or 'global' (external/solo upload)
  const [contextMode, setContextMode] = useState<"alliance" | "global">(() => isSolo ? "global" : "alliance");

  // Handle Player Selection (Existing or Custom)
  const handlePlayerChange = useCallback((value: string, isCustom: boolean) => {
    if (isCustom) {
        setCustomPlayerName(value);
        setPlayerInVideoId(""); // Clear ID if custom name used
    } else {
        setPlayerInVideoId(value);
        setCustomPlayerName(""); // Clear custom name if ID selected
    }
  }, []);

  // Wake Lock Helpers
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
      }
    } catch (err) {
      console.warn('Wake Lock release failed:', err);
    }
  };

  // Cleanup Wake Lock on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  // Effect to update offseason state if warNumber changes
  useEffect(() => {
    setIsOffseason(warNumber === "0" || warNumber === "");
  }, [warNumber]);

  // Effect to force link mode if not allowed to upload
  useEffect(() => {
    if ((!canUploadFiles || isSolo || contextMode === 'global') && sourceMode === 'upload') {
      setSourceMode('link');
    }
  }, [canUploadFiles, sourceMode, isSolo, contextMode]);

  // Effect to handle Solo/Global Mode defaults
  useEffect(() => {
    if (isSolo || contextMode === 'global') {
        setBattlegroup("0");
        setVisibility("public");
        setIsOffseason(true);
        setWarNumber("");
    } else {
        // Restore defaults if switching back to Alliance mode? 
        if (battlegroup === "0") {
             const defaultPlayer = initialPlayers.find(p => p.id === initialUserId);
             setBattlegroup(defaultPlayer?.battlegroup?.toString() || "");
        }
    }
  }, [isSolo, contextMode, initialPlayers, initialUserId, battlegroup]);

  // Effect to set default visibility based on source mode
  useEffect(() => {
    if (contextMode === 'alliance' && !isSolo) {
      if (sourceMode === 'upload') {
        setVisibility('alliance');
      } else {
        setVisibility('public');
      }
    }
  }, [sourceMode, contextMode, isSolo]);

  // Effect to update battlegroup if playerInVideoId changes and not pre-filled
  useEffect(() => {
    if (!preFilledFights && contextMode === 'alliance' && playerInVideoId) { 
      const selectedPlayer = initialPlayers.find(p => p.id === playerInVideoId);
      if (selectedPlayer?.battlegroup) {
        setBattlegroup(selectedPlayer.battlegroup.toString());
      } else {
        setBattlegroup("");
      }
    }
  }, [playerInVideoId, initialPlayers, preFilledFights, contextMode]);

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
        death: 0,
        videoFile: null,
      },
    ]);
  }, []);

  const handleRemoveFight = useCallback((fightId: string) => {
    setFights((prevFights) =>
      prevFights.filter((fight) => fight.id !== fightId)
    );
  }, []);

  const validateForm = useCallback(() => {
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
    // Only require battlegroup if in alliance mode
    if (!battlegroup && contextMode === 'alliance') newErrors.battlegroup = "Battlegroup is required.";

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
  }, [uploadMode, sourceMode, videoFile, videoUrl, season, isOffseason, warNumber, warTier, battlegroup, contextMode, fights]);

  const uploadVideo = useCallback(
    async (formData: FormData, fightIds: string[]) => {
      // Use XMLHttpRequest for consistent progress tracking across all browsers
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
            } catch {
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
            } catch {
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
    },
    []
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
      
      // Request Wake Lock to prevent screen sleep during upload
      await requestWakeLock();

      const isGlobal = contextMode === 'global';

      try {
        if (sourceMode === 'link') {
          // --- Handle URL Submission ---
          setCurrentUpload("Linking video...");
          const commonPayload = {
            token,
            visibility,
            description,
            playerId: playerInVideoId,
            customPlayerName: customPlayerName || undefined, // Send custom name if exists
            isGlobal, // Send flag
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
                mapType: mapType,
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
            const commonPayloadLoop = { // Moved commonPayload outside the loop, renamed to avoid shadow
              token,
              visibility,
              description,
              playerId: playerInVideoId,
              customPlayerName: customPlayerName || undefined,
              isGlobal,
            };

            for (let i = 0; i < fights.length; i++) {
              const fight = fights[i];
              setCurrentUpload(`Linking fight ${i + 1} of ${fights.length}...`);

              if (preFilledFights) {
                const result = await linkVideo({
                  ...commonPayloadLoop,
                  videoUrl: fight.videoUrl,
                  fightUpdates: [fight],
                });
                if (result.videoIds && result.videoIds.length > 0) {
                  allLinkedVideoIds.push(result.videoIds[0]);
                }
              } else {
                // New: send full fight data for creation
                const result = await linkVideo({
                  ...commonPayloadLoop,
                  videoUrl: fight.videoUrl,
                  fights: [fight], // send single fight
                  season: season,
                  warNumber: isOffseason ? null : warNumber,
                  warTier: warTier,
                  battlegroup: battlegroup,
                  mapType: mapType,
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
          const getTitle = (fight: FightData) => {
            const selectedAttacker = initialChampions.find((c) => String(c.id) === fight.attackerId);
            const selectedDefender = initialChampions.find((c) => String(c.id) === fight.defenderId);
            const selectedNode = initialNodes.find((n) => String(n.id) === fight.nodeId);
            const selectedPlayer = initialPlayers.find((p) => p.id === playerInVideoId);
            const attackerName = selectedAttacker?.name || "Unknown";
            const defenderName = selectedDefender?.name || "Unknown";
            const nodeNumber = selectedNode?.nodeNumber || "??";
            const playerName = selectedPlayer?.ingameName || customPlayerName || "Unknown"; // Use custom name
            return `MCOC AW: S${season} ${isOffseason ? "Offseason" : "W" + warNumber} T${warTier} - ${attackerName} vs ${defenderName} on Node ${nodeNumber} by ${playerName}`;
          };

          if (uploadMode === "single") {
            setCurrentUpload("Uploading video...");
            const formData = new FormData();
            formData.append("token", token);
            formData.append("videoFile", videoFile!);
            formData.append("visibility", visibility);
            formData.append("description", description);
            if (playerInVideoId) formData.append("playerId", playerInVideoId);
            if (customPlayerName) formData.append("customPlayerName", customPlayerName); // Append custom name
            if (isGlobal) formData.append("isGlobal", "true");
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
              formData.append("mapType", mapType);
            }

            const result = await uploadVideo(formData, fights.map(f => f.id));
            
            // Handle Direct Upload Result
            toast({ title: "Success!", description: "All fights have been submitted." });
            if (result.videoIds && result.videoIds.length > 0) {
              router.push(`/war-videos/${result.videoIds[0]}`);
            } else {
              router.push("/war-videos");
            }
          } else { // 'multiple' mode
            const allUploadedVideoIds: string[] = [];
            
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
              if (customPlayerName) formData.append("customPlayerName", customPlayerName);
              if (isGlobal) formData.append("isGlobal", "true");
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
                formData.append("mapType", mapType);
              }

              const result = await uploadVideo(formData, [fight.id]);
              
              if (result.videoIds && result.videoIds.length > 0) {
                allUploadedVideoIds.push(result.videoIds[0]);
              }
            }
            
            toast({ title: "Success!", description: "All videos have been uploaded." });
            if (allUploadedVideoIds.length > 0) {
              router.push(`/war-videos/${allUploadedVideoIds[0]}`);
            } else {
              router.push("/war-videos");
            }
          }
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error("Submission error:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        toast({
          title: "Upload Failed",
          description: err.message || "An unknown error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
        setCurrentUpload("");
        await releaseWakeLock();
      }
    },
    [
      validateForm,
      preFilledFights,
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
      customPlayerName, // Dependency
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
      mapType,
      contextMode, // Dependency
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
    return false;
  };

  return {
    // State
    uploadMode,
    setUploadMode,
    sourceMode,
    setSourceMode,
    videoFile,
    setVideoFile,
    videoUrl,
    setVideoUrl,
    fights,
    setFights,
    season,
    setSeason,
    warNumber,
    setWarNumber,
    warTier,
    setWarTier,
    mapType,
    setMapType,
    battlegroup,
    setBattlegroup,
    playerInVideoId,
    setPlayerInVideoId,
    customPlayerName, // Export
    setCustomPlayerName, // Export
    contextMode, // Export
    setContextMode, // Export
    visibility,
    setVisibility,
    description,
    setDescription,
    isSubmitting,
    uploadProgress,
    currentUpload,
    errors,
    isOffseason,
    setIsOffseason,
    
    // Computed
    canUploadFiles,
    prefightChampions,
    warNumberOptions,
    warTierOptions,
    battlegroupOptions,
    playerOptions,
    isSubmitDisabled,
    isSolo, // Export for UI checks

    // Handlers
    handleFightChange,
    handleAddFight,
    handleRemoveFight,
    handleSubmit,
    handlePlayerChange, // Export
  };
}