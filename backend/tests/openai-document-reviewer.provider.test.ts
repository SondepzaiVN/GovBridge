import { describe, expect, it } from 'vitest';
import { OpenAiDocumentReviewerProvider } from '../src/integrations/openai/openai-document-reviewer.provider.js';
import type { OpenAiResponsesClient } from '../src/integrations/openai/openai-responses.client.js';
import type { DocumentReviewInput } from '../src/modules/document-review/document-review.types.js';

class FakeOpenAiResponsesClient implements OpenAiResponsesClient {
  readonly requests: Array<Readonly<Record<string, unknown>>> = [];

  constructor(private readonly response: unknown) {}

  async create(request: Readonly<Record<string, unknown>>): Promise<unknown> {
    this.requests.push(request);
    return this.response;
  }
}

const openAiResponse = (text: string) => ({
  output: [{
    type: 'message',
    content: [{
      type: 'output_text',
      text,
    }],
  }],
});

const reviewInput: DocumentReviewInput = {
  recognizedText: 'RAW_OCR_SECRET: Mẫu CT01\nHọ tên: Nguyễn Văn An',
  rules: 'RULES: phải là CT01 và có nội dung đề nghị',
  documentType: 'ct01',
  currentRoute: '/ho-khau',
  fileName: 'ct01.pdf',
  readerWarnings: ['mờ trang 1'],
};

const createProvider = (client: OpenAiResponsesClient) => new OpenAiDocumentReviewerProvider({
  client,
  model: 'gpt-4o-mini',
  maxOutputTokens: 512,
  temperature: 0,
});

describe('OpenAiDocumentReviewerProvider', () => {
  it('sends a strict JSON-schema request and returns a valid review result', async () => {
    const client = new FakeOpenAiResponsesClient(openAiResponse(JSON.stringify({
      text: 'Văn bản hợp lệ sơ bộ.',
      flag: 'green',
    })));
    const provider = createProvider(client);

    await expect(provider.review(reviewInput)).resolves.toEqual({
      text: 'Văn bản hợp lệ sơ bộ.',
      flag: 'green',
    });

    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]).toEqual(expect.objectContaining({
      model: 'gpt-4o-mini',
      tool_choice: 'none',
      parallel_tool_calls: false,
      store: false,
      temperature: 0,
      text: {
        format: expect.objectContaining({
          type: 'json_schema',
          strict: true,
          name: 'govbridge_document_review',
        }),
      },
    }));
    const input = client.requests[0]?.input as Array<{ content: string }>;
    const payload = JSON.parse(input[0]?.content ?? '{}') as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({
      currentRoute: '/ho-khau',
      documentType: 'ct01',
      fileName: 'ct01.pdf',
      readerWarnings: ['mờ trang 1'],
      rules: reviewInput.rules,
      ocrText: reviewInput.recognizedText,
    }));
  });

  it('rejects malformed API response schemas without leaking raw OCR text', async () => {
    const provider = createProvider(new FakeOpenAiResponsesClient({ unexpected: true }));

    await expect(provider.review(reviewInput)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_REVIEW_RESPONSE',
      message: expect.not.stringContaining('RAW_OCR_SECRET'),
    });
  });

  it('rejects output that is not valid JSON without leaking raw OCR text', async () => {
    const provider = createProvider(new FakeOpenAiResponsesClient(openAiResponse('not json: RAW_PROVIDER_DATA')));

    await expect(provider.review(reviewInput)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_REVIEW_JSON',
      message: expect.not.stringContaining('RAW_OCR_SECRET'),
    });
  });

  it('rejects JSON that does not match the review schema without exposing raw model output', async () => {
    const provider = createProvider(new FakeOpenAiResponsesClient(openAiResponse(JSON.stringify({
      text: '',
      flag: 'yellow',
      raw: 'RAW_PROVIDER_DATA',
    }))));

    await expect(provider.review(reviewInput)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_REVIEW_RESULT',
      message: expect.not.stringContaining('RAW_PROVIDER_DATA'),
    });
  });
});
