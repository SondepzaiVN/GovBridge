import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { HealthController } from './health.controller.js';

export const createHealthRouter = (options: {
  assistantProvider: string;
  knowledgeProvider: string;
  ocrProvider: string;
  ttsProvider: string;
}): Router => {
  const router = Router();
  const controller = new HealthController(options);
  router.get('/', asyncHandler(controller.get));
  return router;
};
