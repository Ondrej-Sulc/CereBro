import { expect, it } from "vitest"
import { classifyCrystalCategory, crystalEditionLabel } from "./crystal-categories"

it.each([
  ["7_star_hero_shard_crystal", "7-STAR HERO CRYSTAL", [], true, "main"],
  ["6fh_v49_shard_crystal", "FEATURED 6-STAR HERO CRYSTAL", [], false, "featured"],
  ["6fh_cosmic_tech_dual_crystal", "6-STAR COSMIC TECH DUAL CRYSTAL", [], false, "classes"],
  ["7star_incursion_artifacts_crystal", "7-STAR INCURSIONS ARTIFACT CRYSTAL", [], false, "modes"],
  ["7star_loyalty_crystal", "7-STAR LOYALTY CRYSTAL", [], false, "modes"],
  ["login_crystal_3_4_star_apr26", "LOGIN CRYSTAL", ["hulk"], false, "calendar"],
  ["24hr_daily_conqueror_crystal_invisible", "DAILY CONQUEROR CRYSTAL", [], false, "calendar"],
  ["cfh_2014_champions_provenance_crystal", "CAVALIER PROVENANCE CRYSTAL", [], false, "collections"],
  ["gmfh_spiderman_dailybugle_crystal", "DAILY BUGLE CRYSTAL", ["spiderman"], false, "spotlight"],
  ["fh_ghostrider_cosmic_cosmic_regicide_crystal", "COSMIC REGICIDE CRYSTAL", ["ghostrider_cosmic"], false, "spotlight"],
  ["cfh_back_to_school_crystal", "CAVALIER BACK TO SCHOOL CRYSTAL", ["shangchi", "omegasentinel", "doctordoom"], false, "events"],
  ["meta_dec2025_anniversary_collector_crystal", "GALA COLLECTOR NEXUS CRYSTAL", ["punisher"], false, "events"],
  ["unrecognized", "UNRECOGNIZED CRYSTAL", [], false, "other"],
] as const)("categorizes %s without claiming live availability", (id, name, promotedChampionIds, isMainPool, expected) => {
  expect(classifyCrystalCategory({ id, name, promotedChampionIds, isMainPool })).toBe(expected)
})

it("labels recorded editions without presenting them as live rotations", () => {
  expect(crystalEditionLabel(["6fh_v49_shard_crystal"], "featured")).toBe("Pool v49")
  expect(crystalEditionLabel(["login_crystal_3_4_star_apr26"], "calendar")).toBe("Apr 2026")
  expect(crystalEditionLabel(["cfh_2014_champions_provenance_crystal"], "collections")).toBe("2014 collection")
  expect(crystalEditionLabel(["6fh_v48_shard_crystal", "6fh_v49_shard_crystal"], "featured")).toBe("2 recorded editions")
  expect(crystalEditionLabel(["unrecognized"], "other")).toBeNull()
})
