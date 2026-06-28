import type { AssistantResult, AssistantTool, AssistantToolContext } from '../assistant.types.js';
import { findRelevantProcedure, hasAny } from './tool-utils.js';

export class ServiceInfoTool implements AssistantTool {
  readonly name = 'service-info';

  canHandle(context: AssistantToolContext): boolean {
    return hasAny(context.normalizedMessage, [
      'giấy tờ', 'chuẩn bị', 'hồ sơ cần', 'mất bao lâu', 'bao nhiêu ngày',
      'thời gian', 'lệ phí', 'bao nhiêu tiền', 'quy trình', 'các bước', 'hướng dẫn',
    ]);
  }

  execute(context: AssistantToolContext): AssistantResult {
    const procedure = findRelevantProcedure(context);
    if (!procedure) {
      return {
        response: {
          intent: 'CLARIFY',
          message: 'Bạn muốn hỏi thông tin của thủ tục nào?',
          suggestions: context.procedures.slice(0, 4).map((item) => item.shortName),
        },
        actions: [],
      };
    }

    let message: string;
    if (hasAny(context.normalizedMessage, ['giấy tờ', 'chuẩn bị', 'hồ sơ cần'])) {
      message = '**' + procedure.name + '** cần:\n' + procedure.requiredDocs.map((doc) => '• ' + doc).join('\n');
    } else if (hasAny(context.normalizedMessage, ['mất bao lâu', 'bao nhiêu ngày', 'thời gian', 'lệ phí', 'bao nhiêu tiền'])) {
      message = '**' + procedure.name + '**\n• Thời gian: ' + procedure.processingTime + '\n• Lệ phí: ' + procedure.fee;
    } else {
      message = 'Quy trình **' + procedure.name + '**:\n' + procedure.steps.map((step, index) => (index + 1) + '. ' + step).join('\n');
    }

    return {
      response: { intent: 'CHAT', message, suggestions: ['Bắt đầu điền form', 'Cần chuẩn bị gì?', 'Thời gian xử lý'] },
      actions: [],
    };
  }
}
