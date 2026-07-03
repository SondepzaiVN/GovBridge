import type { Request, Response } from 'express';
import { ValidationError } from '../../common/errors/app-error.js';
import { sendSuccess } from '../../common/http/response.js';
import type { SpeechService } from './speech.service.js';
import type { TtsInput } from './speech.types.js';

export class SpeechController {
  constructor(private readonly service: SpeechService) {}

  synthesize = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.synthesize(request.body as TtsInput));
  };

  transcribe = async (request: Request, response: Response): Promise<Response> => {
    if (!request.file) {
      throw new ValidationError('Vui lòng gửi file âm thanh.', [{
        field: 'audioFile',
        code: 'REQUIRED',
        message: 'Thiếu file âm thanh.',
      }]);
    }

    return sendSuccess(response, await this.service.transcribe({
      file: request.file,
      ...(typeof request.body.clientSession === 'string' && request.body.clientSession.trim()
        ? { clientSession: request.body.clientSession.trim() }
        : {}),
    }));
  };
}
