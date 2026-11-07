import snapshot from "./catalog.json"
import pieceArtwork from "./piece-artwork.json"
import { createChampionAcquisitionCatalog } from "../../domain/champion-acquisition"

// Keep the complete evidence catalog on the server; send one champion's records.
const catalog = createChampionAcquisitionCatalog(snapshot)
// A small generated projection of the shared reward manifest avoids loading the
// complete crystal/reward catalogs on every champion request.
const artworkByItem = new Map(pieceArtwork.assets.map(asset => [asset.itemId, asset.artworkUrl]))
export const getChampionAcquisition = (...args: Parameters<typeof catalog.forChampion>) => {
  const result = catalog.forChampion(...args)
  return { ...result, methods: result.methods.map(method => {
    if (!method.pieces) return method
    const pieces = method.pieces.map(piece => Object.freeze({ ...piece, artworkUrl: artworkByItem.get(piece.itemId) ?? null }))
    Object.freeze(pieces)
    return Object.freeze({ ...method, pieces })
  }) }
}
