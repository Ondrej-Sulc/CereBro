/** Web OCR needs only Vision credentials/settings, not the Discord bot's entire environment. */
export function googleVisionConfigFromEnv(env: NodeJS.ProcessEnv) {
  let credentials: { client_email: string; private_key: string; project_id: string };
  try {
    const parsed: unknown = JSON.parse(Buffer.from(env.GOOGLE_CREDENTIALS_JSON ?? '', 'base64').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || !('client_email' in parsed) || typeof parsed.client_email !== 'string' ||
      !('private_key' in parsed) || typeof parsed.private_key !== 'string' || !('project_id' in parsed) || typeof parsed.project_id !== 'string' ||
      !parsed.client_email || !parsed.private_key || !parsed.project_id) throw new Error();
    credentials = { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id };
  } catch { throw new Error('Screenshot recognition is not configured. Contact the site administrator.'); }
  const integer = (key: string, fallback: number, min = 0) => {
    const raw = env[key] ?? String(fallback), value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min) throw new Error(`Invalid ${key} setting.`);
    return value;
  };
  const transport = (env.GOOGLE_VISION_TRANSPORT ?? 'rest').toLowerCase();
  if (transport !== 'rest' && transport !== 'grpc') throw new Error('Invalid GOOGLE_VISION_TRANSPORT setting.');
  return { credentials, transport: transport as 'rest' | 'grpc',
    timeoutMs: integer('GOOGLE_VISION_TIMEOUT_MS', 15000, 1),
    retryDelayMs: integer('GOOGLE_VISION_RETRY_DELAY_MS', 100),
    retryJitterMs: integer('GOOGLE_VISION_RETRY_JITTER_MS', 150),
    circuitBreakerFailureThreshold: integer('GOOGLE_VISION_CIRCUIT_FAILURE_THRESHOLD', 1, 1),
    circuitBreakerCooldownMs: integer('GOOGLE_VISION_CIRCUIT_COOLDOWN_MS', 30000, 1),
  };
}
