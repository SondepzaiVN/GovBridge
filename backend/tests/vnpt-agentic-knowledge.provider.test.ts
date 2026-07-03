import { describe, expect, it, vi } from 'vitest';
import { VnptAgenticKnowledgeProvider } from '../src/integrations/vnpt/vnpt-agentic-knowledge.provider.js';
import { serializeVnptKnowledgeText } from '../src/integrations/vnpt/vnpt-agentic-knowledge.serializer.js';
import { prepareVnptKnowledgeOutbound } from '../src/integrations/vnpt/vnpt-agentic-knowledge.privacy.js';
import type { KnowledgeProviderRequest } from '../src/modules/assistant/knowledge.types.js';

const knowledgeRequest: KnowledgeProviderRequest = {
  identity: {
    senderId: 'sender_opaque_12345678',
    sessionId: 'knowledge_opaque_12345678',
  },
  query: {
    question: 'Tôi cần giấy tờ nào?',
    knowledgeType: 'documents',
    procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
    selectedCaseHint: null,
    fieldContext: { fieldId: 'hoTen', fieldLabel: 'Họ tên' },
    locality: null,
  },
  currentStep: 2,
  currentSection: null,
  privacy: { knownPii: [] },
};

const createKnowledgeResponse = (): Response => {
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"object":{"sb":{"card_data":[{"text":"Phần một [Nguồn 1]"}]}}}\n\n',
    'data: {"object":{"sb":{"card_',
    'data":[{"text":"Phần hai\\n\\nNguồn tham khảo"},{"buttons":[{"title":"Xem thêm","type":"postback"}]}]}}}\n\n',
    'data: [DONE]\n\n',
  ];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
};

const validOptions = (fetchImpl: typeof fetch) => ({
  url: 'https://assistant-stream.vnpt.vn/v1/conversation',
  accessToken: 'access-token',
  tokenId: 'token-id',
  tokenKey: 'token-key',
  botId: 'bot-id',
  fetchImpl,
});

describe('VnptAgenticKnowledgeProvider', () => {
  it('posts the exact Conversation API payload and preserves the SSE answer', async () => {
    let capturedInput: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedInput = input;
      capturedInit = init;
      return createKnowledgeResponse();
    });
    const provider = new VnptAgenticKnowledgeProvider(validOptions(fetchImpl));

    const result = await provider.query(knowledgeRequest);
    const payload = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    const headers = new Headers(capturedInit?.headers);

    expect(capturedInput).toBe('https://assistant-stream.vnpt.vn/v1/conversation');
    expect(capturedInit?.method).toBe('POST');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('text/event-stream');
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('Token-id')).toBe('token-id');
    expect(headers.get('Token-key')).toBe('token-key');
    expect(payload).toEqual({
      bot_id: 'bot-id',
      sender_id: 'sender_opaque_12345678',
      text: expect.stringContaining('[CÂU HỎI CỦA NGƯỜI DÂN]'),
      input_channel: 'livechat',
      session_id: 'knowledge_opaque_12345678',
      metadata: { button_variables: [] },
    });
    expect(Object.keys(payload).sort()).toEqual([
      'bot_id',
      'input_channel',
      'metadata',
      'sender_id',
      'session_id',
      'text',
    ]);
    expect(result).toEqual({
      answer: 'Phần một [Nguồn 1]\n\nPhần hai\n\nNguồn tham khảo',
      references: [],
      quickReplies: ['Xem thêm'],
      provider: 'vnpt-agentic',
      status: 'success',
    });
    expect(result).not.toHaveProperty('actions');
    expect(result).not.toHaveProperty('facts');
  });

  it.each([
    ['raw token', ' access-token ', 'Bearer access-token'],
    ['existing prefix', ' Bearer access-token ', 'Bearer access-token'],
    ['case-insensitive prefix', 'bEaReR access-token', 'Bearer access-token'],
    ['duplicate legacy prefix', 'Bearer Bearer access-token', 'Bearer access-token'],
  ])('normalizes Authorization exactly once: %s', async (_label, token, expected) => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return createKnowledgeResponse();
    });
    const provider = new VnptAgenticKnowledgeProvider({
      ...validOptions(fetchImpl),
      accessToken: token,
    });

    await provider.query(knowledgeRequest);

    expect(new Headers(capturedInit?.headers).get('Authorization')).toBe(expected);
    expect(new Headers(capturedInit?.headers).get('Authorization')).not.toContain('Bearer Bearer');
  });

  it('uses only the opaque identities prepared by the session layer', async () => {
    const payloads: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return createKnowledgeResponse();
    });
    const provider = new VnptAgenticKnowledgeProvider(validOptions(fetchImpl));

    await provider.query(knowledgeRequest);
    await provider.query(knowledgeRequest);
    await provider.query({
      ...knowledgeRequest,
      identity: {
        senderId: 'sender_new_87654321',
        sessionId: 'knowledge_new_87654321',
      },
    });

    expect(payloads[0]?.sender_id).toBe(payloads[1]?.sender_id);
    expect(payloads[0]?.session_id).toBe(payloads[1]?.session_id);
    expect(payloads[2]?.sender_id).not.toBe(payloads[0]?.sender_id);
    expect(payloads[2]?.session_id).not.toBe(payloads[0]?.session_id);
  });

  it('serializes only verified non-empty context and never defaults a procedure', () => {
    const outbound = prepareVnptKnowledgeOutbound({
      identity: knowledgeRequest.identity,
      query: {
        question: 'Tôi mới sinh con thì cần làm thủ tục gì?',
        knowledgeType: 'procedure_identification',
        procedureHint: { id: ' ', name: 'không xác định' },
        selectedCaseHint: ' ',
        fieldContext: { fieldId: 'ignored', fieldLabel: ' ' },
        locality: 'không xác định',
      },
      currentStep: null,
      currentSection: ' ',
      privacy: { knownPii: [] },
    });
    const text = serializeVnptKnowledgeText(outbound.dto);

    expect(text).toBe([
      '[NGỮ CẢNH GOVBRIDGE]',
      'Loại thông tin cần tra cứu: xác định thủ tục phù hợp',
      '',
      '[CÂU HỎI CỦA NGƯỜI DÂN]',
      'Tôi mới sinh con thì cần làm thủ tục gì?',
    ].join('\n'));
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('không xác định');
    expect(text).not.toContain('Đăng ký thường trú');
  });

  it('does not put assistant/form/OCR/history metadata into payload or text', async () => {
    let serializedPayload = '';
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      serializedPayload = String(init?.body);
      return createKnowledgeResponse();
    });
    const provider = new VnptAgenticKnowledgeProvider(validOptions(fetchImpl));

    await provider.query(knowledgeRequest);

    for (const forbidden of [
      'settings',
      'system_prompt',
      'advance_prompt',
      'assistant_context',
      'formValues',
      'known_field_ids',
      'candidate_cases',
      'recentOcrFacts',
      'storage_path',
      'chat_history',
    ]) {
      expect(serializedPayload).not.toContain(forbidden);
    }
  });

  it('throws configuration error before fetch when a required credential is missing', () => {
    const fetchImpl = vi.fn(async () => createKnowledgeResponse());

    expect(() => new VnptAgenticKnowledgeProvider({
      ...validOptions(fetchImpl),
      tokenKey: ' ',
    })).toThrow(expect.objectContaining({
      code: 'PROVIDER_NOT_CONFIGURED',
      message: expect.not.stringContaining('access-token'),
    }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
