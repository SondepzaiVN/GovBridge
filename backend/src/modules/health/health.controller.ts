import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';

interface HealthOptions {
  assistantProvider: string;
  knowledgeProvider: string;
  ocrProvider: string;
  ttsProvider: string;
}

export class HealthController {
  constructor(private readonly options: HealthOptions) {}

  get = async (_request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, {
      status: 'ok',
      service: 'gov-bridge-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      storage: 'json-file',
      providers: {
        assistant: this.options.assistantProvider,
        orchestrator: this.options.assistantProvider,
        knowledge: this.options.knowledgeProvider,
        ocr: this.options.ocrProvider,
        tts: this.options.ttsProvider,
      },
    });
  };
}
