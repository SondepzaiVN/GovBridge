import type { DocumentReaderProvider, DocumentReaderResult } from '../document-review.types.js';

export class MockDocumentReaderProvider implements DocumentReaderProvider {
  readonly name = 'mock-document-reader';

  async read(): Promise<DocumentReaderResult> {
    return {
      provider: this.name,
      pageCount: 1,
      warnings: [],
      text: [
        'Mẫu CT01 - Tờ khai thay đổi thông tin cư trú',
        'Họ và tên: NGUYEN VAN A',
        'Số định danh cá nhân: 012345678901',
        'Nội dung đề nghị: Đăng ký thường trú vào địa chỉ đã khai trên biểu mẫu.',
      ].join('\n'),
    };
  }
}
