import { normalizeText } from '../../common/utils/normalize-text.js';
import type { KnowledgeType } from '../../modules/assistant/knowledge.types.js';
import type { VnptKnowledgeOutboundDto } from './vnpt-agentic-knowledge.privacy.js';

const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  procedure_identification: 'xác định thủ tục phù hợp',
  eligibility: 'đối tượng được thực hiện',
  conditions: 'điều kiện thực hiện',
  documents: 'thành phần hồ sơ',
  forms: 'biểu mẫu, tờ khai',
  process: 'quy trình thực hiện',
  submission_method: 'cách nộp hồ sơ',
  receiving_authority: 'cơ quan tiếp nhận',
  processing_time: 'thời hạn xử lý',
  fees: 'lệ phí',
  result: 'kết quả thủ tục',
  legal_basis: 'căn cứ pháp lý',
  terminology: 'giải thích thuật ngữ',
  special_case: 'trường hợp đặc biệt',
  comparison: 'so sánh thủ tục',
};

const verifiedLine = (label: string, value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed || normalizeText(trimmed) === 'khong xac dinh') return null;
  return `${label}: ${trimmed}`;
};

export const serializeVnptKnowledgeText = (
  dto: VnptKnowledgeOutboundDto,
): string => {
  const contextLines = [
    verifiedLine('Mã thủ tục', dto.procedure?.id),
    verifiedLine('Tên thủ tục', dto.procedure?.name),
    `Loại thông tin cần tra cứu: ${KNOWLEDGE_TYPE_LABELS[dto.knowledgeType]}`,
    verifiedLine('Trường hợp nghiệp vụ', dto.selectedCase),
    verifiedLine('Màn hình hiện tại', dto.screen),
    verifiedLine('Trường dữ liệu đang hỏi', dto.fieldLabel),
    verifiedLine('Địa phương liên quan', dto.locality),
  ].filter((line): line is string => line !== null);

  return [
    '[NGỮ CẢNH GOVBRIDGE]',
    ...contextLines,
    '',
    '[YÊU CẦU CĂN CỨ PHÁP LÝ]',
    'Nếu câu trả lời dựa trên văn bản pháp luật, hãy nêu rõ số hiệu văn bản, ngày hiệu lực và nguồn/trích dẫn nếu có trong kho tri thức.',
    '',
    '[CÂU HỎI CỦA NGƯỜI DÂN]',
    dto.redactedQuestion,
  ].join('\n');
};
