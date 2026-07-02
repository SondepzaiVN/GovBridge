import type {
  KnowledgeErrorCode,
  KnowledgeResult,
} from '../../modules/assistant/knowledge.types.js';
import { SseDecoderError } from './sse-decoder.js';
import { VnptContentLimitError } from './vnpt-agentic-content.accumulator.js';

const providerError = (
  code: KnowledgeErrorCode,
  answer: string,
): KnowledgeResult => ({
  answer,
  references: [],
  quickReplies: [],
  provider: 'vnpt-agentic',
  status: 'provider_error',
  errorCode: code,
});

export const mapVnptHttpError = (status: number): KnowledgeResult => {
  if (status === 401 || status === 403) {
    return providerError(
      'KNOWLEDGE_PROVIDER_AUTH_ERROR',
      'Dịch vụ tra cứu kiến thức từ chối thông tin xác thực.',
    );
  }
  if (status === 429) {
    return providerError(
      'KNOWLEDGE_PROVIDER_UNAVAILABLE',
      'Dịch vụ tra cứu kiến thức đang tạm giới hạn yêu cầu.',
    );
  }
  return providerError(
    'KNOWLEDGE_PROVIDER_UNAVAILABLE',
    'Dịch vụ tra cứu kiến thức hiện không khả dụng.',
  );
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error
  && (error.name === 'TimeoutError' || error.name === 'AbortError');

export const mapVnptTransportError = (error: unknown): KnowledgeResult => {
  const timeout = isTimeoutError(error)
    || (error instanceof SseDecoderError && error.kind === 'READ_TIMEOUT');
  return timeout
    ? providerError(
        'KNOWLEDGE_PROVIDER_TIMEOUT',
        'Dịch vụ tra cứu kiến thức đã quá thời gian chờ.',
      )
    : providerError(
        'KNOWLEDGE_PROVIDER_UNAVAILABLE',
        'Không thể kết nối hoặc đọc phản hồi từ dịch vụ tra cứu kiến thức.',
      );
};

export const mapVnptStreamError = (error: unknown): KnowledgeResult => {
  if (error instanceof SseDecoderError) {
    if (error.kind === 'READ_TIMEOUT') return mapVnptTransportError(error);
    if (error.kind === 'READ_FAILED') return mapVnptTransportError(error);
  }
  if (error instanceof VnptContentLimitError || error instanceof SseDecoderError) {
    return providerError(
      'INVALID_KNOWLEDGE_STREAM',
      'Luồng phản hồi vượt giới hạn an toàn hoặc không hợp lệ.',
    );
  }
  return providerError(
    'INVALID_KNOWLEDGE_STREAM',
    'Luồng phản hồi từ dịch vụ tra cứu kiến thức không hợp lệ.',
  );
};
