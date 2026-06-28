import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { AppError } from '../../common/errors/app-error.js';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import type { IdentityService } from './identity.service.js';
import { IdentityController } from './identity.controller.js';

export const createIdentityRouter = (service: IdentityService, maxUploadMb: number): Router => {
  const router = Router();
  const controller = new IdentityController(service);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        callback(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'));
        return;
      }
      callback(null, true);
    },
  });
  const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

  router.post('/cccd/ocr', limiter, upload.single('file'), asyncHandler(controller.extractCccd));
  return router;
};
