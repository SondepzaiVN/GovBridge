import type { AssistantResult, AssistantTool, AssistantToolContext } from '../assistant.types.js';

export class FallbackTool implements AssistantTool {
  readonly name = 'fallback';
  canHandle(): boolean { return true; }

  execute(context: AssistantToolContext): AssistantResult {
    const message = context.currentProcedure
      ? 'Bạn đang ở thủ tục **' + context.currentProcedure.name + '**. Mình có thể giải thích giấy tờ, quy trình, chỉ bước tiếp theo hoặc điền field theo dạng fieldId: giá trị.'
      : 'Mình có thể giúp bạn tìm thủ tục, xem giấy tờ cần chuẩn bị, thời gian xử lý và hướng dẫn điền biểu mẫu.';
    return {
      response: { intent: 'CHAT', message, suggestions: ['Đăng ký khai sinh', 'Liên thông khai sinh', 'Cần chuẩn bị gì?'] },
      actions: [],
    };
  }
}
