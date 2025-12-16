"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWarVideoForm, UseWarVideoFormProps } from "./hooks/useWarVideoForm";
import { WarVideoHeader } from "./components/WarVideoHeader";
import { VideoInputSection } from "./components/VideoInputSection";
import { FightsList } from "./components/FightsList";
import { WarContextSection } from "./components/WarContextSection";
import { UploadOverlay } from "./components/UploadOverlay";

export function WarVideoForm(props: UseWarVideoFormProps) {
  const {
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

    // Handlers
    handleFightChange,
    handleAddFight,
    handleRemoveFight,
    handleSubmit,
  } = useWarVideoForm(props);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      <div className={cn("space-y-6", isSubmitting && "max-h-[calc(100vh-10rem)] overflow-y-auto")}>
        
        <WarVideoHeader
          uploadMode={uploadMode}
          setUploadMode={setUploadMode}
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          canUploadFiles={canUploadFiles}
        />

        <VideoInputSection
          uploadMode={uploadMode}
          sourceMode={sourceMode}
          videoFile={videoFile}
          setVideoFile={setVideoFile}
          videoUrl={videoUrl}
          setVideoUrl={setVideoUrl}
          errors={errors}
        />

        <FightsList
          fights={fights}
          onFightChange={handleFightChange}
          onRemoveFight={handleRemoveFight}
          onAddFight={handleAddFight}
          initialChampions={props.initialChampions}
          initialNodes={props.initialNodes}
          prefightChampions={prefightChampions}
          uploadMode={uploadMode}
          sourceMode={sourceMode}
          errors={errors}
        />

        <WarContextSection
          mapType={mapType}
          setMapType={setMapType}
          isOffseason={isOffseason}
          setIsOffseason={setIsOffseason}
          playerInVideoId={playerInVideoId}
          setPlayerInVideoId={setPlayerInVideoId}
          playerOptions={playerOptions}
          preFilledFights={props.preFilledFights}
          battlegroup={battlegroup}
          setBattlegroup={setBattlegroup}
          battlegroupOptions={battlegroupOptions}
          errors={errors}
          season={season}
          setSeason={setSeason}
          warNumber={warNumber}
          setWarNumber={setWarNumber}
          warNumberOptions={warNumberOptions}
          warTier={warTier}
          setWarTier={setWarTier}
          warTierOptions={warTierOptions}
          visibility={visibility}
          setVisibility={setVisibility}
          description={description}
          setDescription={setDescription}
        />
      </div>

      <UploadOverlay
        isSubmitting={isSubmitting}
        currentUpload={currentUpload}
        uploadProgress={uploadProgress}
      />

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
