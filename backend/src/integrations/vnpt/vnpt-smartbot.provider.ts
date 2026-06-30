import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import {
  buildRuntimeContextPrompt,
  buildSystemPrompt,
} from '../../modules/assistant/assistant.prompt.js';
import type {
  AssistantProvider,
  AssistantProviderResult,
  AssistantToolContext,
  AssistantUnderstanding,
  ConversationMessage,
} from '../../modules/assistant/assistant.types.js';
import { asRecord } from './vnpt-response.js';

export interface VnptSmartbotOptions {
  url: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  botId: string;
}

const smartbotOutputSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  intent: z.enum(['answer', 'extract', 'clarify', 'case_suggestion', 'field_explanation']).catch('answer'),
  facts: z.array(z.object({
    fieldHint: z.string().trim().min(1).max(100),
    value: z.string().trim().min(1).max(2_000),
    confidence: z.number().min(0).max(1),
    source: z.enum(['chat', 'ocr', 'form', 'inference']).catch('chat'),
    evidence: z.string().trim().max(500).optional(),
  })).max(20).catch([]),
  caseSuggestion: z.object({
    id: z.string().trim().min(1).max(100),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(1_000),
  }).nullable().catch(null),
  followUpQuestion: z.string().trim().min(1).max(1_000).nullable().catch(null),
  fieldExplanation: z.object({
    fieldId: z.string().trim().min(1).max(100),
    explanation: z.string().trim().min(1).max(2_000),
  }).nullable().catch(null),
  suggestions: z.array(z.string().trim().min(1).max(80)).max(3).catch([]),
});

const extractJsonObject = (text: string): unknown | null => {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
};

const parseStructuredOutput = (
  text: string,
): { message: string; suggestions: string[]; understanding: AssistantUnderstanding } | null => {
  const parsed = smartbotOutputSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) return null;

  const facts = parsed.data.facts.map((fact) => ({
    fieldHint: fact.fieldHint,
    value: fact.value,
    confidence: fact.confidence,
    source: fact.source,
    ...(fact.evidence ? { evidence: fact.evidence } : {}),
  }));

  return {
    message: parsed.data.message,
    suggestions: parsed.data.suggestions,
    understanding: {
      facts,
      caseSuggestion: parsed.data.caseSuggestion,
      followUpQuestion: parsed.data.followUpQuestion,
      fieldExplanation: parsed.data.fieldExplanation,
    },
  };
};

const extractCards = (event: unknown): unknown[] => {
  const object = asRecord(asRecord(event).object);
  const smartbot = asRecord(object.sb);
  return Array.isArray(smartbot.card_data) ? smartbot.card_data : [];
};

const collectCardOutput = (cards: unknown[]): { text: string; suggestions: string[] } => {
  const messages: string[] = [];
  const suggestions: string[] = [];

  for (const rawCard of cards) {
    const card = asRecord(rawCard);
    if (typeof card.text === 'string' && card.text.trim()) messages.push(card.text.trim());
    if (!Array.isArray(card.buttons)) continue;

    for (const rawButton of card.buttons) {
      const button = asRecord(rawButton);
      if (
        typeof button.title === 'string'
        && button.title.trim()
        && button.type !== 'phone_number'
        && button.type !== 'web_url'
      ) {
        suggestions.push(button.title.trim());
      }
    }
  }

  return {
    text: messages.join('\n\n'),
    suggestions: [...new Set(suggestions)].slice(0, 3),
  };
};

export class VnptSmartbotProvider implements AssistantProvider {
  readonly name = 'vnpt';

  constructor(private readonly options: VnptSmartbotOptions) {}

  async sendMessage(
    context: AssistantToolContext,
    history: ConversationMessage[],
  ): Promise<AssistantProviderResult> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    });
    if (this.options.tokenId) headers.set('Token-Id', this.options.tokenId);
    if (this.options.tokenKey) headers.set('Token-Key', this.options.tokenKey);
    if (this.options.accessToken) headers.set('Authorization', this.options.accessToken);

    // Chỉ gửi trạng thái field, không gửi giá trị form/OCR chứa dữ liệu cá nhân.
    const assistantContext = {
      procedure: context.currentProcedure
        ? {
            id: context.currentProcedure.id,
            name: context.currentProcedure.name,
            route: context.currentProcedure.route,
          }
        : null,
      step: context.formContext.currentStep,
      section: context.formContext.currentSection,
      known_field_ids: Object.keys(context.formContext.knownFields),
      missing_required_fields: context.formContext.missingRequiredFields,
      recently_changed_field_ids: Object.keys(context.formContext.recentChanges),
      candidate_cases: context.formContext.candidateCases,
      recent_ocr_field_ids: Object.keys(context.formContext.recentOcrFacts),
    };

    const payload = {
      bot_id: this.options.botId,
      sender_id: `web_${context.sessionId}`,
      text: context.message,
      input_channel: 'website',
      metadata: { assistant_context: assistantContext },
      session_id: context.sessionId,
      settings: {
        system_prompt: buildSystemPrompt(context),
        advance_prompt: buildRuntimeContextPrompt(context, history),
      },
    };

    const response = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', `VNPT Smartbot trả về lỗi HTTP ${response.status}.`);
    }
    if (!response.body) {
      throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', 'Không có dữ liệu stream từ VNPT Smartbot.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let latestCards: unknown[] = [];

    const consumeLine = (line: string): void => {
      if (!line.trimStart().startsWith('data:')) return;
      const dataText = line.replace(/^\s*data:\s*/, '').trim();
      if (!dataText || dataText === '[DONE]') return;
      try {
        const cards = extractCards(JSON.parse(dataText) as unknown);
        if (cards.length > 0) latestCards = cards;
      } catch {
        // Bỏ qua event SSE không hoàn chỉnh hoặc event trạng thái không chứa JSON.
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach(consumeLine);
    }
    if (buffer.trim()) consumeLine(buffer);

    const cardOutput = collectCardOutput(latestCards);
    const structured = parseStructuredOutput(cardOutput.text);

    if (structured) {
      return {
        response: {
          intent: structured.understanding.followUpQuestion ? 'CLARIFY' : 'CHAT',
          message: structured.message,
          ...(structured.suggestions.length > 0 ? { suggestions: structured.suggestions } : {}),
        },
        actions: [],
        understanding: structured.understanding,
      };
    }

    const message = cardOutput.text || 'Xin lỗi, mình chưa thể xử lý yêu cầu này lúc này.';
    return {
      response: {
        intent: 'CHAT',
        message,
        ...(cardOutput.suggestions.length > 0 ? { suggestions: cardOutput.suggestions } : {}),
      },
      actions: [],
    };
  }
}
