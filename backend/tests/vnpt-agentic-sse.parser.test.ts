import { describe, expect, it, vi } from 'vitest';
import {
  decodeSseStream,
  SseDecoderError,
} from '../src/integrations/vnpt/sse-decoder.js';
import {
  normalizeVnptKnowledgeResult,
} from '../src/integrations/vnpt/vnpt-agentic-knowledge.normalizer.js';
import { VnptAgenticKnowledgeProvider } from '../src/integrations/vnpt/vnpt-agentic-knowledge.provider.js';
import {
  parseVnptKnowledgeStream,
} from '../src/integrations/vnpt/vnpt-agentic-sse.parser.js';
import type { KnowledgeProviderRequest } from '../src/modules/assistant/knowledge.types.js';

const encoder = new TextEncoder();

const streamFromChunks = (
  chunks: Array<string | Uint8Array>,
  onCancel?: () => void,
): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({
  start(controller) {
    for (const chunk of chunks) {
      controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
    }
  },
  pull(controller) {
    controller.close();
  },
  cancel() {
    onCancel?.();
  },
});

const cardEvent = (
  text: string | null,
  options: {
    id?: string;
    buttons?: Array<{ title: string; type?: string }>;
  } = {},
): string => JSON.stringify({
  object: {
    sb: {
      card_data: [{
        ...(options.id ? { id: options.id } : {}),
        ...(text === null ? {} : { text }),
        ...(options.buttons ? { buttons: options.buttons } : {}),
      }],
    },
  },
});

const sse = (...events: string[]): string =>
  `${events.map((event) => `data: ${event}\n\n`).join('')}data: [DONE]\n\n`;

const requestFixture: KnowledgeProviderRequest = {
  identity: {
    senderId: 'sender_opaque_12345678',
    sessionId: 'knowledge_opaque_12345678',
  },
  query: {
    question: 'Cần giấy tờ gì?',
    knowledgeType: 'documents',
    procedureHint: null,
    selectedCaseHint: null,
    fieldContext: null,
    locality: null,
  },
  currentStep: null,
  currentSection: null,
  privacy: { knownPii: [] },
};

const providerOptions = (fetchImpl: typeof fetch) => ({
  url: 'https://assistant-stream.vnpt.vn/v1/conversation',
  accessToken: 'access-token',
  tokenId: 'token-id',
  tokenKey: 'token-key',
  botId: 'bot-id',
  fetchImpl,
});

const responseFromChunks = (
  chunks: Array<string | Uint8Array>,
  onCancel?: () => void,
): Response => new Response(streamFromChunks(chunks, onCancel), { status: 200 });

const openStreamFromChunk = (
  chunk: string,
  onCancel: () => void,
): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(encoder.encode(chunk));
  },
  cancel() {
    onCancel();
  },
});

describe('independent SSE decoder and VNPT stream parser', () => {
  it('parses one SSE event split across network chunks, including split JSON', async () => {
    const event = cardEvent('Phần đầu');
    const raw = sse(event);
    const splitAt = raw.indexOf('"text"') + 4;
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      raw.slice(0, 7),
      raw.slice(7, splitAt),
      raw.slice(splitAt),
    ]));

    expect(output.answer).toBe('Phần đầu');
    expect(output.validEventCount).toBe(1);
  });

  it('preserves Vietnamese UTF-8 when a multibyte character is split by byte', async () => {
    const bytes = encoder.encode(sse(cardEvent('Điều kiện cư trú')));
    const multibyteStart = bytes.findIndex((value) => value > 0x7f);
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      bytes.slice(0, multibyteStart + 1),
      bytes.slice(multibyteStart + 1, multibyteStart + 2),
      bytes.slice(multibyteStart + 2),
    ]));

    expect(output.answer).toBe('Điều kiện cư trú');
    expect(output.answer).not.toContain('�');
  });

  it('joins every event and card in stream order instead of keeping the last card', async () => {
    const first = JSON.stringify({
      object: {
        sb: {
          card_data: [{ text: 'Một' }, { text: 'Hai' }],
        },
      },
    });
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([sse(first, cardEvent('Ba'))]),
    );

    expect(output.answer).toBe('Một\n\nHai\n\nBa');
  });

  it('replaces clear cumulative snapshots without repeating the whole answer', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(
        cardEvent('Phần một'),
        cardEvent('Phần một\n\nPhần hai'),
        cardEvent('Phần một\n\nPhần hai\n\nPhần ba'),
      ),
    ]));

    expect(output.answer).toBe('Phần một\n\nPhần hai\n\nPhần ba');
  });

  it('keeps intentionally repeated identical fragments when they have no identity', async () => {
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([sse(cardEvent('Lặp lại'), cardEvent('Lặp lại'))]),
    );

    expect(output.answer).toBe('Lặp lại\n\nLặp lại');
  });

  it('uses a card id to update a snapshot in its original ordered position', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(
        cardEvent('Bản nháp', { id: 'answer' }),
        cardEvent('Nội dung sau'),
        cardEvent('Bản hoàn chỉnh', { id: 'answer' }),
      ),
    ]));

    expect(output.answer).toBe('Bản hoàn chỉnh\n\nNội dung sau');
  });

  it('dispatches the final event without a trailing newline', async () => {
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([`data: ${cardEvent('Kết thúc')}`]),
    );

    expect(output.answer).toBe('Kết thúc');
  });

  it('supports CRLF, comments, keep-alive, irrelevant fields and multiline data', async () => {
    const raw = [
      ': keep-alive',
      'event: message',
      'data: {"object":',
      'data: {"sb":{"card_data":[{"text":"Đúng chuẩn"}]}}}',
      '',
      ': ping',
      'data: [DONE]',
      '',
    ].join('\r\n');
    const output = await parseVnptKnowledgeStream(streamFromChunks([raw]));

    expect(output.answer).toBe('Đúng chuẩn');
    expect(output.doneReceived).toBe(true);
  });

  it('keeps valid content around a malformed JSON event', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(cardEvent('Trước'), '{"broken":', cardEvent('Sau')),
    ]));

    expect(output.answer).toBe('Trước\n\nSau');
    expect(output.validEventCount).toBe(2);
    expect(output.invalidEventCount).toBe(1);
  });

  it('does not let a later status-only event erase earlier content', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(cardEvent('Nội dung đã có'), JSON.stringify({ status: 'completed' })),
    ]));

    expect(output.answer).toBe('Nội dung đã có');
    expect(output.validEventCount).toBe(2);
  });

  it('normalizes an entirely invalid stream as INVALID_KNOWLEDGE_STREAM', async () => {
    const output = await parseVnptKnowledgeStream(
      streamFromChunks(['data: {not-json}\n\n']),
    );
    const result = normalizeVnptKnowledgeResult(output);

    expect(result).toMatchObject({
      status: 'provider_error',
      errorCode: 'INVALID_KNOWLEDGE_STREAM',
    });
  });

  it('normalizes a valid but empty stream as EMPTY_KNOWLEDGE_RESPONSE', async () => {
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([': ping\n\ndata: [DONE]\n\n']),
    );
    const result = normalizeVnptKnowledgeResult(output);

    expect(result).toMatchObject({
      status: 'provider_error',
      errorCode: 'EMPTY_KNOWLEDGE_RESPONSE',
    });
  });

  it('preserves citations and source section while extracting only explicit references', async () => {
    const answer = [
      'Bạn cần giấy tờ theo [Nguồn 1].',
      '',
      'Nguồn tham khảo',
      '- Luật Cư trú số 68/2020/QH14 - https://example.gov.vn/luat-cu-tru',
    ].join('\n');
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([sse(cardEvent(answer))]),
    );
    const result = normalizeVnptKnowledgeResult(output);

    expect(result.answer).toBe(answer);
    expect(result.references).toEqual([{
      title: 'Luật Cư trú số 68/2020/QH14',
      url: 'https://example.gov.vn/luat-cu-tru',
      documentNumber: '68/2020/QH14',
    }]);
  });

  it('does not invent a reference from an uncertain source marker', async () => {
    const answer = 'Thông tin hồ sơ [Nguồn 1]\n\nNguồn tham khảo';
    const output = await parseVnptKnowledgeStream(
      streamFromChunks([sse(cardEvent(answer))]),
    );
    const result = normalizeVnptKnowledgeResult(output);

    expect(result.answer).toBe(answer);
    expect(result.references).toEqual([]);
  });

  it('collects conversational quick replies from all events in first-seen order', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(
        cardEvent('Nội dung', {
          buttons: [
            { title: '  Xem hồ sơ  ', type: 'postback' },
            { title: 'Gọi điện', type: 'phone_number' },
          ],
        }),
        cardEvent(null, {
          buttons: [
            { title: 'Trang web', type: 'web_url' },
            { title: 'Xem   hồ sơ', type: 'postback' },
            { title: 'Cách nộp', type: 'postback' },
          ],
        }),
      ),
    ]));

    expect(output.quickReplies).toEqual(['Xem hồ sơ', 'Cách nộp']);
  });

  it('classifies only an explicit no-source answer as no_source', async () => {
    const output = await parseVnptKnowledgeStream(streamFromChunks([
      sse(cardEvent('Chưa tìm thấy đủ nguồn để trả lời câu hỏi này.')),
    ]));
    const result = normalizeVnptKnowledgeResult(output);

    expect(result.status).toBe('no_source');
    expect(result.answer).toBe('Chưa tìm thấy đủ nguồn để trả lời câu hỏi này.');
  });

  it('stops and cancels the reader when a safety limit is exceeded', async () => {
    let cancelled = false;
    const body = openStreamFromChunk(
      'data: 123456789\n\n',
      () => {
        cancelled = true;
      },
    );

    await expect(decodeSseStream(body, () => undefined, {
      maxTotalBytes: 8,
      maxEvents: 10,
      maxEventCharacters: 100,
    })).rejects.toEqual(expect.objectContaining<SseDecoderError>({
      kind: 'LIMIT_EXCEEDED',
    }));
    expect(cancelled).toBe(true);
  });
});

describe('VNPT provider error mapping and output boundary', () => {
  it.each([
    [401, 'KNOWLEDGE_PROVIDER_AUTH_ERROR'],
    [403, 'KNOWLEDGE_PROVIDER_AUTH_ERROR'],
    [429, 'KNOWLEDGE_PROVIDER_UNAVAILABLE'],
    [500, 'KNOWLEDGE_PROVIDER_UNAVAILABLE'],
    [503, 'KNOWLEDGE_PROVIDER_UNAVAILABLE'],
  ])('maps HTTP %i without exposing raw response data', async (status, errorCode) => {
    const fetchImpl = vi.fn(async () => new Response('secret upstream body', { status }));
    const provider = new VnptAgenticKnowledgeProvider(providerOptions(fetchImpl));

    const result = await provider.query(requestFixture);

    expect(result).toMatchObject({ status: 'provider_error', errorCode });
    expect(JSON.stringify(result)).not.toContain('secret upstream body');
  });

  it.each([
    ['timeout', new DOMException('timed out', 'TimeoutError'), 'KNOWLEDGE_PROVIDER_TIMEOUT'],
    ['network', new Error('socket secret'), 'KNOWLEDGE_PROVIDER_UNAVAILABLE'],
  ])('maps %s failures without leaking transport details', async (_label, failure, errorCode) => {
    const fetchImpl = vi.fn(async () => {
      throw failure;
    });
    const provider = new VnptAgenticKnowledgeProvider(providerOptions(fetchImpl));

    const result = await provider.query(requestFixture);

    expect(result).toMatchObject({ status: 'provider_error', errorCode });
    expect(JSON.stringify(result)).not.toContain(failure.message);
  });

  it('maps a timeout while reading the response stream', async () => {
    const timedOutBody = new ReadableStream<Uint8Array>({
      pull() {
        throw new DOMException('read timed out', 'TimeoutError');
      },
    });
    const fetchImpl = vi.fn(async () => new Response(timedOutBody, { status: 200 }));
    const provider = new VnptAgenticKnowledgeProvider(providerOptions(fetchImpl));

    const result = await provider.query(requestFixture);

    expect(result).toMatchObject({
      status: 'provider_error',
      errorCode: 'KNOWLEDGE_PROVIDER_TIMEOUT',
    });
    expect(JSON.stringify(result)).not.toContain('read timed out');
  });

  it('maps stream limits to a typed provider error and cancels reading', async () => {
    let cancelled = false;
    const oversized = 'A'.repeat(100_001);
    const fetchImpl = vi.fn(async () => new Response(
      openStreamFromChunk(`data: ${cardEvent(oversized)}\n\n`, () => {
        cancelled = true;
      }),
      { status: 200 },
    ));
    const provider = new VnptAgenticKnowledgeProvider(providerOptions(fetchImpl));

    const result = await provider.query(requestFixture);

    expect(result).toMatchObject({
      status: 'provider_error',
      errorCode: 'INVALID_KNOWLEDGE_STREAM',
    });
    expect(cancelled).toBe(true);
  });

  it('returns only normalized KnowledgeResult fields, never raw SSE or VNPT metadata', async () => {
    const rawMetadata = 'internal-metadata-secret';
    const event = JSON.stringify({
      object: {
        sb: {
          card_data: [{ text: 'Nội dung trả lời' }],
          internal_metadata: rawMetadata,
        },
      },
    });
    const fetchImpl = vi.fn(async () => responseFromChunks([sse(event)]));
    const provider = new VnptAgenticKnowledgeProvider(providerOptions(fetchImpl));

    const result = await provider.query(requestFixture);

    expect(result).toEqual({
      answer: 'Nội dung trả lời',
      references: [],
      quickReplies: [],
      provider: 'vnpt-agentic',
      status: 'success',
    });
    expect(JSON.stringify(result)).not.toContain(rawMetadata);
    expect(JSON.stringify(result)).not.toContain('data:');
  });
});
