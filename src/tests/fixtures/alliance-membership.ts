import { vi } from "vitest";

export type Member = {
  id: string;
  discordId: string;
  ingameName: string;
  allianceId: string | null;
  battlegroup: number | null;
  isOfficer: boolean;
  isPlanner: boolean;
};

type Placement = {
  id: string;
  planId: string;
  battlegroup: number;
  nodeId: number;
  playerId: string | null;
  defenderId: number | null;
  starLevel: number | null;
};

type State = {
  members: Member[];
  plans: { id: string; allianceId: string }[];
  placements: Placement[];
  wars: { id: string; status: "PLANNING" | "FINISHED"; allianceId: string }[];
  fights: { warId: string; playerId: string; death: number; defenderId: number }[];
  roster: { playerId: string; championId: number; rank: number }[];
};

type MemberWhere = Partial<Pick<Member, "id" | "allianceId" | "isOfficer">>;
type PlacementWhere = {
  id?: string;
  playerId?: string | null;
  planId_battlegroup_nodeId?: Pick<Placement, "planId" | "battlegroup" | "nodeId">;
};

/** Stateful database boundary: public actions operate on rows, with rollback on failure. */
export function createMembershipDatabase() {
  let state: State = { members: [], plans: [], placements: [], wars: [], fights: [], roster: [] };
  const matches = (member: Member, where: MemberWhere) =>
    Object.entries(where).every(([key, value]) => member[key as keyof Member] === value);
  const matchesPlacement = (placement: Placement, where: PlacementWhere) =>
    (where.id === undefined || placement.id === where.id) &&
    (where.playerId === undefined || placement.playerId === where.playerId) &&
    (!where.planId_battlegroup_nodeId || Object.entries(where.planId_battlegroup_nodeId)
      .every(([key, value]) => placement[key as keyof Placement] === value));
  const applyPlacementData = (placement: Placement, data: Partial<Placement>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) Object.assign(placement, { [key]: value });
    }
    return placement;
  };
  const warDefensePlan = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const plan = state.plans.find((entry) => entry.id === where.id);
      return plan ? { ...plan, alliance: { id: plan.allianceId } } : null;
    }),
  };

  const player = {
    findUnique: vi.fn(async ({ where }: { where: MemberWhere }) =>
      state.members.find((member) => matches(member, where)) ?? null),
    findFirst: vi.fn(async () => state.members.find((member) => member.id === "departing") ?? null),
    findMany: vi.fn(async () => state.members.filter((member) => member.allianceId === "alliance-1")),
    count: vi.fn(async ({ where }: { where: MemberWhere }) =>
      state.members.filter((member) => matches(member, where)).length),
    update: vi.fn(async ({ where, data }: { where: MemberWhere; data: Partial<Member> }) => {
      const member = state.members.find((entry) => matches(entry, where));
      if (!member) throw new Error("Player not found");
      Object.assign(member, data);
      return member;
    }),
  };
  const warDefensePlacement = {
    findUnique: vi.fn(async ({ where }: { where: PlacementWhere }) => {
      const placement = state.placements.find((entry) => matchesPlacement(entry, where));
      const plan = state.plans.find((entry) => entry.id === placement?.planId);
      return placement && plan ? { ...placement, plan: { ...plan, alliance: { id: plan.allianceId } } } : null;
    }),
    update: vi.fn(async ({ where, data }: { where: PlacementWhere; data: Partial<Placement> }) => {
      const placement = state.placements.find((entry) => matchesPlacement(entry, where));
      if (!placement) throw new Error("Placement changed. Refresh and try again.");
      return applyPlacementData(placement, data);
    }),
    upsert: vi.fn(async ({ where, update, create }: {
      where: PlacementWhere;
      update: Partial<Placement>;
      create: Pick<Placement, "planId" | "battlegroup" | "nodeId"> & Partial<Placement>;
    }) => {
      const placement = state.placements.find((entry) => matchesPlacement(entry, where));
      if (placement) return applyPlacementData(placement, update);
      if (state.placements.some((entry) => matchesPlacement(entry, { planId_battlegroup_nodeId: create }))) {
        throw new Error("Placement changed. Refresh and try again.");
      }
      const created: Placement = {
        id: "created-placement", ...create,
        playerId: create.playerId ?? null, defenderId: create.defenderId ?? null, starLevel: create.starLevel ?? null,
      };
      state.placements.push(created);
      return created;
    }),
    updateMany: vi.fn(async ({ where, data }: {
      where: { playerId: string; plan: { allianceId: string } };
      data: Partial<Placement>;
    }) => {
      const placements = state.placements.filter((placement) =>
        placement.playerId === where.playerId &&
        state.plans.some((plan) => plan.id === placement.planId && plan.allianceId === where.plan.allianceId));
      placements.forEach((placement) => Object.assign(placement, data));
      return { count: placements.length };
    }),
    findMany: vi.fn(async ({ where }: { where: { planId: string; battlegroup?: number } }) =>
      state.placements.filter((placement) => placement.planId === where.planId &&
        (where.battlegroup === undefined || placement.battlegroup === where.battlegroup))
        .map((placement) => ({
          ...placement,
          node: { nodeNumber: placement.nodeId },
          player: state.members.find((member) => member.id === placement.playerId) ?? null,
        }))),
  };
  const tx = {
    warNode: { findUnique: vi.fn(async ({ where }: { where: { id: number } }) => ({ id: where.id, nodeNumber: where.id })) },
    player, warDefensePlacement, warDefensePlan,
    $queryRaw: vi.fn(async (_query: TemplateStringsArray, playerId: string) =>
      state.members.filter((member) => member.id === playerId)
        .map(({ id, allianceId }) => ({ id, allianceId }))),
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      const previous = structuredClone(state);
      try {
        return await callback(tx);
      } catch (error) {
        state = previous;
        throw error;
      }
    }),
  };

  return {
    prisma,
    read: () => state,
    reset: () => {
      state = {
        members: [
          { id: "officer", discordId: "officer-discord", ingameName: "Officer", allianceId: "alliance-1", battlegroup: 1, isOfficer: true, isPlanner: false },
          { id: "departing", discordId: "departing-discord", ingameName: "Departing", allianceId: "alliance-1", battlegroup: 1, isOfficer: false, isPlanner: true },
        ],
        plans: [
          { id: "active-plan", allianceId: "alliance-1" },
          { id: "other-template", allianceId: "alliance-1" },
          { id: "other-alliance", allianceId: "alliance-2" },
        ],
        placements: [
          { id: "assigned", planId: "active-plan", battlegroup: 1, nodeId: 1, playerId: "departing", defenderId: 101, starLevel: 7 },
          { id: "reserved", planId: "active-plan", battlegroup: 2, nodeId: 2, playerId: "departing", defenderId: null, starLevel: null },
          { id: "template", planId: "other-template", battlegroup: 3, nodeId: 1, playerId: "departing", defenderId: 102, starLevel: 6 },
          { id: "teammate", planId: "active-plan", battlegroup: 1, nodeId: 3, playerId: "officer", defenderId: 103, starLevel: 7 },
          { id: "foreign", planId: "other-alliance", battlegroup: 1, nodeId: 1, playerId: "departing", defenderId: 104, starLevel: 7 },
          { id: "unowned", planId: "active-plan", battlegroup: 1, nodeId: 4, playerId: null, defenderId: 105, starLevel: 7 },
        ],
        wars: [
          { id: "completed-war", status: "FINISHED", allianceId: "alliance-1" },
          { id: "current-war", status: "PLANNING", allianceId: "alliance-1" },
          { id: "foreign-war", status: "FINISHED", allianceId: "alliance-2" },
        ],
        fights: [
          { warId: "completed-war", playerId: "departing", death: 2, defenderId: 101 },
          { warId: "current-war", playerId: "departing", death: 0, defenderId: 102 },
          { warId: "foreign-war", playerId: "departing", death: 1, defenderId: 103 },
        ],
        roster: [{ playerId: "departing", championId: 101, rank: 4 }],
      };
    },
  };
}
