import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type {
  IntentNormalizerProvider,
  IntentNormalizerRequest,
  IntentNormalizationResult,
} from '../../modules/assistant/intent-normalizer.types.js';
import { NORMALIZED_INTENTS } from '../../modules/assistant/intent-normalizer.types.js';
import type { Procedure, ProcedureField } from '../../modules/procedures/procedure.types.js';
import type { OpenAiResponsesClient } from './openai-responses.client.js';

const MAX_HISTORY_MESSAGES = 4;
const MAX_FIELD_VALUE_LENGTH = 500;
const MAX_CATALOG_DESCRIPTION_LENGTH = 180;
const MAX_CATALOG_KEYWORDS = 5;
const MAX_NORMALIZER_FIELDS = 30;
const MAX_SEMANTIC_HINTS = 3;
const MAX_SEMANTIC_HINT_LENGTH = 180;

export interface OpenAiIntentNormalizerOptions {
  client: OpenAiResponsesClient;
  model: string;
  maxOutputTokens: number;
  temperature?: number;
}

const normalizedProcedureHintSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    route: z.string().trim().min(1).max(200),
  })
  .strict()
  .nullable();

const intentNormalizationSchema = z
  .object({
    intent: z.enum(NORMALIZED_INTENTS),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(1_000),
    targetTool: z.enum([
      'ui_highlighter',
      'navigation',
      'procedure_knowledge',
      'form_fill',
      'chat',
    ]).nullable(),
    clarificationQuestion: z.string().trim().min(1).max(500).nullable(),
    procedureHint: normalizedProcedureHintSchema,
    fieldHints: z.array(z.string().trim().min(1).max(100)).max(10),
    secondaryIntents: z.array(z.enum(NORMALIZED_INTENTS)).max(3),
    safetyFlags: z.array(z.string().trim().min(1).max(100)).max(10),
  })
  .strict();

const intentNormalizationJsonSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: NORMALIZED_INTENTS },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
    targetTool: {
      type: ['string', 'null'],
      enum: ['ui_highlighter', 'navigation', 'procedure_knowledge', 'form_fill', 'chat', null],
    },
    clarificationQuestion: { type: ['string', 'null'] },
    procedureHint: {
      anyOf: [
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            route: { type: 'string' },
          },
          required: ['id', 'name', 'route'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    fieldHints: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
    secondaryIntents: {
      type: 'array',
      items: { type: 'string', enum: NORMALIZED_INTENTS },
      maxItems: 3,
    },
    safetyFlags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
  },
  required: [
    'intent',
    'confidence',
    'reason',
    'targetTool',
    'clarificationQuestion',
    'procedureHint',
    'fieldHints',
    'secondaryIntents',
    'safetyFlags',
  ],
  additionalProperties: false,
} as const;

const responseSchema = z
  .object({
    id: z.string().trim().min(1),
    output: z.array(z.unknown()),
  })
  .passthrough();

const messageSchema = z
  .object({
    type: z.literal('message'),
    content: z.array(z.unknown()),
  })
  .passthrough();

const outputTextSchema = z
  .object({
    type: z.literal('output_text'),
    text: z.string(),
  })
  .passthrough();

const extractText = (output: unknown[]): string => {
  const texts: string[] = [];
  for (const item of output) {
    const parsedMessage = messageSchema.safeParse(item);
    if (!parsedMessage.success) continue;
    for (const content of parsedMessage.data.content) {
      const parsedText = outputTextSchema.safeParse(content);
      if (parsedText.success && parsedText.data.text.trim()) {
        texts.push(parsedText.data.text.trim());
      }
    }
  }
  return texts.join('\n').trim();
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AppError(
      502,
      'INVALID_INTENT_NORMALIZER_RESPONSE',
      'OpenAI Intent Normalizer trả về output không phải JSON hợp lệ.',
    );
  }
};

const validateProcedureHint = (
  request: IntentNormalizerRequest,
  result: IntentNormalizationResult,
): IntentNormalizationResult => {
  if (!result.procedureHint) return result;
  const matched = request.context.procedures.find((procedure) =>
    procedure.id === result.procedureHint?.id
    && procedure.route === result.procedureHint.route
  );
  if (!matched) {
    return {
      ...result,
      procedureHint: null,
      safetyFlags: [...new Set([...result.safetyFlags, 'invalid_procedure_hint_removed'])],
    };
  }
  return {
    ...result,
    procedureHint: {
      id: matched.id,
      name: matched.name,
      route: matched.route,
    },
  };
};

const summarizeProcedure = (procedure: Procedure) => ({
  id: procedure.id,
  name: procedure.name,
  shortName: procedure.shortName,
  route: procedure.route,
  description: procedure.description.slice(0, MAX_CATALOG_DESCRIPTION_LENGTH),
  keywords: procedure.keywords.slice(0, MAX_CATALOG_KEYWORDS),
  citizenSituations: (procedure.citizenSituations ?? [])
    .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
    .slice(0, MAX_SEMANTIC_HINTS),
  citizenOutcomes: (procedure.citizenOutcomes ?? [])
    .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
    .slice(0, 2),
  negativeHints: (procedure.negativeHints ?? [])
    .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
    .slice(0, 2),
});

const summarizeField = (field: ProcedureField) => ({
  id: field.id,
  label: field.label,
  type: field.type,
  required: field.required,
  step: field.step ?? null,
});

const pushUnique = (target: string[], value: string): void => {
  if (!target.includes(value)) target.push(value);
};

const selectNormalizerFieldIds = (request: IntentNormalizerRequest): string[] => {
  const { context } = request;
  const selected: string[] = [];
  for (const field of context.formContext.importantVisibleFields) pushUnique(selected, field.id);
  for (const field of context.formContext.missingRequiredFields) pushUnique(selected, field.id);
  for (const fieldId of Object.keys(context.formContext.recentChanges)) pushUnique(selected, fieldId);
  for (const fieldId of Object.keys(context.formContext.recentOcrFacts)) pushUnique(selected, fieldId);

  const currentStep = context.formContext.currentStep;
  if (currentStep !== null) {
    for (const field of context.currentProcedure?.fields ?? []) {
      if (field.step === currentStep) pushUnique(selected, field.id);
    }
  }

  for (const fieldId of Object.keys(context.formContext.knownFields)) {
    if (selected.length >= MAX_NORMALIZER_FIELDS) break;
    pushUnique(selected, fieldId);
  }

  return selected.slice(0, MAX_NORMALIZER_FIELDS);
};

const selectKnownFields = (
  request: IntentNormalizerRequest,
  fieldIds: string[],
): Record<string, string> => Object.fromEntries(
  fieldIds.flatMap((fieldId) => {
    const value = request.context.formContext.knownFields[fieldId];
    return value ? [[fieldId, value.slice(0, MAX_FIELD_VALUE_LENGTH)]] : [];
  }),
);

const buildInstructions = (request: IntentNormalizerRequest): string => {
  const { context } = request;
  const normalizerFieldIds = selectNormalizerFieldIds(request);
  const knownFields = selectKnownFields(request, normalizerFieldIds);
  const normalizerFieldIdSet = new Set(normalizerFieldIds);
  // Tính primaryFocusSection: khu vực UI đang được người dùng tập trung nhìn vào.
  const allGroups = context.formContext.importantVisibleFields;
  const primaryFocusFields = allGroups.filter((f) => f.isPrimaryFocus);
  const primaryFocusSectionTitle = primaryFocusFields[0]?.sectionTitle ?? null;

  // Chỉ giữ uploadCases/sections đang thực sự hiển thị trên màn hình (isCurrentlyVisible).
  const pageCtx = context.formContext.pageContext;
  const compactedPageContext = pageCtx
    ? {
        ...pageCtx,
        sections: pageCtx.sections?.map(({ isCurrentlyVisible: _, ...rest }) => rest),
        currentlyVisibleSectionIds: pageCtx.sections
          ?.filter((s) => s.isCurrentlyVisible)
          .map((s) => s.id) ?? [],
        residenceRegistration: pageCtx.residenceRegistration
          ? {
              ...pageCtx.residenceRegistration,
              // uploadCases: tất cả (để AI biết toàn bộ)
              uploadCases: pageCtx.residenceRegistration.uploadCases?.map(
                ({ isCurrentlyVisible, ...rest }) => ({
                  ...rest,
                  isCurrentlyVisible,
                }),
              ),
              // Chỉ liệt kê ID của case đang thật sự nhìn thấy
              currentlyVisibleCaseIds: pageCtx.residenceRegistration.uploadCases
                ?.filter((c) => c.isCurrentlyVisible)
                .map((c) => c.id) ?? [],
            }
          : undefined,
      }
    : null;

  const runtimeContext = {
    currentRoute: context.currentRoute,
    currentProcedure: context.currentProcedure
      ? {
          id: context.currentProcedure.id,
          name: context.currentProcedure.name,
          shortName: context.currentProcedure.shortName,
          route: context.currentProcedure.route,
          description: context.currentProcedure.description.slice(0, MAX_CATALOG_DESCRIPTION_LENGTH),
          citizenSituations: (context.currentProcedure.citizenSituations ?? [])
            .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
            .slice(0, MAX_SEMANTIC_HINTS),
          citizenOutcomes: (context.currentProcedure.citizenOutcomes ?? [])
            .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
            .slice(0, 2),
          negativeHints: (context.currentProcedure.negativeHints ?? [])
            .map((value) => value.slice(0, MAX_SEMANTIC_HINT_LENGTH))
            .slice(0, 2),
          fields: context.currentProcedure.fields
            .filter((field) => normalizerFieldIdSet.has(field.id))
            .map(summarizeField),
        }
      : null,
    procedureCatalog: context.procedures.map(summarizeProcedure),
    currentStep: context.formContext.currentStep,
    knownFields,
    knownFieldCount: Object.keys(context.formContext.knownFields).length,
    missingRequiredFields: context.formContext.missingRequiredFields,
    importantVisibleFields: context.formContext.importantVisibleFields,
    /** Tiêu đề khu vực UI đang được người dùng tập trung (chiếm diện tích lớn nhất viewport). */
    primaryFocusSectionTitle,
    pageContext: compactedPageContext,
    hasActiveFormContext: Boolean(context.currentProcedure && (
      context.formContext.importantVisibleFields.length > 0
      || context.formContext.missingRequiredFields.length > 0
      || context.formContext.pageContext
    )),
    recentDocumentReviews: context.formContext.recentDocumentReviews,
    candidateCases: context.formContext.candidateCases,
    confirmedCase: request.confirmedCase,
  };

  return `Bạn là Intent Normalizer của GovBridge. Nhiệm vụ duy nhất: phân loại ý định của người dân để lớp xử lý sau chọn đúng công cụ. Không trả lời câu hỏi thủ tục, không tạo action UI, không tự điền form, không tự chuyển trang.

NHÓM Ý ĐỊNH
- UI_HIGHLIGHT: người dân hỏi vị trí nút, ô nhập, cách bấm, "nút nộp ở đâu", "ô này ở đâu".
- NAVIGATION: muốn mở/chuyển sang thủ tục, bắt đầu làm hồ sơ, sang bước tiếp theo trong giao diện.
- PROCEDURE_KNOWLEDGE: hỏi kiến thức chính thức về thủ tục: giấy tờ, điều kiện, quy trình, cách/nơi nộp, cơ quan, thời hạn, phí, kết quả, căn cứ pháp lý, trường hợp đặc biệt, so sánh.
- FORM_FILL: cung cấp, sửa, xác nhận dữ liệu cá nhân/hồ sơ để điền vào biểu mẫu.
- CHITCHAT: chào hỏi, cảm ơn, hỏi bot làm được gì, câu trò chuyện thông thường.
- UNCLEAR: không đủ rõ để biết người dân muốn làm gì hoặc có thể dẫn tới chọn sai công cụ.

QUY TẮC
- Chỉ phân loại, không thực hiện. targetTool phải tương ứng với intent chính.
- Tin nhắn có nhiều ý định: chọn intent chính theo mục tiêu trực tiếp nhất, đưa phần còn lại vào secondaryIntents.
- Nếu vừa cung cấp dữ liệu form vừa hỏi kiến thức, intent chính là mục người dân hỏi trực tiếp; FORM_FILL nằm trong secondaryIntents nếu dữ liệu đủ rõ.
- Khi runtimeContext.hasActiveFormContext = true va currentProcedure != null, trang hien tai la ngu canh manh. Neu nguoi dan cung cap, sua hoac xac nhan du lieu ca nhan/ho so nhu ho ten, CCCD/so dinh danh, ngay sinh, gioi tinh, dan toc, so dien thoai, email, dia chi, tinh/thanh pho, xa/phuong, quan he voi chu ho, chu ho, noi dung de nghi, thi phai phan loai FORM_FILL/targetTool form_fill voi confidence cao, du cau noi tu nhien va du bieu mau con thieu cac truong khac. Khong hoi lai y dinh chi vi ho chua cung cap du moi truong.
- Neu dang o trang bieu mau va nguoi dan vua cung cap du lieu form vua hoi giay to/dieu kien/quy trinh/co quan/phi/thoi han, intent chinh van la FORM_FILL khi du lieu can cap nhat la hanh dong truc tiep; them PROCEDURE_KNOWLEDGE vao secondaryIntents de lop sau co the vua hien UI xac nhan dien, vua giai thich thu tuc lien quan.
- Neu runtimeContext.pageContext co danh sach case ho so/giay to tren man hinh va nguoi dan hoi "chon truong hop nao", "toi thuoc case nao", "can nop giay to nao", "ho so dinh kem nao", hay phan loai PROCEDURE_KNOWLEDGE hoac CHITCHAT neu cau tra loi nam chac trong pageContext. Khong phan loai UNCLEAR chi vi nguoi dan khong doc dung ten case.
- Cac cau theo sau nhu "cap nhat thong tin", "xac nhan", "dong y", "dien vao", "hoan tat bieu mau" trong ngu canh assistant vua hoi co cap nhat khong thi la FORM_FILL, khong phai CHITCHAT hay UNCLEAR.
- Nếu người dân mô tả tình huống đời sống và hỏi cần làm gì, không phân loại UNCLEAR chỉ vì họ chưa nói đúng tên thủ tục. Hãy so với citizenSituations, citizenOutcomes và negativeHints trong procedureCatalog. Chọn PROCEDURE_KNOWLEDGE nếu họ hỏi cần làm gì/cần giấy tờ/quy trình, hoặc NAVIGATION nếu họ muốn bắt đầu làm hồ sơ. procedureHint dùng thủ tục phù hợp nhất nếu có căn cứ rõ; nếu nhiều thủ tục gần ngang nhau, vẫn dùng PROCEDURE_KNOWLEDGE với procedureHint null để lớp sau hỏi lựa chọn cụ thể.
- Nếu người dân hỏi lại kết quả hồ sơ/tệp vừa tải lên như "file có hợp lệ không", "tôi cần sửa gì", "giấy tờ này lỗi gì", hãy xem recentDocumentReviews là ngữ cảnh trực tiếp và phân loại CHITCHAT với targetTool chat, trừ khi họ hỏi kiến thức thủ tục chính thức rộng hơn.
- Nếu "nộp ở đâu" có thể là hỏi nút trên UI hoặc cơ quan tiếp nhận, dùng ngữ cảnh: có các từ vị trí/bấm/nút thì UI_HIGHLIGHT; hỏi nơi/cơ quan tiếp nhận thì PROCEDURE_KNOWLEDGE; nếu vẫn mơ hồ thì UNCLEAR.
- procedureHint chỉ dùng thủ tục có thật trong procedureCatalog. Nếu không chắc thủ tục, dùng null.
- fieldHints chỉ dùng field id có thật trong currentProcedure.fields hoặc importantVisibleFields.
- UNCLEAR phải có clarificationQuestion tự nhiên bằng tiếng Việt gồm 2-4 câu và tự đủ nghĩa. Bắt buộc: (1) nói phần nào trong yêu cầu đã hiểu được; (2) giải thích vì sao chưa thể chọn an toàn, đang có những cách hiểu/ứng viên nào và chúng khác nhau ở điểm thực tế nào; (3) chỉ rõ đúng dữ kiện còn thiếu hoặc hai dữ kiện đang mâu thuẫn; (4) hỏi một câu cụ thể để người dân bổ sung. Không được chỉ nói "chưa nghe rõ", "vui lòng nói lại", "cần thêm thông tin" hoặc hỏi chung chung mà không nêu thông tin nào cần thêm.
- Khi có nhiều thủ tục gần ngang nhau, clarificationQuestion phải gọi tên tối đa 3 lựa chọn có thật trong procedureCatalog và phân biệt chúng bằng description, citizenSituations, citizenOutcomes hoặc negativeHints; không tự đặt điều kiện pháp lý hay mốc thời gian không có trong catalog. Ví dụ với "Tôi mới chuyển tới Cần Thơ, cần làm gì?", cần nói chưa thể chọn giữa tạm trú và thường trú vì chưa biết đây là nơi ở tạm thời hay nơi sinh sống ổn định/chính thức; sau đó hỏi người dân thuộc trường hợp nào.
- Khi lời mới mâu thuẫn với lịch sử hoặc dữ liệu hiện có và mâu thuẫn ảnh hưởng quyết định, clarificationQuestion phải nêu lại ngắn gọn cả hai thông tin xung đột rồi hỏi thông tin nào là đúng/hiện tại. Không âm thầm chọn một phía.
- confidence là mức chắc chắn của phân loại intent chính. Nếu thật sự mơ hồ, dùng UNCLEAR với confidence >= 0.75.
- Không nhắc "backend", "tool", "normalizer" trong clarificationQuestion.

NGỮ CẢNH GIAO DIỆN (ĐỌC KỸ TRƯỚC KHI PHÂN LOẠI)
- runtimeContext.primaryFocusSectionTitle: tên khu vực giao diện người dùng đang NHÌN VÀO (chiếm diện tích lớn nhất màn hình). Khi người dùng nói "cái này", "mấy cái kia", "trên màn hình", hãy ưu tiên liên kết với khu vực này trước.
- runtimeContext.pageContext.currentlyVisibleCaseIds: danh sách ID các "trường hợp/case" đang THỰC SỰ hiển thị trên màn hình lúc người dùng gửi tin. Nếu người dùng hỏi "mấy trường hợp này là sao", "tôi nên chọn cái nào", hãy tra trong uploadCases và chỉ xét những case có id nằm trong currentlyVisibleCaseIds để giải thích hoặc hỏi lại.
- runtimeContext.pageContext.currentlyVisibleSectionIds: tương tự nhưng cho sections.
- importantVisibleFields[].sectionTitle: tên khu vực mà từng field thuộc về. Dùng để liên kết câu hỏi mơ hồ với đúng khu vực form người dùng đang thấy.
- importantVisibleFields[].isPrimaryFocus: true nếu field đó nằm trong khu vực đang được tập trung. Ưu tiên những field này khi phân loại FORM_FILL hoặc UI_HIGHLIGHT.

OUTPUT
Trả đúng JSON schema, không markdown/code fence. reason ngắn gọn cho log nội bộ.

RUNTIME_CONTEXT
${JSON.stringify(runtimeContext)}`;
};

const buildInput = (request: IntentNormalizerRequest): unknown[] => [
  ...request.history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 1_000),
  })),
  {
    role: 'user',
    content: request.context.message,
  },
];

export class OpenAiIntentNormalizerProvider implements IntentNormalizerProvider {
  readonly name = 'openai-intent-normalizer';

  constructor(private readonly options: OpenAiIntentNormalizerOptions) {}

  async normalize(request: IntentNormalizerRequest): Promise<IntentNormalizationResult> {
    const response = responseSchema.safeParse(
      await this.options.client.create({
        model: this.options.model,
        instructions: buildInstructions(request),
        input: buildInput(request),
        tools: [],
        tool_choice: 'none',
        parallel_tool_calls: false,
        max_output_tokens: Math.min(this.options.maxOutputTokens, 1_024),
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'govbridge_intent_normalization',
            strict: true,
            schema: intentNormalizationJsonSchema,
          },
        },
        ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
      }),
    );
    if (!response.success) {
      throw new AppError(
        502,
        'INVALID_INTENT_NORMALIZER_RESPONSE',
        'Phản hồi OpenAI Intent Normalizer không đúng schema API.',
      );
    }

    const outputText = extractText(response.data.output);
    if (!outputText) {
      throw new AppError(
        502,
        'EMPTY_INTENT_NORMALIZER_RESPONSE',
        'OpenAI Intent Normalizer không trả về câu trả lời.',
      );
    }

    const parsed = intentNormalizationSchema.safeParse(parseJson(outputText));
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_INTENT_NORMALIZER_RESPONSE',
        'OpenAI Intent Normalizer trả về output không đúng schema.',
      );
    }

    return validateProcedureHint(request, parsed.data);
  }
}
