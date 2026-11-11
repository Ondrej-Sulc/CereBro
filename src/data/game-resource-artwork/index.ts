import sp from "./sp.json";

// ResourceRedeemerMapping.GetTexture has a direct default-tag `sp` branch.
// This is artwork evidence only: the native localized resource name is unknown.
if (sp.version !== 1 || sp.type !== "res" || sp.data !== "sp" || sp.reference !== "summonerlevelup/iconSkillPoints" ||
    sp.sha256 !== "af59c73ef3abdf9fc8e156c7a45795381f2de6ae0339d19cb614aeb35bb299b8" ||
    sp.source.binding.blobSha256 !== sp.sha256 || sp.url !== `/game-rewards/resources/${sp.sha256}.png`) {
  throw new Error("Unbound static resource artwork");
}
const asset = Object.freeze({ url: sp.url, sha256: sp.sha256, reference: sp.reference });

export function getStaticResourceRewardArtwork(type: string, data: string) {
  return type === "res" && data === "sp" ? asset : undefined;
}
