import { ConfigurationError, ExternalServiceError } from '../../common/errors/app-error.js';
import type { DocumentReaderProvider, DocumentReaderResult } from '../../modules/document-review/document-review.types.js';
import { fetchVnpt } from './vnpt-http.js';
import { asRecord, stringValue } from './vnpt-response.js';

interface VnptSmartReaderConfig {
  baseUrl: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  macAddress: string;
  timeoutMs: number;
}

const fileTypeFromMime = (mimetype: string, filename: string): string => {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/jpeg') return 'jpg';
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'jpeg') return 'jpg';
  return extension || 'jpg';
};

const collectText = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) output.push(trimmed);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return output;
  }
  const record = asRecord(value);
  const text = stringValue(record.text);
  if (text.trim()) output.push(text.trim());
  if (Array.isArray(record.cells)) collectText(record.cells, output);
  return output;
};

const compactLines = (lines: string[]): string => {
  const deduped: string[] = [];
  for (const line of lines) {
    if (line && deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join('\n').slice(0, 30_000).trim();
};

export class VnptSmartReaderProvider implements DocumentReaderProvider {
  readonly name = 'vnpt-smartreader';

  constructor(private readonly config: VnptSmartReaderConfig) {
    if (!config.accessToken || !config.tokenId || !config.tokenKey) {
      throw new ConfigurationError('VNPT SmartReader chưa được cấu hình đủ access token, token id và token key.');
    }
  }

  async read(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<DocumentReaderResult> {
    const hash = await this.upload(file);
    const fileType = fileTypeFromMime(file.mimetype, file.filename);
    const response = await fetchVnpt(this.config.baseUrl + '/rpa-service/aidigdoc/v1/ocr/scan-table', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_hash: hash,
        token: this.config.tokenId,
        client_session: 'GOV_BRIDGE_DOC_' + Date.now(),
        file_type: fileType,
        details: false,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('VNPT SmartReader trả về HTTP ' + response.status + '.');

    const object = asRecord(asRecord(payload).object);
    const lines = collectText(object.lines);
    const paragraphs = collectText(object.paragraphs);
    const text = compactLines(lines.length > 0 ? lines : paragraphs);
    if (!text) throw new ExternalServiceError('VNPT SmartReader không trả về nội dung văn bản.');

    const warnings = [
      ...collectText(object.warning_messages),
      ...collectText(object.warnings),
    ].slice(0, 20);
    const pageCount = typeof object.num_of_pages === 'number' ? object.num_of_pages : null;

    return {
      text,
      warnings,
      pageCount,
      provider: this.name,
    };
  }

  private async upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.filename);
    form.append('title', 'GovBridge document review');
    form.append('description', 'Document submitted for CT01/rules review');

    const response = await fetchVnpt(this.config.baseUrl + '/file-service/v1/addFile', {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('Không tải được văn bản lên VNPT SmartReader.');
    const object = asRecord(asRecord(payload).object);
    const hash = stringValue(object.hash);
    if (!hash) throw new ExternalServiceError('VNPT SmartReader không trả về mã file hợp lệ.');
    return hash;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: this.config.accessToken,
      'Token-id': this.config.tokenId,
      'Token-key': this.config.tokenKey,
      'mac-address': this.config.macAddress,
      Accept: 'application/json',
    };
  }
}
