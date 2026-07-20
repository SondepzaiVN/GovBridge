import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { AuthController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { loginSchema, registerCitizenSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

export const createAuthRouter = (service: AuthService): Router => {
  const router = Router();
  const controller = new AuthController(service);

  router.post('/register', validate(registerCitizenSchema), asyncHandler(controller.registerCitizen));
  router.post('/login', validate(loginSchema), asyncHandler(controller.login));
  router.get('/me', requireAuth(service), asyncHandler(controller.me));
  router.post('/logout', requireAuth(service), asyncHandler(controller.logout));

  return router;
};
