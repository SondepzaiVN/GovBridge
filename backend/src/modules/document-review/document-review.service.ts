import { readFile } from 'node:fs/promises';
import { AppError } from '../../common/errors/app-error.js';
import type {
  DocumentReaderProvider,
  DocumentReviewerProvider,
  DocumentReviewResult,
} from './document-review.types.js';

const isSupportedDocument = (file: Express.Multer.File): boolean => {
  const buffer = file.buffer;
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const pdf = buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
  return jpeg || png || pdf;
};

const parseFormValues = (value: unknown): Record<string, string> => {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, item]) => typeof item === 'string')
        .map(([key, item]) => [key, String(item)]),
    );
  } catch {
    return {};
  }
};

interface ReviewDocumentInput {
  file: Express.Multer.File | undefined;
  currentRoute?: unknown;
  formValues?: unknown;
}

export class DocumentReviewService {
  constructor(
    private readonly reader: DocumentReaderProvider,
    private readonly reviewer: DocumentReviewerProvider,
    private readonly rulesPath: string,
  ) {}

  async reviewCt01(input: ReviewDocumentInput): Promise<DocumentReviewResult> {
    if (!input.file) throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng tải lên ảnh hoặc PDF tờ khai cần kiểm tra.');
    if (!isSupportedDocument(input.file)) {
      throw new AppError(415, 'UNSUPPORTED_DOCUMENT', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc PDF hợp lệ.');
    }

    const [readerResult, rules] = await Promise.all([
      this.reader.read({
        buffer: input.file.buffer,
        mimetype: input.file.mimetype,
        filename: input.file.originalname,
      }),
      readFile(this.rulesPath, 'utf8'),
    ]);

    const review = await this.reviewer.review({
      recognizedText: readerResult.text,
      rules,
      currentRoute: typeof input.currentRoute === 'string' ? input.currentRoute : '/',
      formValues: parseFormValues(input.formValues),
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
