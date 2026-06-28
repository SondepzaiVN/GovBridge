import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { SpeechService } from './speech.service.js';
import type { TtsInput } from './speech.types.js';

export class SpeechController {
  constructor(private readonly service: SpeechService) {}
  synthesize = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.synthesize(request.body as TtsInput));
  };
}
