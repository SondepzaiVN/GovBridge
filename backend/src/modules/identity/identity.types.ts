export interface CCCDInfo {
  id: string;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  queQuan: string;
  thuongTru: string;
  ngayCap: string;
  noiCap: string;
  rawText?: string;
}

export interface OcrResult {
  provider: 'mock' | 'vnpt';
  info: CCCDInfo;
}

export interface IdentityOcrProvider {
  readonly name: 'mock' | 'vnpt';
  extractCccd(image: { buffer: Buffer; mimetype: string; filename: string }): Promise<CCCDInfo>;
}
