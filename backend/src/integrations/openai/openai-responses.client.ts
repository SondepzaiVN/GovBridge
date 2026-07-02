import {
  AppError,
  ConfigurationError,
} from '../../common/errors/app-error.js';

export interface OpenAiResponsesClient {
  create(request: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export interface HttpOpenAiResponsesClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

const normalizeApiKey = (apiKey: string): string =>
  apiKey.trim().replace(/^Bearer\s+/i, '');

export class HttpOpenAiResponsesClient implements OpenAiResponsesClient {
  private readonly apiKey: string;

  constructor(private readonly options: HttpOpenAiResponsesClientOptions) {
    this.apiKey = normalizeApiKey(options.apiKey);
    if (!this.apiKey) {
      throw new ConfigurationError('OPENAI_API_KEY là bắt buộc khi bật OpenAI Orchestrator.');
    }
  }

  async create(request: Readonly<Record<string, unknown>>): Promise<unknown> {
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(
        `${this.options.baseUrl.replace(/\/+$/, '')}/responses`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.options.timeoutMs),
        },
      );
    } catch (error) {
      const isTimeout = error instanceof Error
        && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new AppError(
        isTimeout ? 504 : 502,
        isTimeout ? 'OPENAI_ORCHESTRATOR_TIMEOUT' : 'OPENAI_ORCHESTRATOR_UNAVAILABLE',
        isTimeout
          ? 'OpenAI Orchestrator đã quá thời gian chờ.'
          : 'Không thể kết nối OpenAI Orchestrator.',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        502,
        'OPENAI_ORCHESTRATOR_AUTH_ERROR',
        'OpenAI Orchestrator từ chối thông tin xác thực.',
      );
    }
    if (!response.ok) {
      throw new AppError(
        502,
        'OPENAI_ORCHESTRATOR_UNAVAILABLE',
        `OpenAI Orchestrator không khả dụng (HTTP ${response.status}).`,
      );
    }

    const responseText = await response.text();
    if (!responseText.trim()) {
      throw new AppError(
        502,
        'EMPTY_ORCHESTRATOR_RESPONSE',
        'OpenAI Orchestrator không trả về dữ liệu.',
      );
    }
    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      throw new AppError(
        502,
        'INVALID_ORCHESTRATOR_RESPONSE',
        'Phản hồi OpenAI Orchestrator không phải JSON hợp lệ.',
      );
    }
  }
}
