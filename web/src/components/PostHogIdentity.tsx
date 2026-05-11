"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const LAST_IDENTIFIED_KEY = "cerebro.posthog.lastIdentified";
const isPostHogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
);

export type PostHogIdentityPayload = {
  distinctId: string;
  playerId: string;
  hasAlliance: boolean;
  isOfficer: boolean;
  isBotAdmin: boolean;
  permissionCount: number;
  alliance?: {
    id: string;
    name: string;
    tag: string | null;
  } | null;
};

type PostHogIdentityProps = {
  identity: PostHogIdentityPayload | null;
  appVersion: string;
};

export function PostHogIdentity({ identity, appVersion }: PostHogIdentityProps) {
  useEffect(() => {
    if (!isPostHogConfigured) return;

    posthog.register({ app_version: appVersion });

    if (!identity) {
      if (window.localStorage.getItem(LAST_IDENTIFIED_KEY)) {
        posthog.reset();
        window.localStorage.removeItem(LAST_IDENTIFIED_KEY);
      }
      return;
    }

    posthog.identify(identity.distinctId, {
      active_player_id: identity.playerId,
      has_alliance: identity.hasAlliance,
      is_officer: identity.isOfficer,
      is_bot_admin: identity.isBotAdmin,
      permission_count: identity.permissionCount,
    });

    if (identity.alliance) {
      posthog.group("alliance", identity.alliance.id, {
        name: identity.alliance.name,
        tag: identity.alliance.tag ?? undefined,
      });
    }

    window.localStorage.setItem(LAST_IDENTIFIED_KEY, identity.distinctId);
  }, [
    appVersion,
    identity?.alliance?.id,
    identity?.alliance?.name,
    identity?.alliance?.tag,
    identity?.distinctId,
    identity?.hasAlliance,
    identity?.isBotAdmin,
    identity?.isOfficer,
    identity?.permissionCount,
    identity?.playerId,
    identity,
  ]);

  return null;
}
