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
  botId: string;
}

export class VnptSmartbotProvider implements AssistantProvider {
  readonly name = 'vnpt';

  constructor(private readonly options: VnptSmartbotOptions) {}

  async sendMessage(
    context: AssistantToolContext,
    history: ConversationMessage[]
  ): Promise<AssistantResult> {
    const systemPrompt = buildSystemPrompt(context.procedures, context.currentRoute, context.currentProcedure);
    
    // Convert history into advance_prompt or incorporate it into system_prompt
    // because VNPT Smartbot's settings only support system_prompt and advance_prompt
    const historyText = history.length > 0 
      ? `\nLịch sử trò chuyện gần đây:\n` + history.slice(-5).map(m => `${m.role === 'user' ? 'Khách' : 'Bot'}: ${m.content}`).join('\n')
      : '';
      
    const finalSystemPrompt = systemPrompt + historyText;

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    });
    if (this.options.tokenId) headers.set('Token-Id', this.options.tokenId);
    if (this.options.tokenKey) headers.set('Token-Key', this.options.tokenKey);
    if (this.options.accessToken) headers.set('Authorization', this.options.accessToken);

    const payload = {
      bot_id: this.options.botId,
      sender_id: 'guest_user', // This should ideally be mapped from context
      text: context.message,
      input_channel: 'website',
      metadata: {},
      session_id: 'session_' + Date.now(), // Generate a simple session ID or pass it from context if possible
      settings: {
        system_prompt: finalSystemPrompt,
        advance_prompt: "null"
      }
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
    
    let latestCardData: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const dataStr = line.replace(/^data:\s*/, '').trim();
          if (!dataStr) continue;
          
          try {
            const data = JSON.parse(dataStr);
            const cardData = data?.object?.sb?.card_data;
            if (Array.isArray(cardData)) {
               latestCardData = cardData;
            }
            
            // Check status to break early if stream finished
            const status = data?.object?.sb?.card_data_info?.status;
            if (status === 0 || status === 2) {
               // Stream ended
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    let fullMessage = '';
    const suggestions: string[] = [];

    for (const card of latestCardData) {
      if (card.text) {
        fullMessage += (fullMessage ? '\n\n' : '') + card.text;
      }
      if (card.buttons && Array.isArray(card.buttons)) {
        for (const btn of card.buttons) {
          if (btn.title && btn.type !== 'phone_number' && btn.type !== 'web_url') {
             // Only add buttons that can be mapped to suggestions / text inputs
             suggestions.push(btn.title);
          }
        }
      }
    }

    if (!fullMessage) {
      fullMessage = "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.";
    }

    const resultResponse: any = {
      intent: 'CHAT',
      message: fullMessage,
    };
    if (suggestions.length > 0) {
      resultResponse.suggestions = Array.from(new Set(suggestions));
    }

    return {
      response: resultResponse,
      actions: [],
    };
  }
}
