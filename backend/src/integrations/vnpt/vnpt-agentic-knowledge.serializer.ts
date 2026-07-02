import { normalizeText } from '../../common/utils/normalize-text.js';
import type { VnptKnowledgeOutboundDto } from './vnpt-agentic-knowledge.privacy.js';

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
    `Loại thông tin cần tra cứu: ${dto.knowledgeType}`,
    verifiedLine('Trường hợp nghiệp vụ', dto.selectedCase),
    verifiedLine('Màn hình hiện tại', dto.screen),
    verifiedLine('Trường dữ liệu đang hỏi', dto.fieldLabel),
    verifiedLine('Địa phương liên quan', dto.locality),
  ].filter((line): line is string => line !== null);

  return [
    '[NGỮ CẢNH GOVBRIDGE]',
    ...contextLines,
    '',
    '[CÂU HỎI CỦA NGƯỜI DÂN]',
    dto.redactedQuestion,
  ].join('\n');
};
