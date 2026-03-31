import { getRequestContext } from "./request-context";

const DISCORD_ERROR_WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL;

interface ErrorAlertOptions {
  error: unknown;
  message: string;
  extra?: Record<string, unknown>;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

export function sendErrorToDiscord(opts: ErrorAlertOptions): void {
  if (!DISCORD_ERROR_WEBHOOK_URL) return;

  const ctx = getRequestContext();
  const err =
    opts.error instanceof Error ? opts.error : new Error(String(opts.error));

  const fields = [
    { name: "Error", value: truncate(err.message, 1024), inline: false },
    {
      name: "Correlation ID",
      value: ctx?.correlationId ?? "N/A",
      inline: true,
    },
    {
      name: "User",
      value: ctx?.discordId ?? ctx?.userId ?? "anonymous",
      inline: true,
    },
    {
      name: "Path/Action",
      value: ctx?.path ?? ctx?.action ?? "N/A",
      inline: true,
    },
  ];

  if (err.stack) {
    fields.push({
      name: "Stack",
      value: truncate(err.stack, 1024),
      inline: false,
    });
  }

  if (opts.extra) {
    fields.push({
      name: "Extra",
      value: truncate(JSON.stringify(opts.extra, null, 2), 1024),
      inline: false,
    });
  }

  const embed = {
    title: truncate(`Error: ${opts.message}`, 256),
    color: 0xff0000,
    fields,
    timestamp: new Date().toISOString(),
  };

  // Fire-and-forget — alerting failures must not crash the app
  fetch(DISCORD_ERROR_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "CereBro Web Alerts",
      embeds: [embed],
    }),
  }).catch(() => {
    // Intentionally swallowed — we cannot import logger here (circular dep)
  });
}
