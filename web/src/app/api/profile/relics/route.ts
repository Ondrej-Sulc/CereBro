import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { withRouteContext } from "@/lib/with-request-context";
import logger from "@/lib/logger";
import {
  addPlayerRelic,
  updatePlayerRelic,
  removePlayerRelic,
  getPlayerRelicState,
  setPlayerRelicPrestigeSource,
  playerRelicBuildOptions,
  PlayerRelicError,
} from "@cerebro/core/services/playerRelicService";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function failure(error: unknown) {
  if (error instanceof PlayerRelicError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return json({ error: "Check the relic, rank and signature values." }, 400);
  logger.error({ error }, "Relic inventory request failed");
  return json({ error: "Could not save your relics. Please try again." }, 500);
}
function sameOrigin(req: NextRequest, origin: string) {
  // NextRequest.url can contain the internal bind address behind the deployment
  // proxy. Use the public host/protocol, as the app's trusted-proxy auth does.
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const protocol =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "");
  const expected = `${protocol}://${host}`;
  return (
    ["http", "https"].includes(protocol) &&
    URL.canParse(origin) &&
    URL.canParse(expected) &&
    new URL(origin).origin === new URL(expected).origin
  );
}
export const GET = withRouteContext(async (req: NextRequest) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player)
      return json({ error: "Sign in and select a game profile first." }, 401);
    const relicId = req.nextUrl.searchParams.get("relicId");
    if (relicId)
      return json({
        options: await playerRelicBuildOptions(
          prisma,
          z.string().min(1).max(160).parse(relicId),
        ),
      });
    return json({
      profile: { id: player.id, name: player.ingameName },
      ...await getPlayerRelicState(prisma, player.id),
    });
  } catch (error) {
    return failure(error);
  }
});
function mutate(method: "POST" | "PATCH" | "DELETE" | "PUT") {
  return withRouteContext(async (req: NextRequest) => {
    try {
      const player = await getUserPlayerWithAlliance();
      if (!player)
        return json({ error: "Sign in and select a game profile first." }, 401);
      const origin = req.headers.get("origin");
      if (origin && !sameOrigin(req, origin))
        return json({ error: "Invalid request origin." }, 403);
      if (!req.headers.get("content-type")?.includes("application/json"))
        return json({ error: "JSON request required." }, 415);
      const text = await req.text();
      if (text.length > 4096) return json({ error: "Request too large." }, 413);
      const { profileId, ...data } = z
        .object({ profileId: z.string().min(1) })
        .passthrough()
        .parse(JSON.parse(text));
      if (profileId !== player.id)
        return json(
          { error: "Your active profile changed. Refresh before saving." },
          409,
        );
      const preference = method === "PUT"
        ? await setPlayerRelicPrestigeSource(prisma, player.id, data) : null;
      const entry = method === "PUT" ? null :
        method === "POST"
          ? await addPlayerRelic(prisma, player.id, data)
          : method === "PATCH"
            ? await updatePlayerRelic(prisma, player.id, data)
            : await removePlayerRelic(prisma, player.id, data);
      revalidatePath("/profile/relics");
      revalidatePath("/relics", "layout");
      revalidatePath("/profile");
      revalidatePath(`/player/${player.id}`);
      const inventory = {
        profile: { id: player.id, name: player.ingameName },
        ...(preference ?? await getPlayerRelicState(prisma, player.id)),
      };
      return json({ entry: entry ?? null, inventory }, method === "POST" ? 201 : 200);
    } catch (error) {
      return failure(error);
    }
  });
}
export const POST = mutate("POST");
export const PATCH = mutate("PATCH");
export const DELETE = mutate("DELETE");
export const PUT = mutate("PUT");
