import { ConfigurationError, ExternalServiceError } from '../../common/errors/app-error.js';
import type { TtsInput, TtsProvider, TtsResult } from '../../modules/speech/speech.types.js';
import { fetchVnpt } from './vnpt-http.js';
import { asRecord, stringValue } from './vnpt-response.js';

interface VnptTtsConfig {
  url: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
}

export class VnptTtsProvider implements TtsProvider {
  readonly name = 'vnpt' as const;

  constructor(private readonly config: VnptTtsConfig) {
    if (!config.accessToken && (!config.tokenId || !config.tokenKey)) {
      throw new ConfigurationError('TTS_PROVIDER=vnpt nhưng chưa cấu hình thông tin xác thực VNPT.');
    }
  }

  async synthesize(input: TtsInput): Promise<TtsResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.config.accessToken) {
      const token = this.config.accessToken.replace(/^bearer\s+/i, '');
      headers.Authorization = 'Bearer ' + token;
    }
    if (this.config.tokenId) headers['token-id'] = this.config.tokenId;
    if (this.config.tokenKey) headers['token-key'] = this.config.tokenKey;

    const response = await fetchVnpt(this.config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: input.text,
        speed: String(input.speed),
        region: input.voice,
        domain: input.domain,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('VNPT TTS trả về HTTP ' + response.status + '.');

    const root = asRecord(payload);
    const object = asRecord(root.object);
    const playlist = Array.isArray(object.playlist) ? object.playlist : [];
    const firstTrack = asRecord(playlist[0]);
    const data = asRecord(root.data);
    const audioUrl = stringValue(firstTrack.audio_link, root.audio_link, data.audio_link, root.data);
    if (!audioUrl) throw new ExternalServiceError('VNPT TTS không trả về đường dẫn âm thanh.');

    return { provider: this.name, audioUrl, useBrowserFallback: false };
  }
}
