import type { NextRequest } from 'next/server';

export function sameRelicOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host') || req.nextUrl.host;
  const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || req.nextUrl.protocol.replace(':', '');
  const expected = `${protocol}://${host}`;
  return ['http', 'https'].includes(protocol) && URL.canParse(origin) && URL.canParse(expected) && new URL(origin).origin === new URL(expected).origin;
}

export async function boundedRelicBody(req: Request, limit: number) {
  if (Number(req.headers.get('content-length')) > limit) throw new RangeError('Upload is too large.');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new RangeError('Upload is too large.'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
