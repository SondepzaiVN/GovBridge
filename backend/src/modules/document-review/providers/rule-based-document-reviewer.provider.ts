import { normalizeText } from '../../../common/utils/normalize-text.js';
import type { DocumentReviewInput, DocumentReviewerProvider } from '../document-review.types.js';

export class RuleBasedDocumentReviewerProvider implements DocumentReviewerProvider {
  readonly name = 'rule-based-document-reviewer';

  async review(input: DocumentReviewInput): Promise<{ text: string; flag: 'green' | 'red' }> {
    const normalized = normalizeText(input.recognizedText);
    const hasCt01 = normalized.includes('ct01') || normalized.includes('to khai') || normalized.includes('cu tru');
    const hasRequestContent = normalized.includes('noi dung de nghi')
      || normalized.includes('dang ky thuong tru')
      || normalized.includes('dang ky tam tru')
      || normalized.includes('xac nhan thong tin cu tru');
    const hasBadPurpose = normalized.includes('xuat khau lao dong') || normalized.includes('nhat ban');

    if (!hasCt01 || !hasRequestContent || hasBadPurpose) {
      return {
        flag: 'red',
        text: 'Văn bản chưa đủ cơ sở hợp lệ: cần bảo đảm đây là tờ khai CT01/giấy tờ cư trú, có nội dung đề nghị rõ ràng và không ghi sai mục đích thủ tục.',
      };
    }

    return {
      flag: 'green',
      text: 'Văn bản có các dấu hiệu cơ bản phù hợp với rules hiện tại. Bạn vẫn nên kiểm tra lại thông tin cá nhân, địa chỉ và nội dung đề nghị trước khi nộp.',
    };
  }
}
