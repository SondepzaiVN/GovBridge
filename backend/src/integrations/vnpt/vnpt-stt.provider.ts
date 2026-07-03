import { randomUUID } from 'node:crypto';
import { ConfigurationError, ExternalServiceError } from '../../common/errors/app-error.js';
import type { SttInput, SttProvider, SttResult } from '../../modules/speech/speech.types.js';
import { fetchVnpt } from './vnpt-http.js';
import { asRecord, stringValue } from './vnpt-response.js';

interface VnptSttConfig {
  url: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  timeoutMs: number;
}

const numberValue = (...values: unknown[]): number | null => {
  const value = values.find((item) => typeof item === 'number');
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const extensionFor = (file: Express.Multer.File): string => {
  const fromName = file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (file.mimetype.includes('mpeg') || file.mimetype.includes('mp3')) return 'mp3';
  if (file.mimetype.includes('wav')) return 'wav';
  if (file.mimetype.includes('pcm')) return 'pcm';
  return 'wav';
};

const authHeaders = (config: VnptSttConfig): Headers => {
  const headers = new Headers({ Accept: 'application/json' });
  if (config.accessToken) {
    const token = config.accessToken.replace(/^bearer\s+/i, '');
    headers.set('Authorization', 'Bearer ' + token);
  }
  if (config.tokenId) headers.set('Token-id', config.tokenId);
  if (config.tokenKey) headers.set('Token-key', config.tokenKey);
  return headers;
};

export class VnptSttProvider implements SttProvider {
  readonly name = 'vnpt' as const;

  constructor(private readonly config: VnptSttConfig) {
    if (!config.accessToken || !config.tokenId || !config.tokenKey) {
      throw new ConfigurationError('STT_PROVIDER=vnpt nhưng chưa cấu hình thông tin xác thực VNPT.');
    }
  }

  async transcribe(input: SttInput): Promise<SttResult> {
    const form = new FormData();
    const audioBytes = Uint8Array.from(input.file.buffer);
    const audioBlob = new Blob([audioBytes], {
      type: input.file.mimetype || 'audio/wav',
    });
    const clientSession = input.clientSession ?? `stt_${randomUUID()}`;
    const extension = extensionFor(input.file);

    form.append('audioFile', audioBlob, input.file.originalname || `recording.${extension}`);
    form.append('clientSession', clientSession);
    form.append('maxAlternatives', '1');
    form.append('audioChannelCount', '1');
    form.append('enableAutomaticPunctuation', 'true');
    form.append('verbatimTranscripts', 'false');
    if (extension !== 'wav') {
      form.append('customConfiguration', JSON.stringify({ convert_format: extension }));
    }

    const response = await fetchVnpt(this.config.url, {
      method: 'POST',
      headers: authHeaders(this.config),
      body: form,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('VNPT STT trả về HTTP ' + response.status + '.');

    const root = asRecord(payload);
    const object = asRecord(root.object);
    const status = stringValue(object.status, object.Status).toUpperCase();
    if (status && status !== 'OK') {
      throw new ExternalServiceError('VNPT STT chưa trả kết quả hoàn tất: ' + status + '.');
    }

    const results = Array.isArray(object.results) ? object.results : [];
    const firstResult = asRecord(results[0]);
    const alternatives = Array.isArray(firstResult.alternatives) ? firstResult.alternatives : [];
    const firstAlternative = asRecord(alternatives[0]);
    const transcript = stringValue(firstAlternative.transcript).trim();
    if (!transcript) throw new ExternalServiceError('VNPT STT không trả về transcript.');

    return {
      provider: this.name,
      transcript,
      confidence: numberValue(firstAlternative.confidence),
      audioDuration: numberValue(object.audio_duration, object.audioDuration),
    };
  }
}
