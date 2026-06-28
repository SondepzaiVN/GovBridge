import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { ProcedureService } from './procedure.service.js';

export class ProcedureController {
  constructor(private readonly service: ProcedureService) {}

  list = async (request: Request, response: Response): Promise<Response> => {
    const query = request.query as unknown as {
      search?: string;
      category?: string;
      includeFields: boolean;
    };
    return sendSuccess(response, await this.service.list(query));
  };

  getById = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.getById(request.params.id as string));
  };
}
