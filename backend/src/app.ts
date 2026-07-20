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
import { OpenAiDocumentReviewerProvider } from './integrations/openai/openai-document-reviewer.provider.js';
import { OpenAiIntentNormalizerProvider } from './integrations/openai/openai-intent-normalizer.provider.js';
import { OpenAiOrchestratorProvider } from './integrations/openai/openai-orchestrator.provider.js';
import { HttpOpenAiResponsesClient } from './integrations/openai/openai-responses.client.js';
import { VnptOcrProvider } from './integrations/vnpt/vnpt-ocr.provider.js';
import { VnptSmartReaderProvider } from './integrations/vnpt/vnpt-smart-reader.provider.js';
import { VnptSttProvider } from './integrations/vnpt/vnpt-stt.provider.js';
import { VnptTtsProvider } from './integrations/vnpt/vnpt-tts.provider.js';
import { VnptAgenticKnowledgeProvider } from './integrations/vnpt/vnpt-agentic-knowledge.provider.js';
import { ApplicationRepository } from './modules/applications/application.repository.js';
import { ApplicationService } from './modules/applications/application.service.js';
import { AssistantSessionRepository } from './modules/assistant/assistant.repository.js';
import { AssistantService } from './modules/assistant/assistant.service.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { IntentNormalizerProvider } from './modules/assistant/intent-normalizer.types.js';
import type { KnowledgeProvider } from './modules/assistant/knowledge.types.js';
import type { OrchestratorProvider } from './modules/assistant/orchestrator.types.js';
import { MockIntentNormalizerProvider } from './modules/assistant/providers/mock-intent-normalizer.provider.js';
import { MockKnowledgeProvider } from './modules/assistant/providers/mock-knowledge.provider.js';
import { MockOrchestratorProvider } from './modules/assistant/providers/mock-orchestrator.provider.js';
import { buildAssistantTools } from './modules/assistant/tools/index.js';
import { DashboardRepository } from './modules/dashboard/dashboard.repository.js';
import { DocumentReviewService } from './modules/document-review/document-review.service.js';
import type { DocumentReaderProvider, DocumentReviewerProvider } from './modules/document-review/document-review.types.js';
import { MockDocumentReaderProvider } from './modules/document-review/providers/mock-document-reader.provider.js';
import { RuleBasedDocumentReviewerProvider } from './modules/document-review/providers/rule-based-document-reviewer.provider.js';
import { IdentityService } from './modules/identity/identity.service.js';
import { MockOcrProvider } from './modules/identity/providers/mock-ocr.provider.js';
import { ProcedureRepository } from './modules/procedures/procedure.repository.js';
import { ProcedureService } from './modules/procedures/procedure.service.js';
import { MockTtsProvider } from './modules/speech/providers/mock-tts.provider.js';
import { MockSttProvider } from './modules/speech/providers/mock-stt.provider.js';
import { SpeechService } from './modules/speech/speech.service.js';
import type { SttProvider, TtsProvider } from './modules/speech/speech.types.js';
import type { IdentityOcrProvider } from './modules/identity/identity.types.js';
import { createApiRouter } from './routes/index.js';

export interface CreateAppOptions {
  dataDirectory?: string;
  corsOrigins?: string[];
  ocrProvider?: IdentityOcrProvider;
  ttsProvider?: TtsProvider;
  sttProvider?: SttProvider;
  orchestratorProvider?: OrchestratorProvider;
  intentNormalizerProvider?: IntentNormalizerProvider;
  knowledgeProvider?: KnowledgeProvider;
  documentReaderProvider?: DocumentReaderProvider;
  documentReviewerProvider?: DocumentReviewerProvider;
}

export const createApp = (options: CreateAppOptions = {}): Express => {
  const dataDirectory = path.resolve(options.dataDirectory ?? env.DATA_DIR);
  const corsOrigins = options.corsOrigins ?? env.CORS_ORIGINS;

  const procedures = new ProcedureRepository(dataDirectory);
  const applications = new ApplicationRepository(dataDirectory);
  const sessions = new AssistantSessionRepository(dataDirectory);
  const dashboardRepository = new DashboardRepository(dataDirectory);
  const authService = new AuthService(new AuthRepository(dataDirectory));
  const openAiClient = env.OPENAI_API_KEY.trim()
    ? new HttpOpenAiResponsesClient({
        baseUrl: env.OPENAI_BASE_URL,
        apiKey: env.OPENAI_API_KEY,
        timeoutMs: env.OPENAI_TIMEOUT_MS,
      })
    : null;

  const ocrProvider: IdentityOcrProvider = options.ocrProvider ?? (env.OCR_PROVIDER === 'vnpt'
    ? new VnptOcrProvider({
      baseUrl: env.VNPT_EKYC_URL,
      authUrl: env.VNPT_EKYC_AUTH_URL,
      accessToken: env.VNPT_EKYC_ACCESS_TOKEN,
      clientId: env.VNPT_EKYC_CLIENT_ID,
      clientSecret: env.VNPT_EKYC_CLIENT_SECRET,
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

  const sttProvider: SttProvider = options.sttProvider ?? (env.STT_PROVIDER === 'vnpt'
    ? new VnptSttProvider({
      url: env.VNPT_STT_URL,
      accessToken: env.VNPT_STT_ACCESS_TOKEN,
      tokenId: env.VNPT_STT_TOKEN_ID,
      tokenKey: env.VNPT_STT_TOKEN_KEY,
      timeoutMs: env.VNPT_STT_TIMEOUT_MS,
    })
    : new MockSttProvider());

  const orchestratorProvider = options.orchestratorProvider ?? (
    env.ORCHESTRATOR_PROVIDER === 'openai' && openAiClient
      ? new OpenAiOrchestratorProvider({
          client: openAiClient,
          model: env.OPENAI_MODEL,
          maxOutputTokens: env.OPENAI_MAX_TOKENS,
          temperature: env.OPENAI_TEMPERATURE,
        })
      : new MockOrchestratorProvider(buildAssistantTools())
  );
  const intentNormalizerProvider = options.intentNormalizerProvider ?? (
    env.ORCHESTRATOR_PROVIDER === 'openai' && openAiClient && !options.orchestratorProvider
      ? new OpenAiIntentNormalizerProvider({
          client: openAiClient,
          model: env.OPENAI_MODEL,
          maxOutputTokens: env.OPENAI_MAX_TOKENS,
          temperature: 0,
        })
      : new MockIntentNormalizerProvider()
  );
  const knowledgeProvider = options.knowledgeProvider ?? (env.KNOWLEDGE_PROVIDER === 'vnpt'
    ? new VnptAgenticKnowledgeProvider({
        url: env.VNPT_AGENTIC_URL,
        accessToken: env.VNPT_ASSISTANT_TOKEN,
        botId: env.VNPT_ASSISTANT_BOT_ID,
        senderId: env.VNPT_ASSISTANT_SENDER_ID,
        referer: env.VNPT_ASSISTANT_REFERER,
        timeoutMs: env.VNPT_AGENTIC_TIMEOUT_MS,
      })
    : new MockKnowledgeProvider());
  const documentReaderProvider = options.documentReaderProvider ?? (env.VNPT_SMARTREADER_ACCESS_TOKEN.trim()
    ? new VnptSmartReaderProvider({
        baseUrl: env.VNPT_SMARTREADER_URL,
        accessToken: env.VNPT_SMARTREADER_ACCESS_TOKEN,
        tokenId: env.VNPT_SMARTREADER_TOKEN_ID,
        tokenKey: env.VNPT_SMARTREADER_TOKEN_KEY,
        macAddress: env.VNPT_MAC_ADDRESS,
        timeoutMs: env.VNPT_SMARTREADER_TIMEOUT_MS,
      })
    : new MockDocumentReaderProvider());
  const documentReviewerProvider = options.documentReviewerProvider ?? (openAiClient
    ? new OpenAiDocumentReviewerProvider({
        client: openAiClient,
        model: env.OPENAI_MODEL,
        maxOutputTokens: env.OPENAI_MAX_TOKENS,
        temperature: 0,
      })
    : new RuleBasedDocumentReviewerProvider());

  const procedureService = new ProcedureService(procedures);
  const apiRouter = createApiRouter({
    procedureService,
    applicationService: new ApplicationService(applications, procedures),
    assistantService: new AssistantService(
      sessions,
      procedures,
      orchestratorProvider,
      knowledgeProvider,
      intentNormalizerProvider,
    ),
    authService,
    documentReviewService: new DocumentReviewService(
      documentReaderProvider,
      documentReviewerProvider,
      env.DOCUMENT_RULES_DIR,
    ),
    identityService: new IdentityService(ocrProvider),
    speechService: new SpeechService(ttsProvider, sttProvider),
    dashboardRepository,
    uploadMaxMb: env.UPLOAD_MAX_MB,
    providerNames: {
      assistant: orchestratorProvider.name,
      knowledge: knowledgeProvider.name,
      ocr: ocrProvider.name,
      stt: sttProvider.name,
      tts: ttsProvider.name,
    },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({
    origin: true,
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

  app.get('/', (_request, response) => {
    response.json({
      success: true,
      message: 'GovBridge backend API is running.',
      frontendUrl: 'http://127.0.0.1:5173/#/lien-thong-khai-sinh',
      healthUrl: '/api/v1/health',
      proceduresUrl: '/api/v1/procedures?includeFields=true',
    });
  });

  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
