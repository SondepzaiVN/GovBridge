export type DocumentReviewFlag = 'green' | 'red';
export type DocumentReviewRuleType = 'ct01' | 'chung_minh_cho_o_hop_phap';

export interface DocumentReaderResult {
  text: string;
  warnings: string[];
  pageCount: number | null;
  provider: string;
}

export interface DocumentReaderProvider {
  readonly name: string;
  read(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<DocumentReaderResult>;
}

export interface DocumentReviewInput {
  recognizedText: string;
  rules: string;
  documentType: DocumentReviewRuleType;
  currentRoute: string;
  fileName: string;
  readerWarnings: string[];
}

export interface DocumentReviewResult {
  text: string;
  flag: DocumentReviewFlag;
  extractedText: string;
  warnings: string[];
  provider: string;
  readerProvider: string;
}

export interface DocumentReviewerProvider {
  readonly name: string;
  review(input: DocumentReviewInput): Promise<Pick<DocumentReviewResult, 'text' | 'flag'>>;
}
