import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { parseFormData } from "@/lib/parseFormData";
import { withRouteContext } from "@/lib/with-request-context";
import { getWarVideoEditAccess } from "@/lib/war-video-edit-auth";
import {
  FightMismatchError,
  syncWarVideoEditedFights,
  queueVideoNotification,
} from "@/lib/api/submission-helpers";
import type { EditableFightInput } from "@/lib/api/submission-helpers";
import { getYouTubeService } from "@cerebro/core/services/youtubeService";
import { getYoutubeVideoId } from "@/lib/youtube";
import { WarMapType } from "@prisma/client";

type EditPayload = {
  videoUrl?: string;
  description?: string;
  visibility?: string;
  playerId?: string;
  customPlayerName?: string;
  isGlobal?: boolean | string;
  season?: string | number;
  warNumber?: string | number | null;
  warTier?: string | number;
  battlegroup?: string | number;
  mapType?: string;
  fights?: EditableFightInput[] | string;
};

export const PATCH = withRouteContext(async (
  req: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) => {
  const { videoId } = await context.params;
  let tempFilePath: string | null = null;

  try {
    const video = await prisma.warVideo.findUnique({
      where: { id: videoId },
      include: {
        submittedBy: { include: { alliance: true } },
        fights: { include: { war: true } },
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const access = await getWarVideoEditAccess(video.submittedById);
    if (!access.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";
    let payload: EditPayload;

    if (contentType.includes("multipart/form-data")) {
      const parsed = await parseFormData(req);
      tempFilePath = parsed.tempFilePath;
      payload = parsed.fields;
    } else {
      payload = await req.json();
    }

    const fights = parseFights(payload.fights);
    const parsedSeason = parseRequiredInt(payload.season, "season");
    const parsedWarNumber = parseNullableInt(payload.warNumber);
    const parsedWarTier = parseRequiredInt(payload.warTier, "warTier");
    const parsedBattlegroup = parseRequiredInt(payload.battlegroup, "battlegroup");
    const mapType: WarMapType = payload.mapType === "BIG_THING" ? "BIG_THING" : "STANDARD";
    const isGlobal = payload.isGlobal === true || payload.isGlobal === "true";
    const visibility = payload.visibility === "alliance" ? "alliance" : "public";
    const description = typeof payload.description === "string" ? payload.description : "";

    const canReplaceWithFile = access.isAdmin || !!video.submittedBy.alliance?.canUploadFiles;
    let nextUrl = typeof payload.videoUrl === "string" ? payload.videoUrl.trim() : video.url;
    let replacedVideoFile = false;
    let oldYoutubeIdToDelete: string | null = null;

    if (tempFilePath) {
      if (!canReplaceWithFile) {
        await cleanupTempFile(tempFilePath);
        tempFilePath = null;
        return NextResponse.json({ error: "Direct video upload is restricted to authorized alliances only." }, { status: 403 });
      }

      if (!existsSync(tempFilePath)) {
        tempFilePath = null;
        return NextResponse.json({ error: "No video file found" }, { status: 400 });
      }

      const youtube = getYouTubeService();
      const title = buildEditTitle({
        season: parsedSeason,
        warNumber: parsedWarNumber,
        warTier: parsedWarTier,
        firstFight: fights[0],
      });
      const youtubeVideoId = await youtube.uploadVideo(tempFilePath, title, description, "unlisted");
      if (!youtubeVideoId) throw new Error("YouTube upload failed");

      oldYoutubeIdToDelete = getYoutubeVideoId(video.url);
      nextUrl = youtube.getVideoUrl(youtubeVideoId);
      replacedVideoFile = true;
    } else if (!nextUrl) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 });
    }

    const syncResult = await syncWarVideoEditedFights(prisma, {
      videoId,
      allianceId: video.submittedBy.allianceId,
      season: parsedSeason,
      warNumber: parsedWarNumber,
      warTier: parsedWarTier,
      battlegroup: parsedBattlegroup,
      mapType,
      fights,
      playerId: typeof payload.playerId === "string" ? payload.playerId : video.submittedById,
      customPlayerName: typeof payload.customPlayerName === "string" ? payload.customPlayerName : undefined,
      isGlobal,
    });

    const oldUrl = video.url;
    await prisma.warVideo.update({
      where: { id: videoId },
      data: {
        url: nextUrl,
        description,
        visibility,
      },
    });

    if (replacedVideoFile && oldYoutubeIdToDelete) {
      try {
        await getYouTubeService().deleteVideo(oldYoutubeIdToDelete);
      } catch (error) {
        logger.error({ err: error, videoId, oldYoutubeIdToDelete }, "Failed to delete replaced YouTube video");
      }
    }

    const videoSourceChanged = nextUrl !== oldUrl;
    if (videoSourceChanged || syncResult.fightListChanged) {
      await queueVideoNotification(prisma, { videoId, title: "War Video Updated" });
    }

    await cleanupTempFile(tempFilePath);
    tempFilePath = null;

    return NextResponse.json({ message: "Video updated", videoIds: [videoId] }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ err, videoId }, "War video edit failed");

    await cleanupTempFile(tempFilePath);

    if (error instanceof FightMismatchError) {
      return NextResponse.json({
        error: "Fight details do not match this war",
        details: error.message,
      }, { status: 409 });
    }

    return NextResponse.json({ error: err.message || "Video update failed" }, { status: 500 });
  }
});

function parseFights(value: EditPayload["fights"]): EditableFightInput[] {
  const fights = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(fights) || fights.length === 0) {
    throw new Error("At least one fight is required");
  }
  return fights;
}

async function cleanupTempFile(tempFilePath: string | null) {
  if (tempFilePath && existsSync(tempFilePath)) {
    await fs.unlink(tempFilePath);
  }
}

function parseRequiredInt(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value || ""));
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseInt(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function buildEditTitle(params: {
  season: number;
  warNumber: number | null;
  warTier: number;
  firstFight: EditableFightInput;
}) {
  return `MCOC AW: S${params.season} ${params.warNumber ? `W${params.warNumber}` : "Offseason"} T${params.warTier} - Updated Video`;
}
