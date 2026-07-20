import { describe, expect, it } from 'vitest';
import { OpenAiIntentNormalizerProvider } from '../src/integrations/openai/openai-intent-normalizer.provider.js';
import type { OpenAiResponsesClient } from '../src/integrations/openai/openai-responses.client.js';
import { MockIntentNormalizerProvider } from '../src/modules/assistant/providers/mock-intent-normalizer.provider.js';
import type { IntentNormalizerRequest } from '../src/modules/assistant/intent-normalizer.types.js';

class FakeOpenAiResponsesClient implements OpenAiResponsesClient {
  readonly requests: Array<Readonly<Record<string, unknown>>> = [];

  constructor(private readonly responses: unknown[]) {}

  async create(requestValue: Readonly<Record<string, unknown>>): Promise<unknown> {
    this.requests.push(requestValue);
    const responseValue = this.responses.shift();
    if (responseValue === undefined) throw new Error('Missing fake OpenAI response.');
    return responseValue;
  }
}

const normalizerResponse = (payload: Record<string, unknown>) => ({
  id: 'resp_intent',
  output: [{
    type: 'message',
    content: [{
      type: 'output_text',
      text: JSON.stringify(payload),
    }],
  }],
});

const createRequest = (message: string): IntentNormalizerRequest => ({
  history: [],
  confirmedCase: null,
  context: {
    sessionId: 'session-1',
    message,
    normalizedMessage: message.toLocaleLowerCase('vi-VN'),
    currentRoute: '/ho-khau',
    currentProcedure: {
      id: 'ho-khau',
      name: 'Đăng ký thường trú',
      shortName: 'Thường trú',
      description: 'Đăng ký thường trú cho công dân.',
      route: '/ho-khau',
      icon: 'home',
      category: 'Cư trú',
      processingTime: '7 ngày',
      fee: '0',
      requiredDocs: [],
      steps: [],
      keywords: ['thường trú', 'hộ khẩu'],
      citizenSituations: ['Người dân có chỗ ở hợp pháp mới và muốn cập nhật cư trú chính thức.'],
      citizenOutcomes: ['Được ghi nhận nơi thường trú mới.'],
      negativeHints: ['Nếu chỉ ở tạm thời thì xem đăng ký tạm trú.'],
      fields: [{
        id: 'hoTen',
        label: 'Họ và tên',
        type: 'text',
        required: true,
      }],
    },
    procedures: [{
      id: 'ho-khau',
      name: 'Đăng ký thường trú',
      shortName: 'Thường trú',
      description: 'Đăng ký thường trú cho công dân.',
      route: '/ho-khau',
      icon: 'home',
      category: 'Cư trú',
      processingTime: '7 ngày',
      fee: '0',
      requiredDocs: [],
      steps: [],
      keywords: ['thường trú', 'hộ khẩu'],
      citizenSituations: ['Người dân có chỗ ở hợp pháp mới và muốn cập nhật cư trú chính thức.'],
      citizenOutcomes: ['Được ghi nhận nơi thường trú mới.'],
      negativeHints: ['Nếu chỉ ở tạm thời thì xem đăng ký tạm trú.'],
      fields: [{
        id: 'hoTen',
        label: 'Họ và tên',
        type: 'text',
        required: true,
      }],
    }],
    formValues: {},
    formContext: {
      currentStep: 1,
      currentSection: null,
      knownFields: {},
      missingRequiredFields: [{ id: 'hoTen', label: 'Họ và tên' }],
      importantVisibleFields: [{
        id: 'hoTen',
        label: 'Họ và tên',
        type: 'text',
        required: true,
        isEmpty: true,
        priority: 'high',
      }],
      recentChanges: {},
      candidateCases: [],
      recentOcrFacts: {},
      recentDocumentReviews: [],
    },
  },
});

describe('OpenAiIntentNormalizerProvider', () => {
  it('requests strict JSON intent normalization and returns the parsed target tool', async () => {
    const client = new FakeOpenAiResponsesClient([
      normalizerResponse({
        intent: 'PROCEDURE_KNOWLEDGE',
        confidence: 0.91,
        reason: 'Người dân hỏi giấy tờ cần chuẩn bị.',
        targetTool: 'procedure_knowledge',
        clarificationQuestion: null,
        procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú', route: '/ho-khau' },
        fieldHints: [],
        secondaryIntents: [],
        safetyFlags: [],
      }),
    ]);
    const provider = new OpenAiIntentNormalizerProvider({
      client,
      model: 'gpt-4o-mini',
      maxOutputTokens: 1_024,
      temperature: 0,
    });

    const result = await provider.normalize(createRequest('Đăng ký thường trú cần giấy tờ gì?'));

    expect(result.intent).toBe('PROCEDURE_KNOWLEDGE');
    expect(result.targetTool).toBe('procedure_knowledge');
    expect(result.procedureHint).toEqual({
      id: 'ho-khau',
      name: 'Đăng ký thường trú',
      route: '/ho-khau',
    });
    expect(client.requests[0]).toEqual(expect.objectContaining({
      tool_choice: 'none',
      tools: [],
      parallel_tool_calls: false,
      store: false,
      text: {
        format: expect.objectContaining({
          type: 'json_schema',
          strict: true,
          name: 'govbridge_intent_normalization',
        }),
      },
    }));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('citizenSituations'));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('hasActiveFormContext'));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('FORM_FILL/targetTool form_fill'));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('chỗ ở hợp pháp mới'));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('Tôi mới chuyển tới Cần Thơ'));
    expect(client.requests[0]?.instructions).toEqual(expect.stringContaining('Không được chỉ nói'));
  });

  it('removes procedure hints that are not in the catalog', async () => {
    const client = new FakeOpenAiResponsesClient([
      normalizerResponse({
        intent: 'NAVIGATION',
        confidence: 0.88,
        reason: 'Người dân muốn mở một thủ tục.',
        targetTool: 'navigation',
        clarificationQuestion: null,
        procedureHint: { id: 'fake', name: 'Fake', route: '/fake' },
        fieldHints: [],
        secondaryIntents: [],
        safetyFlags: [],
      }),
    ]);
    const provider = new OpenAiIntentNormalizerProvider({
      client,
      model: 'gpt-4o-mini',
      maxOutputTokens: 1_024,
    });

    const result = await provider.normalize(createRequest('Tôi muốn đăng ký thường trú'));

    expect(result.procedureHint).toBeNull();
    expect(result.safetyFlags).toContain('invalid_procedure_hint_removed');
  });

  it('treats personal data on an active form page as form fill with knowledge as secondary', async () => {
    const provider = new MockIntentNormalizerProvider();

    const result = await provider.normalize(createRequest('toi song o thanh pho can tho, phuong tan an, thu tuc can gi?'));

    expect(result.intent).toBe('FORM_FILL');
    expect(result.targetTool).toBe('form_fill');
    expect(result.secondaryIntents).toContain('PROCEDURE_KNOWLEDGE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
