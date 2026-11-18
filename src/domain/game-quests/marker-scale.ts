export type QuestMarkerFootprint = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Radius of the complete, unscaled visual footprint in board coordinates. */
  readonly radius: number;
  /** Desired screen-space radius; defaults to 24 pixels. */
  readonly preferredRadius?: number;
};

const TARGET_SCREEN_RADIUS = 24;
// Very large maps can fit below 15% on phones; spacing and edge caps still win.
const MAX_SCALE = 6;
const FOOTPRINT_GAP = 6;

/**
 * Enlarges important map markers without changing their source positions.
 * Pass one complete footprint per location; transit points need not participate.
 * A larger preferredRadius lets wide gate labels grow with their artwork.
 * Existing overlaps or clipping remain at their base size, never shrink.
 */
export function questMarkerScales(
  markers: readonly QuestMarkerFootprint[],
  zoom: number,
  bounds: { readonly width: number; readonly height: number },
): Map<string, number> {
  if (!Number.isFinite(zoom) || zoom <= 0 ||
      !Number.isFinite(bounds.width) || bounds.width <= 0 ||
      !Number.isFinite(bounds.height) || bounds.height <= 0) {
    return new Map(markers.map(marker => [marker.id, 1]));
  }

  const footprints = markers.map(marker => {
    const valid = Number.isFinite(marker.x) && Number.isFinite(marker.y) && Number.isFinite(marker.radius) && marker.radius > 0;
    if (!valid) return { marker, valid, desiredExpansion: 0, expansion: 0 };
    const preferredRadius = marker.preferredRadius !== undefined && Number.isFinite(marker.preferredRadius) && marker.preferredRadius > 0
      ? marker.preferredRadius : TARGET_SCREEN_RADIUS;
    const desiredScale = Math.max(1, Math.min(MAX_SCALE, preferredRadius / zoom / marker.radius));
    const edgeDistance = Math.min(marker.x, marker.y, bounds.width - marker.x, bounds.height - marker.y);
    const desiredExpansion = Math.min(marker.radius * (desiredScale - 1), Math.max(0, edgeDistance - marker.radius - FOOTPRINT_GAP));
    return { marker, valid, desiredExpansion, expansion: desiredExpansion };
  });

  for (let index = 0; index < footprints.length; index++) {
    const a = footprints[index];
    if (!a.valid) continue;
    for (let otherIndex = index + 1; otherIndex < footprints.length; otherIndex++) {
      const b = footprints[otherIndex];
      if (!b.valid) continue;
      const desiredExpansion = a.desiredExpansion + b.desiredExpansion;
      if (desiredExpansion <= 0) continue;
      const distance = Math.hypot(a.marker.x - b.marker.x, a.marker.y - b.marker.y);
      const availableExpansion = Math.max(0, distance - a.marker.radius - b.marker.radius - FOOTPRINT_GAP);
      if (availableExpansion >= desiredExpansion) continue;

      // Allocate only spare room, preserving both base footprints. Use immutable
      // targets so a third neighbor or input ordering cannot bias the pair.
      const share = availableExpansion / desiredExpansion;
      a.expansion = Math.min(a.expansion, a.desiredExpansion * share);
      b.expansion = Math.min(b.expansion, b.desiredExpansion * share);
    }
  }

  const scales = new Map<string, number>();
  for (const { marker, valid, expansion } of footprints) {
    const scale = valid ? Math.min(MAX_SCALE, 1 + expansion / marker.radius) : 1;
    scales.set(marker.id, Math.min(scales.get(marker.id) ?? MAX_SCALE, scale));
  }
  return scales;
}
