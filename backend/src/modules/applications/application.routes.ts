import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { ApplicationController } from './application.controller.js';
import { applicationIdParamsSchema, submitApplicationSchema } from './application.schemas.js';
import type { ApplicationService } from './application.service.js';

export const createApplicationRouter = (service: ApplicationService): Router => {
  const router = Router();
  const controller = new ApplicationController(service);

  router.post('/', validate(submitApplicationSchema), asyncHandler(controller.submit));
  router.get('/:id', validate(applicationIdParamsSchema, 'params'), asyncHandler(controller.getById));

  return router;
};
