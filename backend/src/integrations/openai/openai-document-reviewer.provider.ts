import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { DocumentReviewInput, DocumentReviewerProvider } from '../../modules/document-review/document-review.types.js';
import type { OpenAiResponsesClient } from './openai-responses.client.js';

interface OpenAiDocumentReviewerOptions {
  client: OpenAiResponsesClient;
  model: string;
  maxOutputTokens: number;
  temperature?: number;
}

const outputTextSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
});

const messageSchema = z.object({
  type: z.literal('message'),
  content: z.array(z.unknown()),
});

const responseSchema = z.object({
  output: z.array(z.unknown()),
});

const reviewSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  flag: z.enum(['green', 'red']),
});

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

const compactFormValues = (values: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .slice(0, 80)
      .map(([key, value]) => [key, value.trim().slice(0, 500)]),
  );

const buildInstructions = () => `Bạn là công cụ kiểm tra văn bản hồ sơ cư trú của GovBridge.

Nhiệm vụ:
- Đọc OCR_TEXT của văn bản người dân nộp.
- Đối chiếu với RULES và FORM_VALUES nếu có.
- Trả về JSON duy nhất gồm:
  - text: nhận xét ngắn gọn bằng tiếng Việt, nêu rõ hợp lệ/chưa hợp lệ, lý do chính và việc cần sửa.
  - flag: "green" nếu văn bản nhìn chung hợp lệ theo rules; "red" nếu thiếu thông tin quan trọng, sai mục đích, mâu thuẫn với form, hoặc OCR quá thiếu để kết luận.

Nguyên tắc:
- Không bịa thông tin ngoài OCR_TEXT.
- Nếu OCR_TEXT không đủ đọc hoặc không giống tờ khai/giấy tờ cư trú cần kiểm tra, flag phải là "red".
- Nếu có khác biệt giữa FORM_VALUES và OCR_TEXT ở họ tên, số CCCD, ngày sinh, địa chỉ, nội dung đề nghị hoặc thủ tục, flag phải là "red".
- Không đưa markdown/code fence.`;

export class OpenAiDocumentReviewerProvider implements DocumentReviewerProvider {
  readonly name = 'openai-document-reviewer';

  constructor(private readonly options: OpenAiDocumentReviewerOptions) {}

  async review(input: DocumentReviewInput): Promise<{ text: string; flag: 'green' | 'red' }> {
    const payload = {
      currentRoute: input.currentRoute,
      fileName: input.fileName,
      readerWarnings: input.readerWarnings,
      formValues: compactFormValues(input.formValues),
      rules: input.rules.slice(0, 12_000),
      ocrText: input.recognizedText.slice(0, 30_000),
    };

    const response = responseSchema.safeParse(await this.options.client.create({
      model: this.options.model,
      instructions: buildInstructions(),
      input: [{
        role: 'user',
        content: JSON.stringify(payload),
      }],
      tools: [],
      tool_choice: 'none',
      parallel_tool_calls: false,
      max_output_tokens: this.options.maxOutputTokens,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'govbridge_document_review',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string' },
              flag: { type: 'string', enum: ['green', 'red'] },
            },
            required: ['text', 'flag'],
          },
        },
      },
      ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
    }));

    if (!response.success) {
      throw new AppError(502, 'INVALID_DOCUMENT_REVIEW_RESPONSE', 'OpenAI trả về phản hồi kiểm tra văn bản không đúng schema API.');
    }

    const text = extractText(response.data.output);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new AppError(502, 'INVALID_DOCUMENT_REVIEW_JSON', 'OpenAI trả về kết quả kiểm tra văn bản không phải JSON hợp lệ.');
    }

    const review = reviewSchema.safeParse(parsed);
    if (!review.success) {
      throw new AppError(502, 'INVALID_DOCUMENT_REVIEW_RESULT', 'OpenAI trả về kết quả kiểm tra văn bản không đúng định dạng.');
    }
    return review.data;
  }
}
