import { ConfigurationError, ExternalServiceError } from '../../common/errors/app-error.js';
import type { CCCDInfo, IdentityOcrProvider } from '../../modules/identity/identity.types.js';
import { fetchVnpt } from './vnpt-http.js';
import { asRecord, normalizeDate, stringValue } from './vnpt-response.js';

interface VnptOcrConfig {
  baseUrl: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  macAddress: string;
}

export class VnptOcrProvider implements IdentityOcrProvider {
  readonly name = 'vnpt' as const;

  constructor(private readonly config: VnptOcrConfig) {
    if (!config.accessToken || !config.tokenId || !config.tokenKey) {
      throw new ConfigurationError('OCR_PROVIDER=vnpt nhưng chưa cấu hình đủ thông tin VNPT eKYC.');
    }
  }

  async extractCccd(image: { buffer: Buffer; mimetype: string; filename: string }): Promise<CCCDInfo> {
    const hash = await this.upload(image);
    const response = await fetchVnpt(this.config.baseUrl + '/ai/v1/ocr/id', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        img_front: hash,
        client_session: 'GOV_BRIDGE_' + Date.now(),
        type: -1,
        validate_postcode: false,
        token: this.config.tokenId,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('VNPT eKYC trả về HTTP ' + response.status + '.');
    return this.parse(payload);
  }

  private async upload(image: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.filename);
    form.append('title', 'CCCD');
    form.append('description', 'Front image');

    const response = await fetchVnpt(this.config.baseUrl + '/file-service/v1/addFile', {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new ExternalServiceError('Không tải được ảnh lên VNPT eKYC.');
    const object = asRecord(asRecord(payload).object);
    const hash = stringValue(object.hash);
    if (!hash) throw new ExternalServiceError('VNPT eKYC không trả về mã ảnh hợp lệ.');
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

  private parse(payload: unknown): CCCDInfo {
    const root = asRecord(payload);
    const data = Array.isArray(root.data) ? asRecord(root.data[0]) : asRecord(root.data);
    const info = Object.keys(asRecord(root.object)).length > 0 ? asRecord(root.object) : data;
    return {
      id: stringValue(info.id, info.so_cmnd),
      hoTen: stringValue(info.name, info.ho_ten).toUpperCase(),
      ngaySinh: normalizeDate(stringValue(info.birth_day, info.ngay_sinh)),
      gioiTinh: stringValue(info.gender, info.gioi_tinh) || 'Nam',
      queQuan: stringValue(info.origin_location, info.que_quan),
      thuongTru: stringValue(info.recent_location, info.dia_chi),
      ngayCap: normalizeDate(stringValue(info.issue_date, info.ngay_cap)),
      noiCap: stringValue(info.issue_place, info.noi_cap),
    };
  }
}
