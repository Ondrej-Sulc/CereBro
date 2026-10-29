import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getRelicCatalog } from "@/lib/data/relics";
import { RelicCatalogBrowser } from "./relic-catalog-browser";
import { getPlayerRelicInventory } from "@/lib/data/player-relics";
import { getUserPlayerWithAlliance, getUserProfiles } from "@/lib/auth-helpers";
import { RelicInventoryProvider } from "@/components/relics/relic-inventory";
import { PlayerRelics } from "../profile/relics/player-relics";
import { CollectionScreen } from "@/components/collections/collection-navigation";
import {
  collectionPreferenceCookie,
  resolveCollectionView,
} from "@/lib/collection-view";

export const metadata: Metadata = {
  title: "Relics | CereBro",
  description:
    "Explore Battlecasts and Statcasts, or manage your own relic collection.",
};
export const dynamic = "force-dynamic";
export default async function RelicsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [data, player, session, params, preferences] = await Promise.all([
    getRelicCatalog(),
    getUserPlayerWithAlliance(),
    auth(),
    searchParams,
    cookies(),
  ]);
  const view = resolveCollectionView(
    params.view,
    preferences.get(collectionPreferenceCookie("relics"))?.value,
    !!player,
  );
  const screen = {
    section: "relics" as const,
    view,
    profileId: player?.id ?? "guest",
    signedIn: !!session?.user,
    canUsePersonal: !!player,
  };
  if (view === "catalog") {
    return (
      <CollectionScreen key={`catalog:${screen.profileId}`} {...screen}>
        <RelicCatalogBrowser data={data} />
      </CollectionScreen>
    );
  }
  const [inventory, profiles] = await Promise.all([
    getPlayerRelicInventory(),
    getUserProfiles(),
  ]);
  return (
    <CollectionScreen key={`personal:${screen.profileId}`} {...screen}>
      <RelicInventoryProvider
        key={inventory.profile!.id}
        initial={inventory}
        choices={data.families.flatMap((family) => family.variants)}
        attributeIcons={data.attributeIcons}
      >
        <PlayerRelics
          catalog={data}
          profiles={profiles.map((profile) => ({
            id: profile.id,
            name: profile.ingameName,
          }))}
        />
      </RelicInventoryProvider>
    </CollectionScreen>
  );
}
