import { normalizeText } from '../../common/utils/normalize-text.js';
import type { ProcedureField } from '../procedures/procedure.types.js';
import type {
  AgentAction,
  OrchestratorFinalResult,
  AssistantResult,
  AssistantToolContext,
  ExtractedFact,
} from './assistant.types.js';
import { NextStepTool } from './tools/next-step.tool.js';

const MIN_FILL_CONFIDENCE = 0.8;
type ConfirmFillAction = Extract<AgentAction, { type: 'REQUEST_CONFIRM_FILL' }>;

// Các giá trị này do hệ thống hoặc logic nghiệp vụ của biểu mẫu quản lý.
const SYSTEM_MANAGED_FIELDS = new Set([
  'thuTuc',
  'coQuanDKCT',
  'sdtCoQuan',
  'noiDungDN',
]);

const normalizeDate = (value: string): string => {
  const trimmed = value.trim();
  const vietnameseDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!vietnameseDate) return trimmed;
  return [
    vietnameseDate[3],
    vietnameseDate[2]?.padStart(2, '0'),
    vietnameseDate[1]?.padStart(2, '0'),
  ].join('-');
};

const normalizePhone = (value: string): string => {
  const compact = value.replace(/[\s.()-]/g, '');
  return compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
};

const findField = (fact: ExtractedFact, fields: ProcedureField[]): ProcedureField | null => {
  const normalizedHint = normalizeText(fact.fieldHint).replace(/\s+/g, '');
  return fields.find((field) =>
    field.id === fact.fieldHint
    || normalizeText(field.id).replace(/\s+/g, '') === normalizedHint
    || normalizeText(field.label).replace(/\s+/g, '') === normalizedHint,
  ) ?? null;
};

const normalizeSelectValue = (field: ProcedureField, value: string): string | null => {
  if (!field.options?.length) return value.trim();
  const normalizedValue = normalizeText(value);
  const option = field.options.find((candidate) =>
    normalizeText(candidate.value) === normalizedValue
    || normalizeText(candidate.label) === normalizedValue,
  );
  return option?.value ?? null;
};

const normalizeAndValidateValue = (field: ProcedureField, rawValue: string): string | null => {
  let value = rawValue.trim();
  if (!value) return null;

  if (field.type === 'date') value = normalizeDate(value);
  if (field.type === 'phone') value = normalizePhone(value);
  if (field.type === 'select' || field.type === 'radio') {
    const selectedValue = normalizeSelectValue(field, value);
    if (!selectedValue) return null;
    value = selectedValue;
  }

  if (field.type === 'date') {
    const timestamp = Date.parse(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(timestamp) || timestamp > Date.now()) {
      return null;
    }
  }

  if (field.type === 'phone' && !/^0[3-9]\d{8}$/.test(value)) return null;
  if (normalizeText(field.id).includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return null;
  }
  if (normalizeText(field.id).includes('hoten')) {
    if (value.split(/\s+/).length < 2 || /[\d!@#$%^&*()_+=[\]{};:"\\|,.<>/?]/u.test(value)) {
      return null;
    }
  }
  if (field.validation?.minLength && value.length < field.validation.minLength) return null;
  if (field.validation?.maxLength && value.length > field.validation.maxLength) return null;

  if (field.validation?.pattern) {
    try {
      if (!new RegExp(field.validation.pattern).test(value)) return null;
    } catch {
      return null;
    }
  }

  return value;
};

const createConfirmAction = (
  context: AssistantToolContext,
  fields: Record<string, string>,
  fieldLabels: Record<string, string>,
): ConfirmFillAction => {
  const previousValues = Object.fromEntries(
    Object.keys(fields)
      .filter((fieldId) => context.formContext.knownFields[fieldId])
      .map((fieldId) => [fieldId, context.formContext.knownFields[fieldId] ?? '']),
  );
  const fieldCount = Object.keys(fields).length;

  return {
    type: 'REQUEST_CONFIRM_FILL',
    fields,
    fieldLabels,
    previousValues,
    message: `Mình đã nhận diện ${fieldCount} thông tin. Bạn kiểm tra bản xem trước rồi xác nhận để điền vào biểu mẫu nhé.`,
    suggestions: ['Giải thích các trường này', 'Tôi muốn sửa thông tin'],
  };
};

const mergeSuggestions = (
  primary: string[] | undefined,
  secondary: string[] | undefined,
): string[] | undefined => {
  const suggestions = [...new Set([
    ...(primary ?? []),
    ...(secondary ?? []),
  ])].slice(0, 3);
  return suggestions.length > 0 ? suggestions : undefined;
};

const mergeConfirmationMessage = (
  finalMessage: string,
  confirmationMessage: string,
): string => {
  const composed = finalMessage.trim();
  if (!composed) return confirmationMessage;
  if (composed.includes(confirmationMessage)) return composed;
  return `${composed}\n\n${confirmationMessage}`;
};

export const planAssistantResult = (
  context: AssistantToolContext,
  providerResult: OrchestratorFinalResult,
): AssistantResult => {
  const understanding = providerResult.understanding;
  if (!understanding) {
    return {
      response: providerResult.response,
      actions: providerResult.actions,
    };
  }

  let finalIntent = providerResult.response.intent;
  let finalMessage = providerResult.response.message;
  let finalSuggestions = providerResult.response.suggestions;
  let finalData = providerResult.response.data;
  const actions = [...providerResult.actions];

  // 1. Handle Navigation
  if (understanding.navigationRoute) {
    const targetProcedure = context.procedures.find((p) => p.route === understanding.navigationRoute);
    if (targetProcedure) {
      actions.push({
        type: 'NAVIGATE',
        route: targetProcedure.route,
        serviceName: targetProcedure.name,
        message: finalMessage,
      });
      finalIntent = 'NAVIGATE';
      finalData = { ...finalData, route: targetProcedure.route, serviceName: targetProcedure.name };
      // Nếu đã chuyển trang, không cần xử lý điền form cũ
      return {
        response: { 
          intent: finalIntent, 
          message: finalMessage, 
          ...(finalData ? { data: finalData } : {}),
          ...(finalSuggestions ? { suggestions: finalSuggestions } : {}),
        },
        actions,
      };
    }
  }

  // 1.5 Handle Highlight
  if (understanding.highlightElementId) {
    actions.push({
      type: 'HIGHLIGHT_ELEMENT',
      elementId: understanding.highlightElementId,
      message: finalMessage,
    });
    finalIntent = 'HIGHLIGHT';
    finalData = { ...finalData, elementId: understanding.highlightElementId };
    return {
      response: { 
        intent: finalIntent, 
        message: finalMessage, 
        ...(finalData ? { data: finalData } : {}),
        ...(finalSuggestions ? { suggestions: finalSuggestions } : {}),
      },
      actions,
    };
  }

  // Nếu không có procedure hiện tại thì không thể next step hay fill form
  if (!context.currentProcedure) {
    const followUp = understanding.followUpQuestion?.trim();
    if (followUp) {
      finalIntent = 'CLARIFY';
      finalMessage = `${finalMessage.trim()}\n\n${followUp}`.trim();
    }
    return {
      response: { 
        intent: finalIntent, 
        message: finalMessage, 
        ...(finalData ? { data: finalData } : {}),
        ...(finalSuggestions ? { suggestions: finalSuggestions } : {}),
      },
      actions,
    };
  }

  // 2. Handle Next Step
  if (understanding.nextStepRequested) {
    const nextStepTool = new NextStepTool();
    const nextResult = nextStepTool.execute(context);
    if (nextResult.response.intent === 'VALIDATE') {
      return nextResult; // Lỗi validate thì dừng ngay
    } else {
      actions.push(...nextResult.actions);
      finalSuggestions = mergeSuggestions(finalSuggestions, nextResult.response.suggestions);
    }
  }

  // 3. Handle Form Fill
  const fields: Record<string, string> = {};
  const fieldLabels: Record<string, string> = {};

  for (const fact of understanding.facts) {
    if (fact.confidence < MIN_FILL_CONFIDENCE) continue;
    if (fact.source !== 'chat' && fact.source !== 'ocr') continue;
    const field = findField(fact, context.currentProcedure.fields);
    if (!field || SYSTEM_MANAGED_FIELDS.has(field.id)) continue;
    const value = normalizeAndValidateValue(field, fact.value);
    if (!value || context.formContext.knownFields[field.id] === value) continue;
    fields[field.id] = value;
    fieldLabels[field.id] = field.label;
  }

  if (Object.keys(fields).length > 0) {
    const action = createConfirmAction(context, fields, fieldLabels);
    finalSuggestions = mergeSuggestions(finalSuggestions, action.suggestions);
    finalIntent = 'CLARIFY';
    finalMessage = providerResult.responseProvenance === 'knowledge_composer'
      ? mergeConfirmationMessage(finalMessage, action.message)
      : action.message;
    finalData = { ...finalData, fields, fieldLabels, previousValues: action.previousValues };
    actions.push(action);
  } else {
    // 4. Handle followUp (nếu không có form fill)
    const followUp = understanding.followUpQuestion?.trim();
    if (followUp) {
      finalIntent = 'CLARIFY';
      finalMessage = `${finalMessage.trim()}\n\n${followUp}`.trim();
    }
  }

  return {
    response: {
      intent: finalIntent,
      message: finalMessage,
      ...(finalData ? { data: finalData } : {}),
      ...(finalSuggestions ? { suggestions: finalSuggestions } : {}),
    },
    actions,
  };
};
