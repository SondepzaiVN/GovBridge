import { normalizeText } from '../../../common/utils/normalize-text.js';
import type {
  IntentNormalizationResult,
  IntentNormalizerProvider,
  IntentNormalizerRequest,
  NormalizedIntent,
  NormalizedTargetTool,
} from '../intent-normalizer.types.js';

const knowledgeTerms = [
  'giay to',
  'ho so',
  'dieu kien',
  'quy trinh',
  'thu tuc',
  'le phi',
  'phi',
  'thoi han',
  'co quan',
  'can gi',
];

const formFillTerms = [
  'toi ten',
  'ho ten',
  'cccd',
  'so dinh danh',
  'ngay sinh',
  'dia chi',
  'so dien thoai',
  'email',
  'gioi tinh',
  'dan toc',
  'toi song o',
  'song o',
  'dang o',
  'thanh pho',
  'tinh',
  'phuong',
  'xa',
  'cap nhat thong tin',
  'xac nhan',
  'dong y',
  'dien vao',
  'hoan tat bieu mau',
];
const navigationTerms = ['muon lam', 'dang ky', 'chuyen trang', 'mo thu tuc', 'bat dau', 'lam khai'];
const highlightTerms = ['nut', 'o dau', 'cho nao', 'vi tri', 'bam dau', 'tim giup'];
const smallTalkTerms = ['xin chao', 'chao', 'cam on', 'tam biet', 'ban la ai'];

const hasAny = (message: string, terms: string[]): boolean =>
  terms.some((term) => message.includes(term));

const inferProcedureHint = (request: IntentNormalizerRequest) => {
  const message = request.context.normalizedMessage;
  return request.context.procedures.find((procedure) => {
    const corpus = [
      procedure.name,
      procedure.shortName,
      procedure.description,
      ...procedure.keywords,
      ...(procedure.citizenSituations ?? []),
      ...(procedure.citizenOutcomes ?? []),
      ...(procedure.negativeHints ?? []),
    ].map(normalizeText).join(' ');
    return corpus.split(/\s+/).some((word) => word.length >= 4 && message.includes(word));
  }) ?? request.context.currentProcedure ?? null;
};

const inferIntent = (request: IntentNormalizerRequest): {
  intent: NormalizedIntent;
  targetTool: NormalizedTargetTool;
  confidence: number;
} => {
  const message = request.context.normalizedMessage;
  const hasActiveFormContext = Boolean(request.context.currentProcedure && (
    request.context.formContext.importantVisibleFields.length > 0
    || request.context.formContext.missingRequiredFields.length > 0
  ));
  if (hasActiveFormContext && hasAny(message, formFillTerms)) {
    return { intent: 'FORM_FILL', targetTool: 'form_fill', confidence: 0.84 };
  }
  if (hasAny(message, smallTalkTerms)) return { intent: 'CHITCHAT', targetTool: 'chat', confidence: 0.86 };
  if (hasAny(message, highlightTerms)) return { intent: 'UI_HIGHLIGHT', targetTool: 'ui_highlighter', confidence: 0.78 };
  if (hasAny(message, formFillTerms)) return { intent: 'FORM_FILL', targetTool: 'form_fill', confidence: 0.74 };
  if (hasAny(message, knowledgeTerms)) return { intent: 'PROCEDURE_KNOWLEDGE', targetTool: 'procedure_knowledge', confidence: 0.74 };
  if (hasAny(message, navigationTerms)) return { intent: 'NAVIGATION', targetTool: 'navigation', confidence: 0.72 };
  return { intent: 'UNCLEAR', targetTool: null, confidence: 0.25 };
};

export class MockIntentNormalizerProvider implements IntentNormalizerProvider {
  readonly name = 'mock-intent-normalizer';

  async normalize(request: IntentNormalizerRequest): Promise<IntentNormalizationResult> {
    const inferred = inferIntent(request);
    const procedure = inferProcedureHint(request);
    const message = request.context.normalizedMessage;
    const secondaryIntents: NormalizedIntent[] = inferred.intent === 'FORM_FILL' && hasAny(message, knowledgeTerms)
      ? ['PROCEDURE_KNOWLEDGE']
      : [];
    return {
      ...inferred,
      reason: 'Rule-based fallback intent normalization.',
      clarificationQuestion: inferred.intent === 'UNCLEAR'
        ? 'Mình chưa thể chọn đúng hướng hỗ trợ vì câu này chưa cho biết bạn đang muốn tìm hiểu một thủ tục, thao tác trên màn hình hay cung cấp dữ liệu cho biểu mẫu. Bạn muốn tra cứu thủ tục, tìm nút hoặc ô nhập trên màn hình, hay điền thông tin vào biểu mẫu?'
        : null,
      procedureHint: procedure
        ? { id: procedure.id, name: procedure.name, route: procedure.route }
        : null,
      fieldHints: request.context.formContext.importantVisibleFields.map((field) => field.id).slice(0, 5),
      secondaryIntents,
      safetyFlags: ['mock_rule_based'],
    };
  }
}
