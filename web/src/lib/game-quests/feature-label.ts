import type { QuestMapFeatureLocation } from "./map-features";

export function questFeatureLocationLabel(location: QuestMapFeatureLocation): string {
  return [...location.gates.map(gate => gate.resolved ? gate.label : "Gate"),
    ...location.pickups.flatMap(pickup => pickup.rewards.map(reward => `${reward.name}${reward.amount ? ` ${reward.amount}` : ""}`)),
    ...(location.chests?.length ? [location.chests.length > 1 ? "Chests" : "Chest"] : [])].join(" · ");
}
