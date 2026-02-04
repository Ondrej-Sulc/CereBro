import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prismaService";

export type SectionKey = "s1" | "s2" | "s3";

export interface PlayerSectionState {
  done: boolean;
}

export interface AQState {
  channelId: string;
  messageId: string;
  threadId?: string;
  roleId: string | null;
  day: number;
  status: "active" | "ended" | "completed" | "ended_manual";
  mapStatus: string;
  players: Record<SectionKey, Record<string, PlayerSectionState>>;
  // timestamps are stored as ISO strings
  startTimeIso?: string;
  endTimeIso: string;
  slackerPingSent?: boolean;
  section2PingSent?: boolean;
  finalPingSent?: boolean;
  allianceId: string;
  minibossS1?: boolean;
  minibossS2?: boolean;
}

export async function getState(channelId: string): Promise<AQState | null> {
  const record = await prisma.aQState.findUnique({
    where: { channelId },
  });
  return record ? (record.state as unknown as AQState) : null;
}

export async function setState(
  channelId: string,
  state: AQState | undefined
): Promise<void> {
  if (state) {
    await prisma.aQState.upsert({
      where: { channelId },
      update: { state: state as unknown as Prisma.InputJsonValue },
      create: { channelId, state: state as unknown as Prisma.InputJsonValue },
    });
  } else {
    try {
      await prisma.aQState.delete({ where: { channelId } });
    } catch (e) {
      // Ignore if not found
    }
  }
}

export async function getAllStates(): Promise<AQState[]> {
  const records = await prisma.aQState.findMany();
  return records.map((r) => r.state as unknown as AQState);
}
