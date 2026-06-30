import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppError } from './common/errors/app-error.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { notFoundHandler } from './common/middleware/not-found.js';
import { requestId } from './common/middleware/request-id.js';
import { env } from './config/env.js';
import { VnptOcrProvider } from './integrations/vnpt/vnpt-ocr.provider.js';
import { VnptTtsProvider } from './integrations/vnpt/vnpt-tts.provider.js';
import { ApplicationRepository } from './modules/applications/application.repository.js';
import { ApplicationService } from './modules/applications/application.service.js';
import { AssistantSessionRepository } from './modules/assistant/assistant.repository.js';
import { AssistantService } from './modules/assistant/assistant.service.js';
import { MockAssistantProvider } from './modules/assistant/providers/mock-assistant.provider.js';
import { VnptSmartbotProvider } from './integrations/vnpt/vnpt-smartbot.provider.js';
import { buildAssistantTools } from './modules/assistant/tools/index.js';
import type { AssistantProvider } from './modules/assistant/assistant.types.js';
import { IdentityService } from './modules/identity/identity.service.js';
import { MockOcrProvider } from './modules/identity/providers/mock-ocr.provider.js';
import { ProcedureRepository } from './modules/procedures/procedure.repository.js';
import { ProcedureService } from './modules/procedures/procedure.service.js';
import { MockTtsProvider } from './modules/speech/providers/mock-tts.provider.js';
import { SpeechService } from './modules/speech/speech.service.js';
import type { TtsProvider } from './modules/speech/speech.types.js';
import type { IdentityOcrProvider } from './modules/identity/identity.types.js';
import { createApiRouter } from './routes/index.js';

export interface CreateAppOptions {
  dataDirectory?: string;
  corsOrigins?: string[];
  ocrProvider?: IdentityOcrProvider;
  ttsProvider?: TtsProvider;
  assistantProvider?: AssistantProvider;
}

export const createApp = (options: CreateAppOptions = {}): Express => {
  const dataDirectory = path.resolve(options.dataDirectory ?? env.DATA_DIR);
  const corsOrigins = options.corsOrigins ?? env.CORS_ORIGINS;

  const procedures = new ProcedureRepository(dataDirectory);
  const applications = new ApplicationRepository(dataDirectory);
  const sessions = new AssistantSessionRepository(dataDirectory);

  const ocrProvider: IdentityOcrProvider = options.ocrProvider ?? (env.OCR_PROVIDER === 'vnpt'
    ? new VnptOcrProvider({
      baseUrl: env.VNPT_EKYC_URL,
      accessToken: env.VNPT_EKYC_ACCESS_TOKEN,
      tokenId: env.VNPT_EKYC_TOKEN_ID,
      tokenKey: env.VNPT_EKYC_TOKEN_KEY,
      macAddress: env.VNPT_MAC_ADDRESS,
    })
    : new MockOcrProvider());

  const ttsProvider: TtsProvider = options.ttsProvider ?? (env.TTS_PROVIDER === 'vnpt'
    ? new VnptTtsProvider({
      url: env.VNPT_TTS_URL,
      accessToken: env.VNPT_TTS_ACCESS_TOKEN,
      tokenId: env.VNPT_TTS_TOKEN_ID,
      tokenKey: env.VNPT_TTS_TOKEN_KEY,
    })
    : new MockTtsProvider());

  const assistantProvider = options.assistantProvider ?? (env.ASSISTANT_PROVIDER === 'vnpt'
    ? new VnptSmartbotProvider({
        url: env.VNPT_SMARTBOT_URL,
        accessToken: env.VNPT_SMARTBOT_ACCESS_TOKEN,
        tokenId: env.VNPT_SMARTBOT_TOKEN_ID,
        tokenKey: env.VNPT_SMARTBOT_TOKEN_KEY,
        botId: env.VNPT_SMARTBOT_BOT_ID,
      })
    : new MockAssistantProvider(buildAssistantTools()));

  const procedureService = new ProcedureService(procedures);
  const apiRouter = createApiRouter({
    procedureService,
    applicationService: new ApplicationService(applications, procedures),
    assistantService: new AssistantService(sessions, procedures, assistantProvider),
    identityService: new IdentityService(ocrProvider),
    speechService: new SpeechService(ttsProvider),
    uploadMaxMb: env.UPLOAD_MAX_MB,
    providerNames: {
      assistant: env.ASSISTANT_PROVIDER,
      ocr: ocrProvider.name,
      tts: ttsProvider.name,
    },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin không được phép truy cập API.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }));
  app.use(rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (request) => request.path.endsWith('/health'),
  }));

  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
