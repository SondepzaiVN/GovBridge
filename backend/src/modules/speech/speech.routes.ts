import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { SpeechController } from './speech.controller.js';
import { ttsSchema } from './speech.schemas.js';
import type { SpeechService } from './speech.service.js';

export const createSpeechRouter = (service: SpeechService, uploadMaxMb: number): Router => {
  const router = Router();
  const controller = new SpeechController(service);
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.min(uploadMaxMb, 10) * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (/^audio\/(?:wav|wave|x-wav|mpeg|mp3|webm|ogg|pcm)/iu.test(file.mimetype)) {
        callback(null, true);
        return;
      }
      callback(new Error('UNSUPPORTED_AUDIO_TYPE'));
    },
  });

  router.post('/tts', limiter, validate(ttsSchema), asyncHandler(controller.synthesize));
  router.post('/stt', limiter, upload.single('audioFile'), asyncHandler(controller.transcribe));
  return router;
};
