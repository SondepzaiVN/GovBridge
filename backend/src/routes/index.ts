import { Router } from 'express';
import type { ApplicationService } from '../modules/applications/application.service.js';
import type { AssistantService } from '../modules/assistant/assistant.service.js';
import { createApplicationRouter } from '../modules/applications/application.routes.js';
import { createAssistantRouter } from '../modules/assistant/assistant.routes.js';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createIdentityRouter } from '../modules/identity/identity.routes.js';
import type { IdentityService } from '../modules/identity/identity.service.js';
import { createProcedureRouter } from '../modules/procedures/procedure.routes.js';
import type { ProcedureService } from '../modules/procedures/procedure.service.js';
import { createSpeechRouter } from '../modules/speech/speech.routes.js';
import type { SpeechService } from '../modules/speech/speech.service.js';
import {
  createVnptChatRouter,
  type VnptChatRouteOptions,
} from '../integrations/vnpt/vnpt-chat.routes.js';

export interface ApiDependencies {
  applicationService: ApplicationService;
  assistantService: AssistantService;
  identityService: IdentityService;
  procedureService: ProcedureService;
  speechService: SpeechService;
  uploadMaxMb: number;
  vnptChat: VnptChatRouteOptions;
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
  router.use('/identity', createIdentityRouter(dependencies.identityService, dependencies.uploadMaxMb));
  router.use('/speech', createSpeechRouter(dependencies.speechService, dependencies.uploadMaxMb));
  router.use(createVnptChatRouter(dependencies.vnptChat));
  return router;
};
