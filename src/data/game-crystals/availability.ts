import snapshot from "./availability-catalog.json"
import { createCrystalAvailability } from "../../domain/crystal-availability"

const availability = createCrystalAvailability(snapshot)
export const getCrystalAvailability = availability.forSource
export const reviewedCrystalAvailabilityIds = availability.reviewedSourceIds

export type CrystalAvailabilityReview = {
  title: string
  description: string
  reviewedAt: string
  standardCrystalId: string
}

// Exact editorial exceptions to acquisition recommendations. A static reward
// definition alone does not prove player access; do not infer this from names,
// event timestamps, multipliers or other metadata shared by legitimate crystals.
const reviews: Readonly<Record<string, Readonly<CrystalAvailabilityReview> | undefined>> = Object.freeze({
  jessies_crystal: Object.freeze({
    title: "Player availability unverified",
    description: "This recorded definition shares the standard 7-Star Hero Crystal's name and artwork but has a different reward pool. No player-accessible source has been verified, so it is excluded from champion acquisition recommendations.",
    reviewedAt: "2026-11-06",
    standardCrystalId: "7_star_hero_shard_crystal",
  }),
})

export const getCrystalAvailabilityReview = (sourceIds: readonly string[]) => sourceIds.map(id => Object.hasOwn(reviews, id) ? reviews[id] : undefined).find(Boolean) ?? null
export const isCrystalAcquisitionSource = (id: string) => !Object.hasOwn(reviews, id)
