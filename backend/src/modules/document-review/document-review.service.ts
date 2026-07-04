import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { AppError } from '../../common/errors/app-error.js';
import type {
  DocumentReaderProvider,
  DocumentReviewerProvider,
  DocumentReviewResult,
  DocumentReviewRuleType,
} from './document-review.types.js';

const isSupportedDocument = (file: Express.Multer.File): boolean => {
  const buffer = file.buffer;
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const pdf = buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
  return jpeg || png || pdf;
};

const DOCUMENT_RULE_FILES: Record<DocumentReviewRuleType, string> = {
  ct01: 'ct01.md',
  chung_minh_cho_o_hop_phap: 'chung_minh_cho_o_hop_phap.md',
};

const parseDocumentType = (value: unknown): DocumentReviewRuleType => {
  if (typeof value !== 'string') return 'ct01';
  if (value in DOCUMENT_RULE_FILES) return value as DocumentReviewRuleType;
  throw new AppError(400, 'UNSUPPORTED_DOCUMENT_RULE', 'Chưa có bộ quy tắc kiểm tra tự động cho loại giấy tờ này.');
};

interface ReviewDocumentInput {
  file: Express.Multer.File | undefined;
  currentRoute?: unknown;
  documentType?: unknown;
}

export class DocumentReviewService {
  constructor(
    private readonly reader: DocumentReaderProvider,
    private readonly reviewer: DocumentReviewerProvider,
    private readonly rulesDirectory: string,
  ) {}

  async reviewCt01(input: ReviewDocumentInput): Promise<DocumentReviewResult> {
    if (!input.file) throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng tải lên ảnh hoặc PDF tờ khai cần kiểm tra.');
    if (!isSupportedDocument(input.file)) {
      throw new AppError(415, 'UNSUPPORTED_DOCUMENT', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc PDF hợp lệ.');
    }

    const documentType = parseDocumentType(input.documentType);
    const rulesPath = path.join(this.rulesDirectory, DOCUMENT_RULE_FILES[documentType]);

    const [readerResult, rules] = await Promise.all([
      this.reader.read({
        buffer: input.file.buffer,
        mimetype: input.file.mimetype,
        filename: input.file.originalname,
      }),
      readFile(rulesPath, 'utf8'),
    ]);

    const review = await this.reviewer.review({
      recognizedText: readerResult.text,
      rules,
      documentType,
      currentRoute: typeof input.currentRoute === 'string' ? input.currentRoute : '/',
      fileName: input.file.originalname,
      readerWarnings: readerResult.warnings,
    });

    return {
      ...review,
      extractedText: readerResult.text,
      warnings: readerResult.warnings,
      provider: this.reviewer.name,
      readerProvider: readerResult.provider,
    };
  }
}
