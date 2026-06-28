import type { AssistantResult, AssistantTool, AssistantToolContext } from '../assistant.types.js';
import { hasAny } from './tool-utils.js';

export class NextStepTool implements AssistantTool {
  readonly name = 'next-step';

  canHandle(context: AssistantToolContext): boolean {
    return Boolean(context.currentProcedure)
      && hasAny(context.normalizedMessage, ['sang bước tiếp', 'bước tiếp theo', 'tiếp tục bước', 'next step']);
  }

  execute(context: AssistantToolContext): AssistantResult {
    const procedure = context.currentProcedure!;
    const routeStep = context.currentRoute.match(/\/buoc-(\d+)\/?$/)?.[1];
    const currentStep = routeStep ? Number(routeStep) : 1;
    const maxStep = Math.max(1, ...procedure.fields.map((field) => field.step ?? 1));
    const currentFields = procedure.fields.filter((field) => (field.step ?? 1) === currentStep);
    const missingFields = currentFields.filter(
      (field) => field.required && !context.formValues[field.id]?.trim(),
    );

    if (missingFields.length > 0) {
      return {
        response: {
          intent: 'VALIDATE',
          message: 'Bạn cần hoàn thành các ô bắt buộc của bước hiện tại trước khi chuyển tiếp.',
          data: {
            validationErrors: missingFields.map((field) => ({
              field: field.id,
              label: field.label,
              message: 'Vui lòng nhập ' + field.label.toLowerCase() + '.',
              severity: 'error',
            })),
          },
          suggestions: ['Điền thông tin còn thiếu', 'Kiểm tra lại bước này'],
        },
        actions: [],
      };
    }

    if (currentStep >= maxStep) {
      return {
        response: {
          intent: 'CHAT',
          message: 'Bạn đang ở bước cuối. Hãy kiểm tra toàn bộ thông tin và tự bấm Nộp hồ sơ khi đã sẵn sàng.',
          suggestions: ['Kiểm tra thông tin', 'Nút nộp hồ sơ ở đâu?'],
        },
        actions: [],
      };
    }

    const requestedStep = context.normalizedMessage.match(/buoc\s+(\d+)/)?.[1];
    const targetStep = Math.min(
      maxStep,
      Math.max(currentStep + 1, requestedStep ? Number(requestedStep) : currentStep + 1),
    );
    const message = 'Thông tin bắt buộc của bước hiện tại đã đủ. Mình sẽ chuyển sang bước ' + targetStep + '.';
    return {
      response: { intent: 'CHAT', message, suggestions: ['Kiểm tra thông tin', 'Quay lại bước trước'] },
      actions: [{ type: 'NEXT_STEP', step: targetStep, message }],
    };
  }
}
