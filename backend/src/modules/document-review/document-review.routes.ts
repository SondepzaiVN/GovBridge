import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { AppError } from '../../common/errors/app-error.js';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { DocumentReviewController } from './document-review.controller.js';
import type { DocumentReviewService } from './document-review.service.js';

export const createDocumentReviewRouter = (service: DocumentReviewService, maxUploadMb: number): Router => {
  const router = Router();
  const controller = new DocumentReviewController(service);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
        callback(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc PDF.'));
        return;
      }
      callback(null, true);
    },
  });
  const limiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });

  router.post('/ct01', limiter, upload.single('file'), asyncHandler(controller.reviewCt01));
  return router;
};
