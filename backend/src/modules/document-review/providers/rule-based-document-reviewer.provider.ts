import { normalizeText } from '../../../common/utils/normalize-text.js';
import type { DocumentReviewInput, DocumentReviewerProvider } from '../document-review.types.js';

export class RuleBasedDocumentReviewerProvider implements DocumentReviewerProvider {
  readonly name = 'rule-based-document-reviewer';

  async review(input: DocumentReviewInput): Promise<{ text: string; flag: 'green' | 'red' }> {
    const normalized = normalizeText(input.recognizedText);

    if (input.documentType === 'chung_minh_cho_o_hop_phap') {
      const hasHousingProof = normalized.includes('quyen su dung dat')
        || normalized.includes('so huu nha')
        || normalized.includes('cho o hop phap')
        || normalized.includes('hop dong thue')
        || normalized.includes('giay phep xay dung');

      return hasHousingProof
        ? {
          flag: 'green',
          text: 'Văn bản có dấu hiệu là giấy tờ chứng minh chỗ ở hợp pháp và phù hợp sơ bộ với rules hiện tại. Bạn vẫn nên rà lại nội dung trước khi nộp.',
        }
        : {
          flag: 'red',
          text: 'Văn bản chưa đủ cơ sở hợp lệ: cần tải đúng giấy tờ, tài liệu chứng minh chỗ ở hợp pháp và bảo đảm nội dung OCR đọc được rõ ràng.',
        };
    }

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
      text: 'Văn bản có các dấu hiệu cơ bản phù hợp với rules hiện tại. Bạn vẫn nên kiểm tra lại nội dung trước khi nộp.',
    };
  }
}
