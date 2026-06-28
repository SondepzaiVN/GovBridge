import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { IdentityService } from './identity.service.js';

export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  extractCccd = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.extractCccd(request.file));
  };
}
