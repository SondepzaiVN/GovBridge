import type { AssistantResult, AssistantTool, AssistantToolContext } from '../assistant.types.js';
import { findRelevantProcedure, hasAny } from './tool-utils.js';

export class NavigationTool implements AssistantTool {
  readonly name = 'navigation';

  canHandle(context: AssistantToolContext): boolean {
    return Boolean(findRelevantProcedure(context)) && hasAny(context.normalizedMessage, [
      'muốn làm', 'đăng ký', 'đến trang', 'chuyển trang', 'mở thủ tục',
    ]);
  }

  execute(context: AssistantToolContext): AssistantResult {
    const procedure = findRelevantProcedure(context)!;
    const message = 'Mình tìm thấy thủ tục **' + procedure.name + '**. Bạn có muốn chuyển đến trang này không?';
    const suggestions = ['Đồng ý, chuyển ngay!', 'Cho tôi biết cần chuẩn bị gì trước', 'Không cần'];
    return {
      response: { intent: 'NAVIGATE', message, data: { route: procedure.route, serviceName: procedure.name }, suggestions },
      actions: [{ type: 'NAVIGATE', route: procedure.route, serviceName: procedure.name, message, suggestions }],
    };
  }
}
