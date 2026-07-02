import { normalizeText } from '../../common/utils/normalize-text.js';
import type { ProcedureField } from '../procedures/procedure.types.js';
import type {
  AgentAction,
  OrchestratorFinalResult,
  AssistantResult,
  AssistantToolContext,
  ExtractedFact,
} from './assistant.types.js';

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
  const normalizedHint = normalizeText(fact.fieldHint);
  return fields.find((field) =>
    field.id === fact.fieldHint
    || normalizeText(field.id) === normalizedHint
    || normalizeText(field.label) === normalizedHint,
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
  if (!understanding || !context.currentProcedure) {
    return {
      response: providerResult.response,
      actions: providerResult.actions,
    };
  }

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
    const suggestions = mergeSuggestions(
      providerResult.response.suggestions,
      action.suggestions,
    );
    return {
      response: {
        intent: 'CLARIFY',
        message: providerResult.responseProvenance === 'knowledge_composer'
          ? mergeConfirmationMessage(
              providerResult.response.message,
              action.message,
            )
          : action.message,
        data: { fields, fieldLabels, previousValues: action.previousValues },
        ...(suggestions ? { suggestions } : {}),
      },
      actions: [action],
    };
  }

  const followUp = understanding.followUpQuestion?.trim();
  const message = followUp
    ? `${providerResult.response.message.trim()}\n\n${followUp}`.trim()
    : providerResult.response.message;

  return {
    response: {
      ...providerResult.response,
      intent: followUp ? 'CLARIFY' : providerResult.response.intent,
      message,
    },
    actions: providerResult.actions,
  };
};
