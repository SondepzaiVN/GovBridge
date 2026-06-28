import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { AssistantService } from './assistant.service.js';
import type { AssistantMessageInput } from './assistant.types.js';

export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  sendMessage = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.sendMessage(request.body as AssistantMessageInput));
  };

  clearSession = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.clearSession(request.params.sessionId as string));
  };
}
