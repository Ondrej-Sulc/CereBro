export const CRYSTAL_AVAILABILITY_FILTERS = [
  { id: "all", label: "All availability" }, { id: "recurring", label: "Recurring pools" },
  { id: "current_event", label: "Current events" }, { id: "upcoming", label: "Upcoming" },
  { id: "past_event", label: "Past events" }, { id: "unverified", label: "Unverified" },
] as const
export type CrystalAvailabilityStatus = Exclude<typeof CRYSTAL_AVAILABILITY_FILTERS[number]["id"], "all">
export type CrystalAvailabilityFilter = CrystalAvailabilityStatus | "all"
export const crystalAvailabilityFilter = (value: string | undefined): CrystalAvailabilityFilter => CRYSTAL_AVAILABILITY_FILTERS.find(filter => filter.id === value)?.id ?? "all"
export const crystalAvailabilityLabel: Record<CrystalAvailabilityStatus, string> = {
  recurring: "Recurring pool", current_event: "Current event", upcoming: "Upcoming event", past_event: "Past event", unverified: "Availability unverified",
}
