import { AppError } from '../../common/errors/app-error.js';
import type { IdentityOcrProvider, OcrResult } from './identity.types.js';

const isSupportedImage = (buffer: Buffer): boolean => {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
};

export class IdentityService {
  constructor(private readonly provider: IdentityOcrProvider) {}

  async extractCccd(file: Express.Multer.File | undefined): Promise<OcrResult> {
    if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng tải lên ảnh CCCD trong field "file".');
    if (!isSupportedImage(file.buffer)) {
      throw new AppError(415, 'UNSUPPORTED_IMAGE', 'Tệp không phải ảnh JPEG, PNG hoặc WebP hợp lệ.');
    }
    const info = await this.provider.extractCccd({
      buffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
    });
    return { provider: this.provider.name, info };
  }
}
