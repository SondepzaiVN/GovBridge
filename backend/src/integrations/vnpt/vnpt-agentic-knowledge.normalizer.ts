import type {
  KnowledgeReference,
  KnowledgeResult,
} from '../../modules/assistant/knowledge.types.js';
import type { VnptKnowledgeStreamOutput } from './vnpt-agentic-sse.parser.js';

const REFERENCE_HEADING = /^nguồn\s+tham\s+khảo\s*:?\s*$/iu;
const URL_PATTERN = /https?:\/\/[^\s)\]}>,;]+/iu;
const DOCUMENT_NUMBER_PATTERN =
  /\b\d{1,4}\/\d{4}\/[A-ZĐ]{2,}\d*(?:-[A-ZĐ0-9]+)*\b/iu;

const cleanReferenceLine = (line: string): string =>
  line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').trim();

export const extractKnowledgeReferences = (
  answer: string,
): KnowledgeReference[] => {
  const lines = answer.split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) => REFERENCE_HEADING.test(line.trim()));
  if (headingIndex < 0) return [];

  const references: KnowledgeReference[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines.slice(headingIndex + 1)) {
    const line = cleanReferenceLine(rawLine);
    if (!line) continue;
    const url = line.match(URL_PATTERN)?.[0] ?? null;
    const documentNumber = line.match(DOCUMENT_NUMBER_PATTERN)?.[0] ?? null;
    if (!url && !documentNumber) continue;
    const titleWithoutUrl = url
      ? line.replace(url, '').replace(/\s*[-–—:]\s*$/u, '').trim()
      : line;
    const title = titleWithoutUrl || url || documentNumber;
    if (!title) continue;
    const key = `${title}\n${url ?? ''}\n${documentNumber ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ title, url, documentNumber });
    if (references.length >= 20) break;
  }
  return references;
};

export const vnptAnswerHasNoSource = (answer: string): boolean =>
  /(?:không|chưa)\s+(?:tìm\s+(?:thấy|được)|có)\s+(?:đủ\s+)?(?:nguồn|thông tin|dữ liệu)/iu
    .test(answer)
  || /không\s+đủ\s+(?:nguồn|thông tin|dữ liệu|căn cứ)\s+để/iu.test(answer);

export const normalizeVnptKnowledgeResult = (
  output: VnptKnowledgeStreamOutput,
): KnowledgeResult => {
  if (
    output.validEventCount === 0
    && (output.invalidEventCount > 0 || !output.doneReceived)
  ) {
    return {
      answer: 'Luồng phản hồi từ dịch vụ tra cứu kiến thức không hợp lệ.',
      references: [],
      quickReplies: [],
      provider: 'vnpt-agentic',
      status: 'provider_error',
      errorCode: 'INVALID_KNOWLEDGE_STREAM',
    };
  }
  if (!output.answer && output.quickReplies.length === 0) {
    return {
      answer: 'Dịch vụ tra cứu kiến thức không trả về nội dung.',
      references: [],
      quickReplies: [],
      provider: 'vnpt-agentic',
      status: 'provider_error',
      errorCode: 'EMPTY_KNOWLEDGE_RESPONSE',
    };
  }

  const references = [
    ...output.references,
    ...extractKnowledgeReferences(output.answer),
  ];
  const seenReferences = new Set<string>();

  return {
    answer: output.answer,
    references: references.filter((reference) => {
      const key = `${reference.title}\n${reference.url ?? ''}\n${reference.documentNumber ?? ''}`;
      if (seenReferences.has(key)) return false;
      seenReferences.add(key);
      return true;
    }).slice(0, 20),
    quickReplies: output.quickReplies,
    provider: 'vnpt-agentic',
    status: vnptAnswerHasNoSource(output.answer) ? 'no_source' : 'success',
  };
};
