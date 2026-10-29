import { describe, expect, it } from 'vitest';
import { googleVisionConfigFromEnv } from './googleVisionConfig';
const credentials = { client_email: 'fixture@example.test', private_key: 'fixture', project_id: 'test' };
const env = { GOOGLE_CREDENTIALS_JSON: Buffer.from(JSON.stringify(credentials)).toString('base64') };
describe('web-safe Vision configuration', () => {
  it('requires no Discord, model-provider or spreadsheet credentials', () => {
    expect(googleVisionConfigFromEnv(env)).toMatchObject({ credentials, transport:'rest', timeoutMs:15000, retryDelayMs:100 });
  });
  it('retains transport and circuit overrides', () => {
    expect(googleVisionConfigFromEnv({...env,GOOGLE_VISION_TRANSPORT:'grpc',GOOGLE_VISION_TIMEOUT_MS:'4000'})).toMatchObject({transport:'grpc',timeoutMs:4000});
  });
  it('rejects missing credentials without including their contents', () => {
    expect(()=>googleVisionConfigFromEnv({GOOGLE_CREDENTIALS_JSON:'not-a-secret-to-print'})).toThrow(/not configured/);
    expect(()=>googleVisionConfigFromEnv({...env,GOOGLE_VISION_TIMEOUT_MS:'10abc'})).toThrow(/Invalid GOOGLE_VISION_TIMEOUT_MS/);
  });
});
