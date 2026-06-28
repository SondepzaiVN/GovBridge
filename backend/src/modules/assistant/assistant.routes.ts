import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { AssistantController } from './assistant.controller.js';
import { assistantMessageSchema, assistantSessionParamsSchema } from './assistant.schemas.js';
import type { AssistantService } from './assistant.service.js';

export const createAssistantRouter = (service: AssistantService): Router => {
  const router = Router();
  const controller = new AssistantController(service);
  const assistantLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  router.post('/messages', assistantLimiter, validate(assistantMessageSchema), asyncHandler(controller.sendMessage));
  router.delete('/sessions/:sessionId', validate(assistantSessionParamsSchema, 'params'), asyncHandler(controller.clearSession));

  return router;
};
