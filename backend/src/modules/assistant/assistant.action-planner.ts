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

const isExplicitNextStepRequest = (normalizedMessage: string): boolean => [
  /\btiep tuc\b/u,
  /\bsang buoc (?:sau|tiep theo)\b/u,
  /\bdi tiep\b/u,
  /\bbuoc (?:ke tiep|tiep theo)\b/u,
  /\bxong buoc nay\b/u,
  /\bqua buoc (?:sau|tiep theo)\b/u,
].some((pattern) => pattern.test(normalizedMessage));

const inferUiHighlightElement = (normalizedMessage: string): string | null => {
  const asksForUiLocation = /\b(?:o dau|cho nao|vi tri|tim|nam dau|bam dau|an dau|chon dau)\b/u
    .test(normalizedMessage);
  const mentionsUiControl = /\b(?:nut|bam|an|chon|click)\b/u.test(normalizedMessage);
  const mentionsDossier = /\bho so\b/u.test(normalizedMessage);
  const mentionsSubmitAction = /\b(?:nop|gui)\b/u.test(normalizedMessage);
  const asksForSubmitButton = asksForUiLocation
    && mentionsUiControl
    && mentionsDossier
    && (mentionsSubmitAction || /\bnut\b/u.test(normalizedMessage));
  return asksForSubmitButton ? 'submit-btn' : null;
};

const normalizeRouteForComparison = (route: string): string => {
  const cleanRoute = (route.split(/[?#]/u)[0] ?? '')
    .replace(/\/buoc-\d+\/?$/u, '')
    .replace(/\/+$/u, '');
  return cleanRoute || '/';
};

const isSameRoute = (left: string, right: string): boolean =>
  normalizeRouteForComparison(left) === normalizeRouteForComparison(right);

// Các giá trị này do hệ thống hoặc logic nghiệp vụ của biểu mẫu quản lý.
const SYSTEM_MANAGED_FIELDS = new Set([
  'thuTuc',
  'coQuanDKCT',
  'sdtCoQuan',
  'noiDungDN',
]);

const ADMINISTRATIVE_FIELD_IDS = new Set([
  'tinhThanhCQ',
  'xaPhuongCQ',
  'tinhThanhDN',
  'xaPhuongDN',
  'provinceAgency',
  'wardAgency',
  'requestProvince',
  'requestWard',
  'receiveCityCode',
  'receiveVillageCode',
  'temporaryCityCode',
  'temporaryVillageCode',
  'ltks_tinhKhaiSinh',
  'ltks_phuongKhaiSinh',
  'ltks_tinhThuongTru',
  'ltks_phuongThuongTru',
  'ltks_tinhNguoiYeuCau',
  'ltks_phuongNguoiYeuCau',
  'ltks_tinhNoiSinh',
  'ltks_phuongNoiSinh',
  'ltks_tinhQueQuan',
  'ltks_phuongQueQuan',
  'ltks_tinhMe',
  'ltks_phuongMe',
  'ltks_tinhCha',
  'ltks_phuongCha',
  'ltks_tinhDangKyThuongTru',
  'ltks_phuongDangKyThuongTru',
]);

const ADMINISTRATIVE_FIELD_PAIRS = [
  ['tinhThanhDN', 'xaPhuongDN'],
  ['temporaryCityCode', 'temporaryVillageCode'],
  ['requestProvince', 'requestWard'],
  ['ltks_tinhThuongTru', 'ltks_phuongThuongTru'],
  ['ltks_tinhNguoiYeuCau', 'ltks_phuongNguoiYeuCau'],
  ['ltks_tinhKhaiSinh', 'ltks_phuongKhaiSinh'],
  ['ltks_tinhNoiSinh', 'ltks_phuongNoiSinh'],
  ['ltks_tinhQueQuan', 'ltks_phuongQueQuan'],
  ['ltks_tinhMe', 'ltks_phuongMe'],
  ['ltks_tinhCha', 'ltks_phuongCha'],
  ['ltks_tinhDangKyThuongTru', 'ltks_phuongDangKyThuongTru'],
  ['provinceAgency', 'wardAgency'],
  ['receiveCityCode', 'receiveVillageCode'],
  ['tinhThanhCQ', 'xaPhuongCQ'],
] as const;

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

const titleCaseName = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1).toLocaleLowerCase('vi-VN'))
    .join(' ');

const looksLikeAdministrativeUnit = (value: string): boolean => {
  const normalized = normalizeText(value);
  return /\b(?:tinh|thanh pho|tp|phuong|xa|thi tran|dac khu|quan|huyen|thi xa)\b/u.test(normalized);
};

const getFieldByIds = (fields: ProcedureField[], ids: string[]): ProcedureField | null => {
  const idSet = new Set(ids);
  return fields.find((field) => idSet.has(field.id)) ?? null;
};

const getSelfNameField = (fields: ProcedureField[]): ProcedureField | null =>
  getFieldByIds(fields, [
    'hoTen',
    'fullName',
    'ltks_hoTenNguoiYeuCau',
    'hoTenNam',
    'hoTenNu',
  ]);

const getAdministrativeFieldPair = (
  context: AssistantToolContext,
): { provinceField: ProcedureField; wardField: ProcedureField } | null => {
  if (!context.currentProcedure) return null;
  const fields = context.currentProcedure.fields;
  const visibleFieldIds = new Set(context.formContext.importantVisibleFields.map((field) => field.id));
  const isAgencyContext = /\b(?:co quan|co quan thuc hien|co quan tiep nhan|cong an|noi tiep nhan|tiep nhan)\b/u
    .test(context.normalizedMessage);
  const isRequestResidenceContext = !isAgencyContext
    && /\b(?:de nghi|noi de nghi|noi dang ky|thuong tru|tam tru|noi o|song o|cu tru)\b/u
      .test(context.normalizedMessage);

  const getContextScore = (provinceId: string, wardId: string): number => {
    if (
      isAgencyContext
      && (
        (provinceId === 'tinhThanhCQ' && wardId === 'xaPhuongCQ')
        || (provinceId === 'receiveCityCode' && wardId === 'receiveVillageCode')
        || (provinceId === 'provinceAgency' && wardId === 'wardAgency')
      )
    ) {
      return 2;
    }

    if (
      isRequestResidenceContext
      && (
        (provinceId === 'tinhThanhDN' && wardId === 'xaPhuongDN')
        || (provinceId === 'temporaryCityCode' && wardId === 'temporaryVillageCode')
        || (provinceId === 'requestProvince' && wardId === 'requestWard')
        || (provinceId === 'ltks_tinhThuongTru' && wardId === 'ltks_phuongThuongTru')
      )
    ) {
      return 2;
    }

    return 0;
  };

  const pairs = ADMINISTRATIVE_FIELD_PAIRS
    .map(([provinceId, wardId]) => ({
      provinceField: getFieldByIds(fields, [provinceId]),
      wardField: getFieldByIds(fields, [wardId]),
      visibleScore: Number(visibleFieldIds.has(provinceId)) + Number(visibleFieldIds.has(wardId)),
      contextScore: getContextScore(provinceId, wardId),
    }))
    .filter((pair): pair is {
      provinceField: ProcedureField;
      wardField: ProcedureField;
      visibleScore: number;
      contextScore: number;
    } =>
      Boolean(pair.provinceField && pair.wardField),
    );

  const bestPair = pairs.sort((left, right) =>
    (right.contextScore * 10 + right.visibleScore) - (left.contextScore * 10 + left.visibleScore),
  )[0];
  if (!bestPair || (bestPair.visibleScore === 0 && bestPair.contextScore === 0)) return null;
  return bestPair;
};

const cleanAdministrativeName = (prefix: string, rawValue: string): string => {
  const value = rawValue
    .replace(/\s+(?:nhe|nhé|a|ạ|nha)$/iu, '')
    .trim();
  if (!value) return '';
  return `${prefix} ${value}`.replace(/\s+/g, ' ').trim();
};

const trimExtractedPersonalValue = (value: string): string =>
  value
    .split(/\b(?:sinh|ngay sinh|cccd|can cuoc|so dien thoai|sdt|email|gioi tinh|dan toc)\b/iu)[0]
    ?.replace(/\s+(?:nhe|nhé|a|ạ|nha)$/iu, '')
    .trim() ?? '';

const extractDeterministicFacts = (
  context: AssistantToolContext,
  existingFacts: ExtractedFact[],
): ExtractedFact[] => {
  if (!context.currentProcedure) return [];

  const existingHints = new Set(existingFacts.map((fact) => fact.fieldHint));
  const fields = context.currentProcedure.fields;
  const facts: ExtractedFact[] = [];
  const message = context.message.trim();

  const addFact = (field: ProcedureField | null, value: string, evidence: string) => {
    if (!field || existingHints.has(field.id)) return;
    const normalizedValue = normalizeAndValidateValue(field, value);
    if (!normalizedValue || context.formContext.knownFields[field.id] === normalizedValue) return;
    facts.push({
      fieldHint: field.id,
      value: normalizedValue,
      confidence: 0.95,
      source: 'chat',
      evidence,
    });
    existingHints.add(field.id);
  };

  const nameMatch = message.match(
    /(?:(?:tôi|toi)\s+(?:tên|ten)\s+(?:(?:là|la)\s+)?|(?:tôi|toi)\s+(?:là|la)\s+|(?:tên|ten)\s+(?:(?:tôi|toi)|(?:của|cua)\s+(?:tôi|toi))\s+(?:là|la)\s+|(?:họ|ho)\s+(?:tên|ten)\s+(?:(?:tôi|toi)|(?:của|cua)\s+(?:tôi|toi))\s+(?:là|la)\s+)([^,.;\n]+)/iu,
  );
  if (nameMatch?.[1]) {
    const rawName = trimExtractedPersonalValue(nameMatch[1]);
    if (
      rawName
      && rawName.split(/\s+/).length >= 2
      && !/[\d!@#$%^&*()_+=[\]{};:"\\|<>/?]/u.test(rawName)
    ) {
      addFact(getSelfNameField(fields), titleCaseName(rawName), nameMatch[0]);
    }
  }

  const citizenIdMatch = message.match(/\b(?:cccd|căn\s*cước|can\s*cuoc|số\s*định\s*danh|so\s*dinh\s*danh)\D{0,20}(\d(?:\D?\d){11})\b/iu);
  if (citizenIdMatch?.[1]) {
    const citizenId = citizenIdMatch[1].replace(/\D/g, '');
    addFact(getFieldByIds(fields, ['cccd', 'citizenId', 'ltks_soDinhDanhNguoiYeuCau']), citizenId, citizenIdMatch[0]);
  }

  const phoneMatch = message.match(/\b(?:sđt|sdt|số\s*điện\s*thoại|so\s*dien\s*thoai)\D{0,12}((?:\+84|0)[\d\s.()-]{8,14})\b/iu);
  if (phoneMatch?.[1]) {
    addFact(getFieldByIds(fields, ['sdt', 'phone', 'phoneNumber']), phoneMatch[1], phoneMatch[0]);
  }

  const emailMatch = message.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu);
  if (emailMatch?.[0]) {
    addFact(getFieldByIds(fields, ['email']), emailMatch[0], emailMatch[0]);
  }

  const administrativePair = getAdministrativeFieldPair(context);
  if (administrativePair) {
    const administrativeMessage = context.normalizedMessage;
    const provinceMatch = administrativeMessage.match(
      /\b((?:thanh\s*pho|tp\.?|tinh))\s+([^,.;\n]+?)(?=\s*,|\s+(?:phuong|xa|thi\s*tran|dac\s*khu)\b|[.;\n]|$)/u,
    );
    const wardMatch = administrativeMessage.match(
      /\b((?:phuong|xa|thi\s*tran|dac\s*khu))\s+([^,.;\n]+?)(?=[,.;\n]|$)/u,
    );

    if (provinceMatch?.[1] && provinceMatch[2]) {
      addFact(
        administrativePair.provinceField,
        cleanAdministrativeName(provinceMatch[1], provinceMatch[2]),
        provinceMatch[0],
      );
    }

    if (wardMatch?.[1] && wardMatch[2]) {
      addFact(
        administrativePair.wardField,
        cleanAdministrativeName(wardMatch[1], wardMatch[2]),
        wardMatch[0],
      );
    }
  }

  return facts;
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
  // Nếu field select chưa có danh sách option (tải động), giữ nhãn người dùng
  // để frontend đối chiếu với option đang hiển thị.
  if (!field.options?.length) return value.trim();

  const normalizedValue = normalizeText(value);
  const option = field.options.find((candidate) =>
    normalizeText(candidate.value) === normalizedValue
    || normalizeText(candidate.label) === normalizedValue,
  );
  if (option) return option.value;
  if (ADMINISTRATIVE_FIELD_IDS.has(field.id)) return value.trim();
  return null;
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
    if (
      value.split(/\s+/).length < 2
      || /[\d!@#$%^&*()_+=[\]{};:"\\|,.<>/?]/u.test(value)
      || looksLikeAdministrativeUnit(value)
    ) {
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
  const inferredHighlightElementId = inferUiHighlightElement(context.normalizedMessage);
  if (!understanding) {
    if (inferredHighlightElementId) {
      return {
        response: {
          ...providerResult.response,
          intent: 'HIGHLIGHT',
          data: {
            ...(providerResult.response.data ?? {}),
            elementId: inferredHighlightElementId,
          },
        },
        actions: [
          ...providerResult.actions,
          {
            type: 'HIGHLIGHT_ELEMENT',
            elementId: inferredHighlightElementId,
            message: providerResult.response.message,
          },
        ],
      };
    }

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
    if (targetProcedure && !isSameRoute(context.currentRoute, targetProcedure.route)) {
      const navigationConfirmation = `Mình tìm thấy trang **${targetProcedure.name}**. Bạn có muốn chuyển đến trang này không?`;
      const navigationExplanation = finalMessage.trim()
        || `Với thông tin bạn vừa chia sẻ, thủ tục phù hợp là **${targetProcedure.name}**.`;
      const navigationMessage = mergeConfirmationMessage(
        navigationExplanation,
        navigationConfirmation,
      );
      actions.push({
        type: 'NAVIGATE',
        route: targetProcedure.route,
        serviceName: targetProcedure.name,
        message: navigationMessage,
      });
      finalIntent = 'NAVIGATE';
      finalMessage = navigationMessage;
      finalSuggestions = undefined;
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
  const highlightElementId =
    understanding.highlightElementId
    ?? inferredHighlightElementId;
  if (highlightElementId) {
    actions.push({
      type: 'HIGHLIGHT_ELEMENT',
      elementId: highlightElementId,
      message: finalMessage,
    });
    finalIntent = 'HIGHLIGHT';
    finalData = { ...finalData, elementId: highlightElementId };
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
  if (
    understanding.nextStepRequested
    && isExplicitNextStepRequest(context.normalizedMessage)
  ) {
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
  const formFacts = [
    ...understanding.facts,
    ...extractDeterministicFacts(context, understanding.facts),
  ];

  for (const fact of formFacts) {
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
    finalMessage = finalMessage.trim() || action.message;
    action.message = finalMessage;
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
