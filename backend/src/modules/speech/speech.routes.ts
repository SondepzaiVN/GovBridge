import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { SpeechController } from './speech.controller.js';
import { ttsSchema } from './speech.schemas.js';
import type { SpeechService } from './speech.service.js';

export const createSpeechRouter = (service: SpeechService): Router => {
  const router = Router();
  const controller = new SpeechController(service);
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
  router.post('/tts', limiter, validate(ttsSchema), asyncHandler(controller.synthesize));
  return router;
};
