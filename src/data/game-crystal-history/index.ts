import snapshot from "./history.json"
import { createCrystalHistory } from "../../domain/crystal-history"

const history = createCrystalHistory(snapshot)

export const getCrystalHistory = history.getCrystalHistory
export const crystalHistoryObservations = history.observations
export const crystalHistoryChangeScope = history.changeScope
