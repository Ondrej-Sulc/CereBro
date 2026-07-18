import {
  BattlegroundsTournamentFormat,
  type BattlegroundsMatchStatus,
  type BattlegroundsTournamentScope,
  type BattlegroundsTournamentStatus,
  type TournamentParticipantStatus,
} from "@prisma/client";

export const supportedTournamentFormats: readonly BattlegroundsTournamentFormat[] = [
  BattlegroundsTournamentFormat.SINGLE_ELIMINATION,
  BattlegroundsTournamentFormat.DOUBLE_ELIMINATION,
];

export function isSupportedTournamentFormat(
  value: string
): value is BattlegroundsTournamentFormat {
  return supportedTournamentFormats.some((format) => format === value);
}

export const statusLabels: Record<BattlegroundsTournamentStatus, string> = {
  DRAFT: "Draft",
  REGISTRATION: "Registration",
  CHECK_IN: "Check-in",
  LIVE: "Live",
  FINISHED: "Finished",
  ARCHIVED: "Archived",
};

export const formatLabels: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Single Elim",
  DOUBLE_ELIMINATION: "Double Elim",
  SWISS: "Swiss",
  SWISS_TOP_CUT: "Swiss + Top Cut",
  ROUND_ROBIN: "Round Robin",
  LADDER: "Ladder",
};

export const formatDescriptions: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Lose once and you are out. Fastest option for small one-night brackets.",
  DOUBLE_ELIMINATION: "Players drop into a losers bracket after their first loss. Lose twice and you are out.",
  SWISS: "Manual pairing for now. Intended for fixed rounds against players with similar records.",
  SWISS_TOP_CUT: "Manual pairing for now. Intended for Swiss rounds followed by an elimination playoff.",
  ROUND_ROBIN: "Every player faces every other player. Clear and fair, but match count grows quickly.",
  LADDER: "Manual pairing for now. Intended for longer-running events where players challenge nearby ranks.",
};

export const formatBadges: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Auto bracket",
  DOUBLE_ELIMINATION: "Auto bracket",
  SWISS: "Manual pairing",
  SWISS_TOP_CUT: "Manual pairing",
  ROUND_ROBIN: "Auto schedule",
  LADDER: "Manual pairing",
};

export const scopeLabels: Record<BattlegroundsTournamentScope, string> = {
  COMMUNITY: "Open tournament",
  ALLIANCE: "Alliance only",
};

export const scopeDescriptions: Record<BattlegroundsTournamentScope, string> = {
  COMMUNITY: "Any CereBro player can join while registration is open.",
  ALLIANCE: "Only members from your alliance can enter.",
};

export const participantLabels: Record<TournamentParticipantStatus, string> = {
  INVITED: "Invited",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  DROPPED: "Dropped",
};

export const matchStatusLabels: Record<BattlegroundsMatchStatus, string> = {
  PENDING: "Pending",
  READY: "Ready",
  PLAYING: "Playing",
  REPORTED: "Reported",
  DISPUTED: "Disputed",
  FINAL: "Final",
};
