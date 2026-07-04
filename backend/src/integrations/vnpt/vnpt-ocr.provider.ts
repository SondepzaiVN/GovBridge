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
  authUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

const formatVnptError = (payload: unknown): string => {
  const root = asRecord(payload);
  const error = asRecord(root.error);
  const messageFields = Array.isArray(root.messageFields)
    ? root.messageFields
        .map((item) => {
          const field = asRecord(item);
          const fieldName = stringValue(field.fieldName);
          const fieldMessage = stringValue(field.message);
          return [fieldName, fieldMessage].filter(Boolean).join(':');
        })
        .filter(Boolean)
        .join('; ')
    : '';
  const errors = Array.isArray(root.errors)
    ? root.errors.filter((item) => typeof item === 'string').join('; ')
    : '';
  const message = stringValue(
    root.message,
    errors,
    messageFields,
    root.error_description,
    root.description,
    error.message,
    error.error_description,
    error.description,
  );
  const code = stringValue(root.code, root.error, error.code);
  const parts = [
    code ? 'code=' + code : '',
    message ? 'message=' + message : '',
  ].filter(Boolean);
  return parts.length > 0 ? ' (' + parts.join(', ') + ').' : '.';
};

export class VnptOcrProvider implements IdentityOcrProvider {
  readonly name = 'vnpt' as const;
  private cachedAuthorization: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: VnptOcrConfig) {
    const hasStaticAccessToken = Boolean(config.accessToken.trim());
    const hasClientCredentials = Boolean(config.clientId?.trim() && config.clientSecret?.trim());
    if (!hasStaticAccessToken && !hasClientCredentials) {
      throw new ConfigurationError('OCR_PROVIDER=vnpt nhưng chưa cấu hình đủ thông tin VNPT eKYC.');
    }
  }

  async extractCccd(image: { buffer: Buffer; mimetype: string; filename: string }): Promise<CCCDInfo> {
    const hash = await this.upload(image);
    const tokenId = this.config.tokenId.trim();
    const clientSession = 'WEB_govbridge_web_Browser_1.0_GOVBRIDGE_' + Date.now();
    const body = {
      img_front: hash,
      client_session: clientSession,
      type: -1,
      validate_postcode: false,
      crop_param: '0.0,0.0',
      ...(tokenId ? { token: tokenId } : {}),
    };
    let response = await this.callOcr(body);

    let payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok && response.status === 400) {
      response = await this.callOcr({
        img_front: hash,
        img_back: '',
        client_session: clientSession,
        type: -1,
        validate_postcode: false,
        crop_param: '0.0,0.0',
        ...(tokenId ? { token: tokenId } : {}),
      });
      payload = await response.json().catch(() => ({}));
    }
    if (!response.ok) {
      throw new ExternalServiceError('VNPT eKYC trả về HTTP ' + response.status + formatVnptError(payload) + this.configHint());
    }
    return this.parse(payload);
  }

  private async callOcr(body: Record<string, unknown>): Promise<Response> {
    let response = await fetchVnpt(this.config.baseUrl + '/ai/v1/web/ocr/id', {
      method: 'POST',
      headers: { ...await this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (this.shouldRefreshAuthorization(response)) {
      this.cachedAuthorization = null;
      response = await fetchVnpt(this.config.baseUrl + '/ai/v1/web/ocr/id', {
        method: 'POST',
        headers: { ...await this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
    }
    return response;
  }

  private async upload(image: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const send = async (): Promise<Response> => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.filename);
      form.append('title', 'ocr front');
      form.append('description', 'ocr front old type ');
      return fetchVnpt(this.config.baseUrl + '/file-service/v1/addFile', {
        method: 'POST',
        headers: await this.headers(),
        body: form,
        signal: AbortSignal.timeout(25_000),
      });
    };

    let response = await send();
    if (this.shouldRefreshAuthorization(response)) {
      this.cachedAuthorization = null;
      response = await send();
    }
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ExternalServiceError('Không tải được ảnh lên VNPT eKYC' + formatVnptError(payload));
    }
    const object = asRecord(asRecord(payload).object);
    const hash = stringValue(object.hash);
    if (!hash) throw new ExternalServiceError('VNPT eKYC không trả về mã ảnh hợp lệ.');
    return hash;
  }

  private shouldRefreshAuthorization(response: Response): boolean {
    const hasClientCredentials = Boolean(this.config.clientId?.trim() && this.config.clientSecret?.trim());
    return hasClientCredentials && (response.status === 401 || response.status === 403);
  }

  private async headers(): Promise<Record<string, string>> {
    const tokenId = this.config.tokenId.trim();
    const tokenKey = this.config.tokenKey.trim();
    const hasTokenPair = Boolean(tokenId && tokenKey);
    return {
      Authorization: await this.getAuthorization(),
      ...(hasTokenPair ? { 'Token-id': tokenId, 'Token-key': tokenKey } : {}),
      'mac-address': this.config.macAddress,
      Accept: 'application/json',
    };
  }

  private configHint(): string {
    if (this.config.tokenKey.trim() && !this.config.tokenId.trim()) {
      return ' Cấu hình hiện có VNPT_EKYC_TOKEN_KEY nhưng thiếu VNPT_EKYC_TOKEN_ID.';
    }
    return '';
  }

  private async getAuthorization(): Promise<string> {
    const clientId = this.config.clientId?.trim();
    const clientSecret = this.config.clientSecret?.trim();
    if (!clientId || !clientSecret) return this.config.accessToken;

    const now = Date.now();
    if (this.cachedAuthorization && this.cachedAuthorization.expiresAt > now) {
      return this.cachedAuthorization.value;
    }

    const response = await fetchVnpt(this.config.authUrl || this.config.baseUrl + '/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        grant_type: 'client_credentials',
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ExternalServiceError('Không lấy được access token VNPT eKYC' + formatVnptError(payload));
    }

    const object = asRecord(payload);
    const accessToken = stringValue(object.access_token, object.accessToken, object.token);
    if (!accessToken) throw new ExternalServiceError('VNPT eKYC không trả về access token.');

    const tokenType = stringValue(object.token_type, object.tokenType) || 'Bearer';
    const authorization = accessToken.toLowerCase().startsWith('bearer ')
      ? accessToken
      : `${tokenType} ${accessToken}`.trim();
    const expiresInSeconds = Number(object.expires_in ?? object.expiresIn ?? 8 * 60 * 60);
    const refreshSkewSeconds = 5 * 60;
    const ttlSeconds = Number.isFinite(expiresInSeconds)
      ? Math.max(60, expiresInSeconds - refreshSkewSeconds)
      : 8 * 60 * 60 - refreshSkewSeconds;

    this.cachedAuthorization = {
      value: authorization,
      expiresAt: now + ttlSeconds * 1000,
    };
    return authorization;
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
