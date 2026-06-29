import { AppError } from '../../common/errors/app-error.js';
import { buildSystemPrompt } from '../../modules/assistant/assistant.prompt.js';
import type {
  AssistantProvider,
  AssistantResult,
  AssistantToolContext,
  ConversationMessage,
} from '../../modules/assistant/assistant.types.js';

export interface VnptSmartbotOptions {
  url: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
}

export class VnptSmartbotProvider implements AssistantProvider {
  readonly name = 'vnpt';

  constructor(private readonly options: VnptSmartbotOptions) {}

  async sendMessage(
    context: AssistantToolContext,
    history: ConversationMessage[]
  ): Promise<AssistantResult> {
    const systemPrompt = buildSystemPrompt(context.procedures, context.currentRoute, context.currentProcedure);
    const contextualPrompt = `[Context: trang "${context.currentRoute}"][Lịch sử: ${history.length} messages]\nTin nhắn: ${context.message}`;

    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    if (this.options.tokenId) headers.set('Token-Id', this.options.tokenId);
    if (this.options.tokenKey) headers.set('Token-Key', this.options.tokenKey);
    if (this.options.accessToken) headers.set('Authorization', this.options.accessToken);

    const response = await fetch(`${this.options.url}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: contextualPrompt,
        conversation_history: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
        system_prompt: systemPrompt,
        response_format: 'json',
      }),
    });

    if (!response.ok) {
      throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', `VNPT Smartbot trả về HTTP ${response.status}.`);
    }

    const data = await response.json();
    const rawText = data.result || data.response || '';
    
    // Parse JSON từ text (trong trường hợp model trả về text bọc JSON)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Giả sử API trả về AIResponse
        return {
          response: parsed,
          actions: [], // actions có thể được map nếu cần thiết
        };
      } catch (e) {
        // Fallback
      }
    }

    return {
      response: {
        intent: 'CHAT',
        message: rawText,
        suggestions: ['Tiếp tục'],
      },
      actions: [],
    };
  }
}
