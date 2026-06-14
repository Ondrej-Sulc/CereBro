import type {
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";

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
  DOUBLE_ELIMINATION: "Players move to a lower bracket after one loss and are eliminated after the second loss.",
  SWISS: "Everyone plays a fixed number of rounds against players with similar records. Best for ranking a larger field.",
  SWISS_TOP_CUT: "Swiss rounds rank the field, then the top players advance to an elimination bracket.",
  ROUND_ROBIN: "Every player faces every other player. Clear and fair, but match count grows quickly.",
  LADDER: "Players climb by challenging nearby ranks. Best for longer-running flexible events.",
};

export const formatBadges: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Fast bracket",
  DOUBLE_ELIMINATION: "Second chance",
  SWISS: "Ranked rounds",
  SWISS_TOP_CUT: "Qualifier + playoff",
  ROUND_ROBIN: "Everyone plays",
  LADDER: "Long-running",
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
