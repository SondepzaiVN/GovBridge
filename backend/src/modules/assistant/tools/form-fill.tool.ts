import type { AssistantTool, AssistantToolContext, OrchestratorFinalResult } from '../assistant.types.js';
import { escapeRegExp } from './tool-utils.js';

const extractFields = (context: AssistantToolContext): Record<string, string> => {
  if (!context.currentProcedure) return {};
  const values: Record<string, string> = {};
  for (const field of context.currentProcedure.fields) {
    const pattern = new RegExp('(?:^|[,;\\n]\\s*)' + escapeRegExp(field.id) + '\\s*[:=]\\s*([^,;\\n]+)', 'i');
    const value = context.message.match(pattern)?.[1]?.trim();
    if (value) values[field.id] = value;
  }
  return values;
};

export class FormFillTool implements AssistantTool {
  readonly name = 'form-fill';
  canHandle(context: AssistantToolContext): boolean { return Object.keys(extractFields(context)).length > 0; }

  execute(context: AssistantToolContext): OrchestratorFinalResult {
    const fields = extractFields(context);
    const message = 'Mình đã nhận ' + Object.keys(fields).length + ' trường thông tin từ nội dung bạn gửi.';
    const suggestions = ['Kiểm tra thông tin', 'Tiếp tục bước tiếp theo'];
    return {
      response: { intent: 'CHAT', message, suggestions },
      actions: [],
      understanding: {
        facts: Object.entries(fields).map(([fieldHint, value]) => ({
          fieldHint,
          value,
          confidence: 1,
          source: 'chat',
        })),
        caseSuggestion: null,
        followUpQuestion: null,
        fieldExplanation: null,
      },
    };
  }
}
