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
  botId: string;
  senderId?: string;
  referer?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface VnptAgenticKnowledgeConfig {
  url: string;
  authorization: string;
  botId: string;
  senderId: string;
  referer: string;
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
  const botId = options.botId.trim();
  const senderId = options.senderId?.trim() || 'team.25@vnptai.io';
  const referer = options.referer?.trim() || 'https://livechat.vnpt.vn/';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const missing = [
    !url ? 'VNPT_AGENTIC_URL' : null,
    !authorization ? 'VNPT_ASSISTANT_TOKEN' : null,
    !botId ? 'VNPT_ASSISTANT_BOT_ID' : null,
    !senderId ? 'VNPT_ASSISTANT_SENDER_ID' : null,
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
    new URL(referer);
  } catch {
    throw new ConfigurationError('URL cấu hình VNPT Assistant không hợp lệ.');
  }

  return {
    url,
    authorization,
    botId,
    senderId,
    referer,
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
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Referer: this.config.referer,
    });
    const payload: VnptConversationPayload = {
      bot_id: this.config.botId,
      sender_id: this.config.senderId,
      text: serializeVnptKnowledgeText(outbound.dto),
      input_channel: 'livechat',
      session_id: request.identity.sessionId,
      metadata: {},
      settings: {
        enable_chunk_stream: 1,
      },
      stream: '1',
      tts_model: 'news',
      tts_region: 'female_north',
      user_auth_level: 2,
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
