import { Router } from 'express';
import type { ApplicationService } from '../modules/applications/application.service.js';
import type { AssistantService } from '../modules/assistant/assistant.service.js';
import { createDocumentReviewRouter } from '../modules/document-review/document-review.routes.js';
import type { DocumentReviewService } from '../modules/document-review/document-review.service.js';
import { createApplicationRouter } from '../modules/applications/application.routes.js';
import { createAssistantRouter } from '../modules/assistant/assistant.routes.js';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createIdentityRouter } from '../modules/identity/identity.routes.js';
import type { IdentityService } from '../modules/identity/identity.service.js';
import { createProcedureRouter } from '../modules/procedures/procedure.routes.js';
import type { ProcedureService } from '../modules/procedures/procedure.service.js';
import { createSpeechRouter } from '../modules/speech/speech.routes.js';
import type { SpeechService } from '../modules/speech/speech.service.js';

import type { DashboardRepository } from '../modules/dashboard/dashboard.repository.js';
import { createDashboardRouter } from '../modules/dashboard/dashboard.routes.js';

export interface ApiDependencies {
  applicationService: ApplicationService;
  assistantService: AssistantService;
  documentReviewService: DocumentReviewService;
  identityService: IdentityService;
  procedureService: ProcedureService;
  speechService: SpeechService;
  dashboardRepository: DashboardRepository;
  uploadMaxMb: number;
  providerNames: {
    assistant: string;
    knowledge: string;
    ocr: string;
    stt: string;
    tts: string;
  };
}

export const createApiRouter = (dependencies: ApiDependencies): Router => {
  const router = Router();
  router.use('/health', createHealthRouter({
    assistantProvider: dependencies.providerNames.assistant,
    knowledgeProvider: dependencies.providerNames.knowledge,
    ocrProvider: dependencies.providerNames.ocr,
    sttProvider: dependencies.providerNames.stt,
    ttsProvider: dependencies.providerNames.tts,
  }));
  router.use('/procedures', createProcedureRouter(dependencies.procedureService));
  router.use('/applications', createApplicationRouter(dependencies.applicationService));
  router.use('/assistant', createAssistantRouter(dependencies.assistantService));
  router.use('/document-review', createDocumentReviewRouter(dependencies.documentReviewService, dependencies.uploadMaxMb));
  router.use('/identity', createIdentityRouter(dependencies.identityService, dependencies.uploadMaxMb));
  router.use('/speech', createSpeechRouter(dependencies.speechService, dependencies.uploadMaxMb));
  router.use('/dashboard/applications', createDashboardRouter(dependencies.dashboardRepository));
  return router;
};
