import type { AIResponse } from '../types';
import { VNPT_CONFIG, IS_MOCK_MODE, getVNPTHeaders } from '../config/vnpt';
import { AGENT_SYSTEM_PROMPT } from '../data/knowledgeBase';
import { findServiceByKeyword, PUBLIC_SERVICES } from '../data/services';
import { buildAgentTools } from './agentTools';
import { agentEventBus } from './agentEventBus';
import type { AgentEvent } from './agentEventBus';

// ============================================================
// Conversation context
// ============================================================
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================
// Detect LLM backend
// ============================================================
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const USE_OPENAI = !!OPENAI_API_KEY;

// ============================================================
// Map tool name → AgentEvent type
// ============================================================
const TOOL_TO_EVENT: Record<string, AgentEvent['type']> = {
  chat_response: 'CHAT',
  highlight_element: 'HIGHLIGHT_ELEMENT',
  auto_fill_form: 'FILL_FORM',
  navigate_page: 'NAVIGATE',
  validate_form: 'VALIDATE_FORM',
  show_service_info: 'SHOW_SERVICE_INFO',
};

// ============================================================
// Parse tool_call args → AgentEvent và emit
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dispatchToolCall = (toolName: string, args: Record<string, any>): AgentEvent => {
  const eventType = TOOL_TO_EVENT[toolName] ?? 'CHAT';

  switch (toolName) {
    case 'highlight_element':
      return {
        type: 'HIGHLIGHT_ELEMENT',
        elementId: args.element_id ?? '',
        elementLabel: args.element_label,
        message: args.message ?? '',
        suggestions: args.suggestions ?? [],
      };

    case 'auto_fill_form':
      return {
        type: 'FILL_FORM',
        fields: args.fields ?? {},
        message: args.message ?? '',
        suggestions: args.suggestions ?? [],
      };

    case 'navigate_page':
      return {
        type: 'NAVIGATE',
        route: args.route ?? '/',
        serviceName: args.service_name ?? '',
        message: args.message ?? '',
        suggestions: args.suggestions ?? ['Đồng ý, chuyển ngay!', 'Thôi, để sau'],
      };

    case 'validate_form':
      return {
        type: 'VALIDATE_FORM',
        validationErrors: args.validation_errors ?? [],
        message: args.message ?? '',
        suggestions: args.suggestions ?? [],
      };

    case 'show_service_info':
      return {
        type: 'SHOW_SERVICE_INFO',
        serviceId: args.service_id ?? '',
        infoType: args.info_type ?? 'general',
        message: args.message ?? '',
        suggestions: args.suggestions ?? [],
      };

    case 'chat_response':
    default:
      return {
        type: 'CHAT',
        message: args.message ?? '',
        suggestions: args.suggestions ?? [],
      };
  }

  // TypeScript needs this, but it's unreachable
  return { type: eventType as 'CHAT', message: args.message ?? '', suggestions: args.suggestions ?? [] };
};

// ============================================================
// Convert AgentEvent → AIResponse (backward-compat với ChatbotContext)
// ============================================================
const agentEventToAIResponse = (event: AgentEvent): AIResponse => {
  switch (event.type) {
    case 'HIGHLIGHT_ELEMENT':
      return {
        intent: 'HIGHLIGHT',
        message: event.message,
        data: { elementId: event.elementId, elementLabel: event.elementLabel },
        suggestions: event.suggestions,
      };
    case 'FILL_FORM':
      return {
        intent: 'FILL_FORM',
        message: event.message,
        data: { fields: event.fields },
        suggestions: event.suggestions,
      };
    case 'NAVIGATE':
      return {
        intent: 'NAVIGATE',
        message: event.message,
        data: { route: event.route, serviceName: event.serviceName },
        suggestions: event.suggestions,
      };
    case 'VALIDATE_FORM':
      return {
        intent: 'VALIDATE',
        message: event.message,
        data: { validationErrors: event.validationErrors },
        suggestions: event.suggestions,
      };
    case 'SHOW_SERVICE_INFO':
      return {
        intent: 'CHAT',
        message: event.message,
        suggestions: event.suggestions,
      };
    case 'ERROR':
      return {
        intent: 'CHAT',
        message: event.message,
        suggestions: ['Thử lại', 'Tôi cần hỗ trợ'],
      };
    case 'CHAT':
    default:
      return {
        intent: 'CHAT',
        message: (event as { message: string; suggestions?: string[] }).message,
        suggestions: (event as { message: string; suggestions?: string[] }).suggestions,
      };
  }
};

// ============================================================
// ---- MOCK RESPONSES (khi không có API key) ----
// Đây là rule-based pattern matching — không phải LLM thật
// ============================================================
const mockRespond = (userText: string, currentRoute: string): AIResponse => {
  const lower = userText.toLowerCase().trim();

  // ── Highlight: hỏi về vị trí nút/element ──
  const highlightPatterns = [
    { keywords: ['submit', 'nộp hồ sơ', 'nút nộp', 'nộp', 'gửi hồ sơ'], id: 'submit-btn', lbl: 'Nút Nộp Hồ Sơ' },
    { keywords: ['tìm kiếm', 'search', 'tìm dịch vụ'], id: 'search-bar', lbl: 'Ô tìm kiếm dịch vụ' },
    { keywords: ['đăng nhập', 'login'], id: 'login-btn', lbl: 'Nút Đăng nhập' },
    { keywords: ['ai hint', 'gợi ý ai', 'trợ lý'], id: 'ai-hint', lbl: 'Gợi ý Trợ lý AI' },
    { keywords: ['khai sinh', 'khai sinh card'], id: 'service-khai-sinh', lbl: 'Thẻ Đăng ký Khai Sinh' },
  ];

  const isAskingWhere = lower.includes('đâu') || lower.includes('ở đâu') || lower.includes('chỗ nào') || lower.includes('vị trí');
  const isAskingAboutBtn = lower.includes('nút') || lower.includes('button') || lower.includes('bấm') || lower.includes('nhấn') || lower.includes('click');

  if (isAskingWhere || isAskingAboutBtn) {
    for (const p of highlightPatterns) {
      if (p.keywords.some(k => lower.includes(k))) {
        return {
          intent: 'HIGHLIGHT',
          message: `Tôi sẽ chỉ cho bạn vị trí **${p.lbl}**! 💡\n\nPhần còn lại của giao diện sẽ được làm tối, chỉ để lại phần cần nhấn sáng lên.`,
          data: { elementId: p.id, elementLabel: p.lbl },
          suggestions: ['Cảm ơn!', 'Tôi muốn điền form', 'Hướng dẫn thêm'],
        };
      }
    }
    if (lower.includes('nút') || isAskingAboutBtn) {
      return {
        intent: 'HIGHLIGHT',
        message: 'Tôi sẽ highlight nút **Nộp Hồ Sơ** cho bạn! 💡',
        data: { elementId: 'submit-btn', elementLabel: 'Nút Nộp Hồ Sơ' },
        suggestions: ['Cảm ơn!', 'Chưa điền xong form', 'Kiểm tra thông tin giúm'],
      };
    }
  }

  // ── Hỏi về giấy tờ cần chuẩn bị ──
  if (lower.includes('cần') && (lower.includes('giấy tờ') || lower.includes('chuẩn bị') || lower.includes('hồ sơ'))) {
    const currentService = findServiceByKeyword(lower) || PUBLIC_SERVICES.find(s => s.route === currentRoute);
    if (currentService) {
      return {
        intent: 'CHAT',
        message: `Để làm **${currentService.name}**, bạn cần chuẩn bị:\n${currentService.requiredDocs.map(d => `• ${d}`).join('\n')}\n\n⏱ Thời gian xử lý: **${currentService.processingTime}**\n💰 Lệ phí: **${currentService.fee}**`,
        suggestions: ['Bắt đầu điền form', 'Upload ảnh CCCD', 'Hướng dẫn từng bước'],
      };
    }
  }

  // ── FAQ: hỏi về thời gian, lệ phí ──
  if (lower.includes('mất bao lâu') || lower.includes('bao nhiêu ngày') || lower.includes('thời gian') || lower.includes('bao lâu')) {
    const currentService = findServiceByKeyword(lower) || PUBLIC_SERVICES.find(s => s.route === currentRoute);
    if (currentService) {
      return {
        intent: 'CHAT',
        message: `⏱ **Thời gian xử lý** của **${currentService.name}**:\n\n• Thời gian dự kiến: **${currentService.processingTime}**\n• Lệ phí: **${currentService.fee}**\n\n📍 Lưu ý: Thời gian có thể thay đổi tùy theo khối lượng hồ sơ tại địa phương.`,
        suggestions: ['Cần chuẩn bị gì?', 'Quy trình các bước', 'Bắt đầu điền form'],
      };
    }
  }

  // ── FAQ: câu hỏi về quy trình ──
  if (lower.includes('quy trình') || lower.includes('các bước') || lower.includes('làm thế nào') || lower.includes('hướng dẫn') || lower.includes('cách') || lower.includes('thủ tục')) {
    const currentService = findServiceByKeyword(lower) || PUBLIC_SERVICES.find(s => s.route === currentRoute);
    if (currentService) {
      const steps = currentService.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return {
        intent: 'CHAT',
        message: `Các bước làm **${currentService.name}**:\n\n${steps}\n\n💡 Tôi có thể tự động điền form cho bạn từ giọng nói hoặc ảnh CCCD!`,
        suggestions: ['Điền bằng giọng nói', 'Upload ảnh CCCD', 'Nút nộp hồ sơ ở đâu?'],
      };
    }
  }

  // ── Navigate: muốn làm dịch vụ gì ──
  const navKeywords = ['muốn', 'cần', 'làm', 'đăng ký', 'thực hiện', 'đến trang', 'chuyển trang'];
  const isNavIntent = navKeywords.some(k => lower.includes(k));
  const service = findServiceByKeyword(lower);
  if (service && isNavIntent) {
    return {
      intent: 'NAVIGATE',
      message: `Tôi tìm thấy dịch vụ **${service.name}** phù hợp! 🎯\n\nBạn có muốn tôi chuyển đến trang đăng ký luôn không?`,
      data: { route: service.route, serviceName: service.name },
      suggestions: ['Đồng ý, chuyển ngay!', 'Cho tôi biết cần chuẩn bị gì trước', 'Không cần, tôi tự vào'],
    };
  }

  // ── Thao tác UI (Upload / Voice) ──
  if (lower.includes('upload') || lower.includes('ảnh cccd') || lower.includes('tải ảnh') || lower.includes('chụp ảnh')) {
    return {
      intent: 'CHAT',
      message: 'Bạn có thể nhấn vào nút **"Tải lên ảnh CCCD"** (biểu tượng camera/ảnh) trên màn hình để hệ thống quét và điền thông tin tự động nhé! 📸',
      suggestions: ['Nút nộp hồ sơ ở đâu?', 'Cần chuẩn bị gì?', 'Quy trình các bước']
    };
  }

  if (lower.includes('giọng nói') || lower.includes('nói thông tin') || lower.includes('đọc thông tin') || lower.includes('micro')) {
    return {
      intent: 'CHAT',
      message: 'Bạn hãy nhấn vào nút **Micro** trên khung chat và đọc thông tin (ví dụ: "Tên tôi là Nguyễn Văn A, sinh ngày 01/01/1990"), tôi sẽ tự động điền vào form! 🎙️',
      suggestions: ['Upload ảnh CCCD', 'Nút nộp hồ sơ ở đâu?']
    };
  }

  // ── Các câu trả lời cảm ơn/xác nhận đơn giản ──
  if (lower === 'cảm ơn!' || lower === 'cảm ơn' || lower.includes('thông tin đúng rồi') || lower.includes('đồng ý') || lower.includes('nộp hồ sơ thôi')) {
    return {
      intent: 'CHAT',
      message: 'Tuyệt vời! Nếu bạn đã kiểm tra kỹ thông tin, hãy nhấn nút **Nộp Hồ Sơ** để hoàn tất nhé. Chúc bạn một ngày tốt lành! 😊',
      suggestions: ['Nút nộp ở đâu?', 'Đăng ký dịch vụ khác']
    };
  }

  if (lower.includes('cần sửa lại') || lower.includes('sửa thông tin') || lower.includes('chưa điền xong')) {
    return {
      intent: 'CHAT',
      message: 'Bạn cứ thoải mái chỉnh sửa trực tiếp trên biểu mẫu, hoặc đọc thông tin đúng cho tôi để tôi điền lại giúp bạn nhé! ✍️',
      suggestions: ['Điền bằng giọng nói', 'Nút nộp ở đâu?']
    };
  }

  // ── Default ──
  const onServicePage = PUBLIC_SERVICES.find(s => s.route === currentRoute);
  if (onServicePage) {
    return {
      intent: 'CHAT',
      message: `Tôi thấy bạn đang ở trang **${onServicePage.name}**! 📋\n\nTôi có thể giúp bạn:\n• Nói thông tin → tôi tự điền form\n• Upload ảnh CCCD → tự động nhập\n• Hỏi về giấy tờ cần chuẩn bị\n• Chỉ vị trí các nút trên trang\n\nBạn muốn bắt đầu từ đâu?`,
      suggestions: ['Điền bằng giọng nói', 'Upload ảnh CCCD', 'Cần chuẩn bị gì?', 'Nút nộp ở đâu?'],
    };
  }

  return {
    intent: 'CHAT',
    message: `Xin chào! Tôi là **Trợ lý AI Dịch Vụ Công** 🤖\n\nTôi có thể giúp bạn:\n• 📝 Tư vấn thủ tục hành chính\n• ✍️ Tự động điền form từ giọng nói\n• 📷 Đọc thông tin từ ảnh CCCD\n• 💡 Chỉ dẫn vị trí các nút trên trang\n\nBạn cần hỗ trợ gì hôm nay?`,
    suggestions: ['Đăng ký khai sinh', 'Làm hộ khẩu mới', 'Cấp lại CCCD', 'Đăng ký kết hôn'],
  };
};

// ============================================================
// ---- OPENAI Tool Calling (LLM thật) ----
// ============================================================
const callOpenAIWithTools = async (
  userText: string,
  history: ConversationMessage[],
  currentRoute: string
): Promise<AgentEvent> => {
  const tools = buildAgentTools(currentRoute, PUBLIC_SERVICES);

  // Dynamic context: trang hiện tại và danh sách element IDs
  const currentService = PUBLIC_SERVICES.find(s => s.route === currentRoute);
  const elementContext = currentService
    ? `Người dùng đang ở trang "${currentService.name}" (${currentRoute}). Các field trong form: ${currentService.fields.map(f => `${f.id} (${f.label})`).join(', ')}.`
    : `Người dùng đang ở trang chủ (${currentRoute}).`;

  const systemPrompt = `${AGENT_SYSTEM_PROMPT}\n\n[CONTEXT TRANG HIỆN TẠI]\n${elementContext}`;

  // Build messages array with proper history
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-8).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userText },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'required', // AI bắt buộc phải chọn 1 tool
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  // Parse tool_call từ response
  const toolCall = choice?.message?.tool_calls?.[0];
  if (!toolCall) {
    // Fallback: nếu model trả về text thường (không dùng tool)
    const content = choice?.message?.content ?? 'Xin lỗi, có lỗi xảy ra.';
    return { type: 'CHAT', message: content, suggestions: [] };
  }

  const toolName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments ?? '{}');

  console.log(`[Agent] Tool called: ${toolName}`, args);

  return dispatchToolCall(toolName, args);
};

// ============================================================
// Exact FAQ Suggestions — intercept để tiết kiệm token
// ============================================================
const EXACT_FAQ_SUGGESTIONS = new Set([
  'cảm ơn!', 'tôi muốn điền form', 'hướng dẫn thêm', 'chưa điền xong form', 'kiểm tra thông tin giúm',
  'bắt đầu điền form', 'upload ảnh cccd', 'hướng dẫn từng bước', 'cần chuẩn bị gì?', 'quy trình các bước',
  'điền bằng giọng nói', 'nút nộp hồ sơ ở đâu?', 'đồng ý, chuyển ngay!', 'cho tôi biết cần chuẩn bị gì trước',
  'không cần, tôi tự vào', 'thông tin đúng rồi ✓', 'cần sửa lại', 'điền thêm thông tin khác',
  'nộp hồ sơ thôi!', 'sửa thông tin', 'thêm giấy tờ đính kèm', 'nút nộp ở đâu?',
  'đăng ký khai sinh', 'làm hộ khẩu mới', 'cấp lại cccd', 'đăng ký kết hôn',
  'faq', 'câu hỏi thường gặp'
]);

// ============================================================
// SmartbotService — orchestrates all LLM backends
// ============================================================
export class SmartbotService {
  private conversationHistory: ConversationMessage[] = [];
  private currentRoute: string = '/';
  private sessionId: string;

  constructor() {
    this.sessionId = `session_${Date.now()}`;
  }

  setCurrentRoute(route: string) {
    this.currentRoute = route;
  }

  async sendMessage(userText: string): Promise<AIResponse> {
    this.conversationHistory.push({ role: 'user', content: userText });

    let aiResponse: AIResponse;
    const isFAQIntercept = EXACT_FAQ_SUGGESTIONS.has(userText.trim().toLowerCase());

    try {
      if (isFAQIntercept) {
        // Tiết kiệm token — dùng mock cho FAQ cố định
        aiResponse = mockRespond(userText, this.currentRoute);
      } else if (USE_OPENAI) {
        // ✅ OpenAI Tool Calling (chính thức)
        const agentEvent = await callOpenAIWithTools(
          userText,
          this.conversationHistory,
          this.currentRoute
        );

        // Emit event cho Event Bus (UIHighlighter, v.v. lắng nghe trực tiếp)
        agentEventBus.emit(agentEvent);

        // Convert event → AIResponse (để ChatbotContext hiển thị tin nhắn)
        aiResponse = agentEventToAIResponse(agentEvent);
      } else if (VNPT_CONFIG.smartbot.apiKey && VNPT_CONFIG.smartbot.apiKey !== 'MOCK_SMARTBOT_KEY') {
        // VNPT Smartbot fallback (giữ nguyên)
        aiResponse = await this.callVNPTSmartbot(userText);
      } else {
        // Mock (pattern matching) — không có API key nào
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        aiResponse = mockRespond(userText, this.currentRoute);
      }
    } catch (err) {
      console.warn('LLM error, falling back to mock:', err);
      aiResponse = mockRespond(userText, this.currentRoute);
    }

    this.conversationHistory.push({ role: 'assistant', content: aiResponse.message });

    // Giữ tối đa 20 messages trong context
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return aiResponse;
  }

  private async callVNPTSmartbot(userText: string): Promise<AIResponse> {
    const contextualPrompt = `[Context: trang "${this.currentRoute}"][Lịch sử: ${this.conversationHistory.length} messages]\nTin nhắn: ${userText}`;

    const res = await fetch(`${VNPT_CONFIG.smartbot.baseUrl}/chat`, {
      method: 'POST',
      headers: getVNPTHeaders(VNPT_CONFIG.smartbot.apiKey),
      body: JSON.stringify({
        bot_id: VNPT_CONFIG.smartbot.botId,
        session_id: this.sessionId,
        message: contextualPrompt,
        conversation_history: this.conversationHistory.slice(-10),
        system_prompt: AGENT_SYSTEM_PROMPT,
        response_format: 'json',
      }),
    });

    if (!res.ok) throw new Error(`Smartbot API error: ${res.status}`);

    const data = await res.json();
    const rawText = data.result || data.response || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as AIResponse;

    return { intent: 'CHAT', message: rawText, suggestions: ['Tiếp tục', 'Hỗ trợ thêm'] };
  }

  clearHistory() {
    this.conversationHistory = [];
    this.sessionId = `session_${Date.now()}`;
  }

  getBackendInfo(): string {
    if (USE_OPENAI) return '🟢 OpenAI GPT-4o-mini · Tool Calling';
    if (!IS_MOCK_MODE) return '🟢 VNPT Smartbot LLM';
    return '🟡 Mock Mode (pattern matching — thêm VITE_OPENAI_API_KEY để dùng AI thật)';
  }
}

export const smartbotService = new SmartbotService();
