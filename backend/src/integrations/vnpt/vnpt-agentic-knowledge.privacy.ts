import { AppError } from '../../common/errors/app-error.js';
import { normalizeText } from '../../common/utils/normalize-text.js';
import type {
  KnowledgeProviderRequest,
  KnowledgeType,
  KnownPiiType,
  KnownPiiValue,
} from '../../modules/assistant/knowledge.types.js';

const MAX_REDACTED_QUESTION_LENGTH = 4_000;
export const MAX_VNPT_TEXT_LENGTH = 6_000;

const LOCALITY_SENSITIVE_KNOWLEDGE_TYPES = new Set<KnowledgeType>([
  'eligibility',
  'conditions',
  'documents',
  'process',
  'submission_method',
  'receiving_authority',
  'processing_time',
  'fees',
  'special_case',
]);

const PLACEHOLDERS: Record<KnownPiiType, string> = {
  cccd: '<CCCD>',
  phone: '<PHONE>',
  email: '<EMAIL>',
  person_name: '<PERSON_NAME>',
  specific_address: '<SPECIFIC_ADDRESS>',
  date_of_birth: '<DATE_OF_BIRTH>',
  other_identifier: '<OTHER_IDENTIFIER>',
};

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'formvalues',
  'formsnapshot',
  'knownfields',
  'recentchanges',
  'missingfields',
  'missingrequiredfields',
  'recentocrfacts',
  'rawocr',
  'attachment',
  'attachments',
  'file',
  'filepath',
  'storagepath',
  'application',
  'databaserecord',
  'pendingactions',
  'formschema',
  'assistantcontext',
  'systemprompt',
  'advanceprompt',
  'history',
  'chathistory',
  'accesstoken',
  'apikey',
]);

export interface VnptKnowledgeOutboundDto {
  knowledgeType: KnowledgeType;
  procedure: {
    id: string;
    name: string;
  } | null;
  selectedCase: string | null;
  screen: string | null;
  fieldLabel: string | null;
  locality: string | null;
  redactedQuestion: string;
}

export interface VnptConversationPayload {
  bot_id: string;
  sender_id: string;
  text: string;
  input_channel: 'livechat';
  session_id: string;
  metadata: Record<string, never>;
  settings: {
    enable_chunk_stream: 1;
  };
  stream: '1';
  tts_model: 'news';
  tts_region: 'female_north';
  user_auth_level: 2;
}

export class OutboundDataPolicyError extends AppError {
  constructor() {
    super(
      400,
      'OUTBOUND_DATA_POLICY_VIOLATION',
      'Yêu cầu tra cứu không vượt qua chính sách bảo vệ dữ liệu outbound.',
    );
  }
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exactValuePattern = (value: string, global: boolean): RegExp => {
  const flexibleWhitespace = value
    .trim()
    .split(/\s+/u)
    .map(escapeRegExp)
    .join('\\s+');
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${flexibleWhitespace}(?![\\p{L}\\p{N}])`,
    global ? 'giu' : 'iu',
  );
};

const replacePattern = (
  value: string,
  pattern: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
  maskedTypes: Set<KnownPiiType>,
  type: KnownPiiType,
): string => value.replace(pattern, (...args: [string, ...string[]]) => {
  maskedTypes.add(type);
  if (typeof replacement === 'string') return replacement;
  return replacement(...args);
});

const replaceKnownPii = (
  question: string,
  knownPii: KnownPiiValue[],
  maskedTypes: Set<KnownPiiType>,
): string => {
  const ordered = [...knownPii]
    .map(({ type, value }) => ({ type, value: value.trim() }))
    .filter(({ value }) => value.length >= 2)
    .sort((left, right) => right.value.length - left.value.length);

  return ordered.reduce((current, known) => {
    const pattern = exactValuePattern(known.value, true);
    if (!pattern.test(current)) return current;
    pattern.lastIndex = 0;
    maskedTypes.add(known.type);
    return current.replace(pattern, PLACEHOLDERS[known.type]);
  }, question);
};

const neutralizeInjectedHeaders = (question: string): string =>
  question
    .replace(/\[\s*(?:NGỮ\s+CẢNH|NGU\s+CANH)\s+GOVBRIDGE\s*\]/giu, '')
    .replace(/\[\s*(?:CÂU\s+HỎI|CAU\s+HOI)\s+CỦA\s+NGƯỜI\s+DÂN\s*\]/giu, '')
    .replace(/\[\s*CAU\s+HOI\s+CUA\s+NGUOI\s+DAN\s*\]/giu, '');

export interface RedactedKnowledgeQuestion {
  question: string;
  maskedTypes: KnownPiiType[];
}

export const redactKnowledgeQuestion = (
  rawQuestion: string,
  knownPii: KnownPiiValue[],
): RedactedKnowledgeQuestion => {
  const maskedTypes = new Set<KnownPiiType>();
  let question = neutralizeInjectedHeaders(rawQuestion.replace(/\r\n?/g, '\n'));
  question = replaceKnownPii(question, knownPii, maskedTypes);
  question = replacePattern(
    question,
    /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/giu,
    '<EMAIL>',
    maskedTypes,
    'email',
  );
  question = replacePattern(
    question,
    /(?<!\d)(?:\+84(?:[\s.-]*\d){9}|0(?:[\s.-]*\d){9,10})(?![\s.-]*\d)/gu,
    '<PHONE>',
    maskedTypes,
    'phone',
  );
  question = replacePattern(
    question,
    /(?<!\d)(?:\d[\s.-]*){11}\d(?![\s.-]*\d)|(?<!\d)(?:\d[\s.-]*){8}\d(?![\s.-]*\d)/gu,
    '<CCCD>',
    maskedTypes,
    'cccd',
  );
  question = replacePattern(
    question,
    /(\b(?:tôi\s+tên(?:\s+là)?|tên\s+của\s+tôi(?:\s+là)?|tên\s+tôi(?:\s+là)?|họ\s+tên(?:\s+của\s+tôi)?(?:\s+là)?)\s*[:\-]?\s+)([\p{L}]+(?:[\s'-]+[\p{L}]+){1,5}?)(?=\s*(?:[,.;?!\n]|$|\b(?:và|muốn|cần|đang|xin|hỏi|sống|ở)\b))/giu,
    (_match, prefix) => `${prefix}<PERSON_NAME>`,
    maskedTypes,
    'person_name',
  );
  question = replacePattern(
    question,
    /((?:địa\s+chỉ(?:\s+(?:nhà|của\s+tôi))?(?:\s+là)?|số\s+nhà|tôi\s+(?:đang\s+)?ở\s+tại)\s*[:\-]?\s+)([^.;?!\n]+?)(?=\s*(?:,\s*(?:cần|muốn|xin|hỏi|thì|tôi|nộp|làm|đăng\s+ký)\b|[.;?!\n]|$))/giu,
    (_match, prefix) => `${prefix}<SPECIFIC_ADDRESS>`,
    maskedTypes,
    'specific_address',
  );
  question = replacePattern(
    question,
    /(\b(?:ngày\s+sinh|sinh\s+ngày)\s*[:\-]?\s*)(\d{1,2}[/.:-]\d{1,2}[/.:-]\d{2,4})/giu,
    (_match, prefix) => `${prefix}<DATE_OF_BIRTH>`,
    maskedTypes,
    'date_of_birth',
  );
  question = replacePattern(
    question,
    /(\b(?:số\s+hộ\s+chiếu|hộ\s+chiếu|mã\s+số\s+thuế|mã\s+bảo\s+hiểm)\s*[:\-]?\s*)[A-Z0-9.-]{5,20}\b/giu,
    (_match, prefix) => `${prefix}<OTHER_IDENTIFIER>`,
    maskedTypes,
    'other_identifier',
  );
  question = question
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]+/gu, '<FILE_REFERENCE>')
    .replace(/(?:\/(?:uploads?|storage|tmp|files?))(?:\/[^\s/]+)+/giu, '<FILE_REFERENCE>')
    .replace(/https?:\/\/\S+/giu, '<FILE_REFERENCE>')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{2,}/gu, '\n')
    .trim()
    .slice(0, MAX_REDACTED_QUESTION_LENGTH)
    .trim();

  if (!question) throw new OutboundDataPolicyError();
  return {
    question,
    maskedTypes: [...maskedTypes].sort(),
  };
};

const safeValue = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed || normalizeText(trimmed) === 'khong xac dinh') return null;
  return trimmed;
};

export interface PreparedVnptKnowledgeOutbound {
  dto: VnptKnowledgeOutboundDto;
  maskedTypes: KnownPiiType[];
}

export const prepareVnptKnowledgeOutbound = (
  request: KnowledgeProviderRequest,
): PreparedVnptKnowledgeOutbound => {
  try {
    const redacted = redactKnowledgeQuestion(
      request.query.question,
      request.privacy.knownPii,
    );
    const procedureId = safeValue(request.query.procedureHint?.id);
    const procedureName = safeValue(request.query.procedureHint?.name);
    const procedure = procedureId && procedureName
      ? { id: procedureId, name: procedureName }
      : null;
    const step = Number.isInteger(request.currentStep) && (request.currentStep ?? 0) > 0
      ? `bước ${request.currentStep}`
      : null;

    return {
      dto: {
        knowledgeType: request.query.knowledgeType,
        procedure,
        selectedCase: safeValue(request.query.selectedCaseHint),
        screen: step,
        fieldLabel: safeValue(request.query.fieldContext?.fieldLabel),
        locality: LOCALITY_SENSITIVE_KNOWLEDGE_TYPES.has(request.query.knowledgeType)
          ? safeValue(request.query.locality)
          : null,
        redactedQuestion: redacted.question,
      },
      maskedTypes: redacted.maskedTypes,
    };
  } catch (error) {
    if (error instanceof OutboundDataPolicyError) throw error;
    throw new OutboundDataPolicyError();
  }
};

const assertNoForbiddenKeys = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_PAYLOAD_KEYS.has(normalizedKey)) throw new OutboundDataPolicyError();
    assertNoForbiddenKeys(nested);
  }
};

const countExact = (value: string, needle: string): number =>
  value.split(needle).length - 1;

const containsKnownPii = (text: string, knownPii: KnownPiiValue[]): boolean =>
  knownPii.some(({ value }) => {
    const trimmed = value.trim();
    return trimmed.length >= 2 && exactValuePattern(trimmed, false).test(text);
  });

const containsUnredactedDirectPii = (text: string): boolean =>
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/iu.test(text)
  || /(?<!\d)(?:\+84(?:[\s.-]*\d){9}|0(?:[\s.-]*\d){9,10})(?![\s.-]*\d)/u.test(text)
  || /(?<!\d)(?:\d[\s.-]*){11}\d(?![\s.-]*\d)/u.test(text)
  || /(?<!\d)(?:\d[\s.-]*){8}\d(?![\s.-]*\d)/u.test(text);

export const assertSafeVnptOutboundPayload = (
  payload: VnptConversationPayload,
  knownPii: KnownPiiValue[],
): void => {
  assertNoForbiddenKeys(payload);
  const exactKeys = Object.keys(payload).sort().join(',');
  if (
    exactKeys !== 'bot_id,input_channel,metadata,sender_id,session_id,settings,stream,text,tts_model,tts_region,user_auth_level'
    || payload.input_channel !== 'livechat'
    || Object.keys(payload.metadata).length !== 0
    || payload.settings.enable_chunk_stream !== 1
    || Object.keys(payload.settings).join(',') !== 'enable_chunk_stream'
    || payload.stream !== '1'
    || payload.tts_model !== 'news'
    || payload.tts_region !== 'female_north'
    || payload.user_auth_level !== 2
    || !/^(?:[A-Za-z0-9_-]{8,128}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/u.test(payload.sender_id)
    || !/^[A-Za-z0-9_-]{8,128}$/u.test(payload.session_id)
    || payload.text.length > MAX_VNPT_TEXT_LENGTH
    || countExact(payload.text, '[NGỮ CẢNH GOVBRIDGE]') !== 1
    || countExact(payload.text, '[CÂU HỎI CỦA NGƯỜI DÂN]') !== 1
    || containsKnownPii(payload.text, knownPii)
    || containsUnredactedDirectPii(payload.text)
    || /\b[A-Za-z]:\\|\/(?:uploads?|storage|tmp|files?)\//iu.test(payload.text)
  ) {
    throw new OutboundDataPolicyError();
  }
};
