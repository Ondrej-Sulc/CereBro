"use client";

import { PlayCircle, X, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import type { EncounterWithRelations } from "../types";

export type EncounterVideoGuide = {
    videoUrl: string;
    player?: { ingameName: string | null; avatar?: string | null } | null;
};

type EncounterWithVideoGuides = EncounterWithRelations & {
    videos?: EncounterVideoGuide[];
};

export function getEncounterVideos(encounter: EncounterWithRelations): EncounterVideoGuide[] {
    return (encounter as EncounterWithVideoGuides).videos ?? [];
}

export function EncounterVideoGuides({
    encounter,
    showVideoId,
    setShowVideoId,
}: {
    encounter: EncounterWithRelations;
    showVideoId: string | null;
    setShowVideoId: (id: string | null) => void;
}) {
    const hasVideos = getEncounterVideos(encounter).length > 0 || Boolean(encounter.videoUrl);
    if (!hasVideos) return null;

    const activeVideoUrl = showVideoId?.startsWith(encounter.id + "|")
        ? showVideoId.split("|").slice(1).join("|")
        : null;

    return (
        <div className="flex flex-col gap-2">
            {activeVideoUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl">
                    {(() => {
                        const embedUrl = getYoutubeEmbedUrl(activeVideoUrl);
                        if (embedUrl) {
                            return (
                                <iframe
                                    src={embedUrl}
                                    title="YouTube video player"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="absolute inset-0 h-full w-full border-0"
                                />
                            );
                        }
                        return <div className="p-8 text-center text-slate-500">Invalid video URL</div>;
                    })()}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 z-50 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80"
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowVideoId(null);
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {!activeVideoUrl && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-900/30 bg-red-950/20 px-2 py-1.5">
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Video Guides</span>
                    </div>

                    {getAllEncounterVideos(encounter).map((video, index) => (
                        <button
                            key={index}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 transition-all hover:border-slate-600 hover:bg-slate-800 group/video"
                            onClick={(event) => {
                                event.stopPropagation();
                                setShowVideoId(`${encounter.id}|${video.videoUrl}`);
                            }}
                        >
                            <PlayCircle className="h-4 w-4 text-red-500/70 group-hover/video:text-red-500" />
                            {video.player?.avatar && <img src={video.player.avatar} alt={video.player.ingameName ?? "Player"} className="h-4 w-4 rounded-full" />}
                            <span className="text-xs font-medium text-slate-300 group-hover/video:text-white">{video.player?.ingameName || "Strategy Guide"}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function getAllEncounterVideos(encounter: EncounterWithRelations): EncounterVideoGuide[] {
    const allVideos = [...getEncounterVideos(encounter)];
    if (encounter.videoUrl && !allVideos.some(video => video.videoUrl === encounter.videoUrl)) {
        allVideos.push({ videoUrl: encounter.videoUrl, player: { ingameName: "Strategy Guide" } });
    }
    return allVideos;
}
