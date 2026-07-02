import { ConfigurationError } from '../../common/errors/app-error.js';
import type {
  KnowledgeProvider,
  KnowledgeProviderRequest,
  KnowledgeResult,
} from '../../modules/assistant/knowledge.types.js';
import {
  assertSafeVnptOutboundPayload,
  prepareVnptKnowledgeOutbound,
  type VnptConversationPayload,
} from './vnpt-agentic-knowledge.privacy.js';
import {
  mapVnptHttpError,
  mapVnptStreamError,
  mapVnptTransportError,
} from './vnpt-agentic-knowledge.errors.js';
import {
  normalizeVnptKnowledgeResult,
} from './vnpt-agentic-knowledge.normalizer.js';
import {
  parseVnptKnowledgeStream,
} from './vnpt-agentic-sse.parser.js';
import { serializeVnptKnowledgeText } from './vnpt-agentic-knowledge.serializer.js';

export interface VnptAgenticKnowledgeOptions {
  url: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  botId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface VnptAgenticKnowledgeConfig {
  url: string;
  authorization: string;
  tokenId: string;
  tokenKey: string;
  botId: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

const authorizationValue = (accessToken: string): string => {
  let token = accessToken.trim();
  while (/^Bearer(?:\s+|$)/i.test(token)) {
    token = token.replace(/^Bearer(?:\s+|$)/i, '').trim();
  }
  return token ? `Bearer ${token}` : '';
};

const buildConfig = (options: VnptAgenticKnowledgeOptions): VnptAgenticKnowledgeConfig => {
  const url = options.url.trim();
  const authorization = authorizationValue(options.accessToken);
  const tokenId = options.tokenId.trim();
  const tokenKey = options.tokenKey.trim();
  const botId = options.botId.trim();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const missing = [
    !url ? 'VNPT_AGENTIC_URL' : null,
    !authorization ? 'VNPT_AGENTIC_ACCESS_TOKEN' : null,
    !tokenId ? 'VNPT_AGENTIC_TOKEN_ID' : null,
    !tokenKey ? 'VNPT_AGENTIC_TOKEN_KEY' : null,
    !botId ? 'VNPT_AGENTIC_BOT_ID' : null,
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Thiếu cấu hình VNPT Agentic KnowledgeProvider: ${missing.join(', ')}.`,
    );
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new ConfigurationError('VNPT_AGENTIC_TIMEOUT_MS phải nằm trong khoảng 1000-120000.');
  }
  try {
    new URL(url);
  } catch {
    throw new ConfigurationError('VNPT_AGENTIC_URL không hợp lệ.');
  }

  return {
    url,
    authorization,
    tokenId,
    tokenKey,
    botId,
    timeoutMs,
    fetchImpl: options.fetchImpl ?? fetch,
  };
};

export class VnptAgenticKnowledgeProvider implements KnowledgeProvider {
  readonly name = 'vnpt-agentic';
  private readonly config: VnptAgenticKnowledgeConfig;

  constructor(options: VnptAgenticKnowledgeOptions) {
    this.config = buildConfig(options);
  }

  async query(request: KnowledgeProviderRequest): Promise<KnowledgeResult> {
    const outbound = prepareVnptKnowledgeOutbound(request);
    const headers = new Headers({
      Authorization: this.config.authorization,
      'Token-id': this.config.tokenId,
      'Token-key': this.config.tokenKey,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    });
    const payload: VnptConversationPayload = {
      bot_id: this.config.botId,
      sender_id: request.identity.senderId,
      text: serializeVnptKnowledgeText(outbound.dto),
      input_channel: 'livechat',
      session_id: request.identity.sessionId,
      metadata: {
        button_variables: [],
      },
    };
    assertSafeVnptOutboundPayload(payload, request.privacy.knownPii);

    let response: Response;
    try {
      response = await this.config.fetchImpl(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      return mapVnptTransportError(error);
    }

    if (!response.ok || !response.body) {
      return mapVnptHttpError(response.status);
    }

    try {
      const output = await parseVnptKnowledgeStream(response.body);
      return normalizeVnptKnowledgeResult(output);
    } catch (error) {
      return mapVnptStreamError(error);
    }
  }
}
