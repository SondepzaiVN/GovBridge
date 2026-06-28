import type { CCCDInfo, IdentityOcrProvider } from '../identity.types.js';

export class MockOcrProvider implements IdentityOcrProvider {
  readonly name = 'mock' as const;

  async extractCccd(): Promise<CCCDInfo> {
    return {
      id: '012345678901',
      hoTen: 'NGUYỄN VĂN A (MOCK)',
      ngaySinh: '2000-01-01',
      gioiTinh: 'Nam',
      queQuan: 'Hà Nội',
      thuongTru: 'Hà Nội',
      ngayCap: '2020-01-01',
      noiCap: 'Cục Cảnh sát QLHC về TTXH',
    };
  }
}
