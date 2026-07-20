import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import { getAuthUser } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';
import type { UserRole } from './auth.types.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  registerCitizen = async (request: Request, response: Response): Promise<Response> =>
    sendSuccess(response, await this.service.registerCitizen(request.body), 201);

  login = async (request: Request, response: Response): Promise<Response> => {
    const body = request.body as { role: UserRole; username: string; password: string };
    return sendSuccess(response, await this.service.login(body));
  };

  me = async (_request: Request, response: Response): Promise<Response> => {
    const { sessionTokenHash: _sessionTokenHash, ...user } = getAuthUser(response);
    return sendSuccess(response, { user });
  };

  logout = async (_request: Request, response: Response): Promise<Response> =>
    sendSuccess(response, await this.service.logout(getAuthUser(response)));
}
