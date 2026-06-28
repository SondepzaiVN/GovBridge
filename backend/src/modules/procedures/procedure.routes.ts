import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { ProcedureController } from './procedure.controller.js';
import { procedureIdParamsSchema, procedureListQuerySchema } from './procedure.schemas.js';
import type { ProcedureService } from './procedure.service.js';

export const createProcedureRouter = (service: ProcedureService): Router => {
  const router = Router();
  const controller = new ProcedureController(service);

  router.get('/', validate(procedureListQuerySchema, 'query'), asyncHandler(controller.list));
  router.get('/:id', validate(procedureIdParamsSchema, 'params'), asyncHandler(controller.getById));

  return router;
};
