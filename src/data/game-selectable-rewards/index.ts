import snapshot from "./catalog.json"
import { createSelectableRewardCatalog } from "../../domain/selectable-rewards"
import { rewardArtworkSource } from "../game-reward-artwork"

// Server-only; send the selected reward's presentation to the browser.
const catalog = createSelectableRewardCatalog(snapshot, rewardArtworkSource.openingCatalogSha256)
export const getSelectableReward = catalog.getSelectableReward
export const selectableRewardsSource = catalog.source
