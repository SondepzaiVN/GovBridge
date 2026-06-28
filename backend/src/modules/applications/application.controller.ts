import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { ApplicationService } from './application.service.js';
import type { SubmitApplicationInput } from './application.types.js';

export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  submit = async (request: Request, response: Response): Promise<Response> => {
    const application = await this.service.submit(request.body as SubmitApplicationInput);
    return sendSuccess(response, application, 201);
  };

  getById = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.getById(request.params.id as string));
  };
}
