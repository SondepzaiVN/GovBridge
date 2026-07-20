import type { RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../common/errors/app-error.js';
import type { AuthService } from './auth.service.js';
import type { AuthenticatedUser, UserRole } from './auth.types.js';

const AUTH_USER_LOCAL = 'authUser';

export const getAuthUser = (response: Response): AuthenticatedUser => {
  const user = response.locals[AUTH_USER_LOCAL] as AuthenticatedUser | undefined;
  if (!user) throw new UnauthorizedError();
  return user;
};

export const requireAuth = (authService: AuthService): RequestHandler => async (request, response, next) => {
  try {
    const header = request.header('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/iu.exec(header);
    if (!match?.[1]) throw new UnauthorizedError();
    response.locals[AUTH_USER_LOCAL] = await authService.authenticateToken(match[1]);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]): RequestHandler => (_request, response, next) => {
  try {
    const user = getAuthUser(response);
    if (!roles.includes(user.role)) throw new ForbiddenError();
    next();
  } catch (error) {
    next(error);
  }
};
