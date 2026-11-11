// Server-only: this additive offline projection never enters a client bundle.
// Family membership (including UI-component rules) is versioned in the generator,
// separately from query ranking.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ArtworkError, type ArtworkCard, type ArtworkDetail, type ArtworkFamily, type ArtworkFilters, type ArtworkIdentity, type DiscoveryCoverage, type EvidenceBasis } from "./contract";

interface DiscoveryAsset extends ArtworkCard {
  displayName: string; names: string[]; paths: string[]; locations: [string,string][];
  families: string[]; identities: ArtworkIdentity[]; hints: { family: string; rule: string }[];
}
interface Projection { version: number; inputs: Record<string,string>; assets: DiscoveryAsset[]; families: ArtworkFamily[]; coverage: DiscoveryCoverage }
interface SearchHit { asset: DiscoveryAsset; score: number; match?: ArtworkCard["match"] }
const compareNames = new Intl.Collator("en",{numeric:true,sensitivity:"base"}).compare;
const resultName = (hit: SearchHit) => hit.match && ["registry","native-id"].includes(hit.match.basis) ? hit.match.label : hit.asset.displayName;
export function normalizeArtworkQuery(value: string) {
  if (/^[a-f0-9]{8,64}$/iu.test(value.trim())) return value.trim().toLowerCase();
  return value.replace(/\biso[\s_-]*8\b/gi,"iso8").replace(/\bt(\d+)(bc|cc)\b/gi,(_match,tier:string,suffix:string)=>`t${tier}${suffix.toLowerCase()}`)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\bdr\b/g,"doctor");
}
function friendlyAliases(identity: ArtworkIdentity) {
  const name = normalizeArtworkQuery(identity.label);
  const tier = name.match(/\btier (\d+) (basic |science |cosmic |tech |skill |mutant |mystic )?catalyst\b/);
  const championWords=name.split(" ").filter(word=>!["the","of","and"].includes(word));
  const initials=identity.domain === "champion" && championWords.length>=3 && championWords.length<=5 ? [championWords.map(word=>word[0]).join("")] : [];
  return [...initials,...(tier ? [`t${tier[1]}${tier[2] === "basic " ? "bc" : "cc"}`, `t${tier[1]} ${tier[2] ?? ""}catalyst`] : [])];
}
function field(text: string, weight: number, label: string, basis: EvidenceBasis) {
  // Separate hashes before camel-case normalization splits uppercase cache keys.
  const hashes: string[] = (text.match(/\b[a-f0-9]{32,}\b/giu) ?? []).map(hash => hash.toLowerCase());
  const normal = normalizeArtworkQuery(text.replace(/\b[a-f0-9]{32,}\b/giu," "));
  return { normal, compact: normal.replace(/ /g,""), hashes, weight, label, basis };
}
export class ArtworkDiscovery {
  private readonly records;
  private readonly byId;
  private readonly results = new Map<string,SearchHit[]>();
  constructor(private readonly projection: Projection) {
    if (projection.version !== 1 || !Array.isArray(projection.assets) || new Set(projection.assets.map(a=>a.id)).size !== projection.assets.length || projection.assets.length > 100000) throw new Error("Unsupported discovery projection");
    this.records = projection.assets.map(asset => {
      const fields = [
        ...asset.identities.map(identity => field([identity.label,identity.id,...friendlyAliases(identity)].join(" "),(identity.basis === "registry" ? 110 : 100)+(identity.role === "full" ? 3 : 0),identity.label,identity.basis)),
        ...asset.identities.map(identity => field(identity.id,130,identity.label,identity.basis)),
        ...asset.names.map(name => field(name.replace(/\.[a-z0-9]+$/i,""),65,name,"native")),
        field(asset.paths.join(" "),8,"Native path / source alias","native"),
        field(asset.id,70,"Catalog asset ID","native"),
      ];
      // Exact display labels get a separate field so variants/aliases do not
      // dilute an exact friendly-name match into an alphabetical tie.
      for (const identity of asset.identities) fields.push(field(identity.label,125+(identity.role === "full" ? 3 : 0),identity.label,identity.basis));
      return { asset, fields, combined: fields.map(f=>f.normal).join(" ") };
    });
    this.byId = new Map(this.records.map(record=>[record.asset.id,record.asset]));
  }
  get total() { return this.records.length; }
  get families() { return this.projection.families; }
  get coverage() { return this.projection.coverage; }
  private toCard(asset: DiscoveryAsset, match?: ArtworkCard["match"]): ArtworkCard {
    const { id,kind,name,width,height,format,transparent,aliasCount,displayName,families } = asset;
    return { id,kind,name,width,height,format,transparent,aliasCount,displayName: match && ["registry","native-id"].includes(match.basis) ? match.label : displayName,families,match };
  }
  detail(id: string): Partial<ArtworkDetail> {
    const asset = this.byId.get(id);
    return asset ? { ...this.toCard(asset), identities: asset.identities.slice(0,64), identityCount: asset.identities.length, hints: asset.hints } : {};
  }
  search(filters: ArtworkFilters) {
    const query = normalizeArtworkQuery(filters.q);
    const compact = query.replace(/ /g,"");
    const hashPrefix = /^[a-f0-9]{8,64}$/u.test(query);
    const tokens = [...new Set(query.split(" ").filter(Boolean))].slice(0,24);
    const patterns = tokens.map(token=>new RegExp(`(?:^| )${token}`,"u"));
    const cacheKey=JSON.stringify([query,!!filters.q,filters.kind,filters.family,filters.evidence,filters.source,filters.category,filters.minWidth,filters.maxWidth,filters.minHeight,filters.maxHeight]);
    const cached=this.results.get(cacheKey);
    if(cached){this.results.delete(cacheKey);this.results.set(cacheKey,cached);return this.page(cached,filters);}
    const found: SearchHit[] = [];
    for (const { asset, fields, combined } of this.records) {
      if (filters.kind && asset.kind !== filters.kind || filters.family && !asset.families.includes(filters.family)) continue;
      if (asset.width < filters.minWidth || asset.height < filters.minHeight || asset.width > filters.maxWidth || asset.height > filters.maxHeight) continue;
      if (!asset.locations.some(([source,category])=>(!filters.source || source===filters.source) && (!filters.category || category===filters.category))) continue;
      if (filters.evidence === "hint" ? asset.identities.length > 0 : filters.evidence && !asset.identities.some(i=>i.basis===filters.evidence)) continue;
      if (filters.q && !tokens.length) continue;
      if (patterns.some(pattern=>!pattern.test(combined))) {
        // Compact phrase recovery joins punctuation/camel/underscore variants.
        // Short abbreviations must remain tokens: T5BC must not match DXT5|BC3.
        if (!((tokens.length>1 || compact.length>=5) && fields.some(f=>f.compact.includes(compact))) && !(hashPrefix && fields.some(f=>f.hashes.some(hash=>hash.startsWith(query))))) continue;
      }
      let score = 0;
      let match: ArtworkCard["match"];
      if (tokens.length) {
        for (const candidate of fields) {
          const hits = patterns.filter(pattern=>pattern.test(candidate.normal)).length;
          const full = (tokens.length>1 || compact.length>=5) && candidate.compact.includes(compact) || hashPrefix && candidate.hashes.some(hash=>hash.startsWith(query));
          const exact = candidate.compact === compact || hashPrefix && candidate.hashes.includes(query);
          const value = (full || hits === tokens.length) ? candidate.weight + (exact ? 180 : candidate.compact.startsWith(compact) ? 70 : 20) : hits ? candidate.weight * hits / tokens.length * .35 : 0;
          if (value > score) { score=value; match={label:candidate.label,basis:candidate.basis}; }
        }
        // Preserve matches spanning an identity and a source alias.
        if (!score) score=1;
      } else {
        score = asset.identities.some(i=>i.domain==="champion") ? 300 : asset.identities.length ? 250 : asset.families.includes("interface") ? 120 : asset.families.includes("materials") ? 50 : 90;
        const identity = asset.identities[0];
        if (identity) match={label:identity.label,basis:identity.basis};
        if (asset.identities.some(i=>i.role==="full")) score+=3;
      }
      if (asset.width < 32 || asset.height < 32) score-=5;
      found.push({asset,score,match});
    }
    found.sort((a,b)=>b.score-a.score || compareNames(resultName(a),resultName(b)) || a.asset.id.localeCompare(b.asset.id,"en"));
    this.results.set(cacheKey,found);
    if(this.results.size>8)this.results.delete(this.results.keys().next().value!);
    return this.page(found,filters);
  }
  private page(found: SearchHit[], filters: ArtworkFilters) {
    const total=found.length, page=Math.min(filters.page,Math.max(1,Math.ceil(total/filters.pageSize)));
    return { items:found.slice((page-1)*filters.pageSize,page*filters.pageSize).map(r=>this.toCard(r.asset,r.match)),total,page,pageSize:filters.pageSize,
      families:this.families,discovery:{status:"ready" as const,coverage:this.coverage} };
  }
}
let cached: { file: string; projection: Projection } | undefined;
export function loadArtworkDiscovery(catalog: string, total: number): ArtworkDiscovery | undefined {
  const explicit=process.env.GAME_ARTWORK_SEARCH_INDEX;
  const candidate=path.join(process.cwd(),"src/lib/game-artwork/generated/discovery-v1.json");
  const file=explicit || (existsSync(candidate) ? candidate : path.join(process.cwd(),"web/src/lib/game-artwork/generated/discovery-v1.json"));
  try {
    if (explicit && !path.isAbsolute(explicit)) throw new Error("Absolute sidecar path required");
    if (!cached || cached.file!==file) {
      if (statSync(file).size>32*1024*1024) throw new Error("Sidecar too large");
      const data=readFileSync(file);
      if (data.byteLength>32*1024*1024) throw new Error("Sidecar too large");
      cached={file,projection:JSON.parse(data.toString("utf8")) as Projection};
    }
    // One startup hash, never per request. A changed catalog cannot silently use
    // identities from another dataset; the original SQL reader remains available.
    if (statSync(catalog).size>256*1024*1024) return undefined;
    const hash=createHash("sha256").update(readFileSync(catalog)).digest("hex");
    if (cached.projection.inputs["catalog.sqlite"]!==hash || cached.projection.assets.length!==total) return undefined;
    return new ArtworkDiscovery(cached.projection);
  } catch { return undefined; }
}
export function requireDiscoveryFilter(filters: ArtworkFilters) {
  if (filters.family || filters.evidence) throw new ArtworkError(503,"Discovery metadata is unavailable for this library. Reset filters to browse native aliases.");
}
