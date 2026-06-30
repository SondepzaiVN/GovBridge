import { randomUUID } from 'node:crypto';
import { normalizeText } from '../../common/utils/normalize-text.js';
import type { ProcedureRepository } from '../procedures/procedure.repository.js';
import { planAssistantResult } from './assistant.action-planner.js';
import { buildAssistantFormContext } from './assistant.context.js';
import type { AssistantSessionRepository } from './assistant.repository.js';
import type {
  AssistantApiResult,
  AssistantMessageInput,
  AssistantSession,
  AssistantProvider,
  AssistantToolContext,
} from './assistant.types.js';

export class AssistantService {
  constructor(
    private readonly sessions: AssistantSessionRepository,
    private readonly procedures: ProcedureRepository,
    private readonly provider: AssistantProvider,
  ) {}

  async sendMessage(input: AssistantMessageInput): Promise<AssistantApiResult> {
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date().toISOString();
    const existing = await this.sessions.findById(sessionId);
    const currentRoute = input.currentRoute ?? existing?.currentRoute ?? '/';
    const allProcedures = await this.procedures.findAll();
    const currentProcedure = await this.procedures.findByRoute(currentRoute);
    const formContext = buildAssistantFormContext(input, existing, currentProcedure, currentRoute);

    const context: AssistantToolContext = {
      sessionId,
      message: input.message,
      normalizedMessage: normalizeText(input.message),
      currentRoute,
      currentProcedure,
      procedures: allProcedures,
      formValues: input.formValues ?? {},
      formContext,
    };

    const history = existing?.messages ?? [];
    const providerResult = await this.provider.sendMessage(context, history);
    const result = planAssistantResult(context, providerResult);
    const suggestedCase = providerResult.understanding?.caseSuggestion;
    const candidateCases = suggestedCase
      ? [
          suggestedCase,
          ...(existing?.state?.candidateCases ?? []).filter((candidate) => candidate.id !== suggestedCase.id),
        ].slice(0, 3)
      : existing?.state?.candidateCases ?? [];

    const session: AssistantSession = {
      id: sessionId,
      currentRoute,
      state: {
        formSnapshot: formContext.knownFields,
        candidateCases,
        recentFacts: [
          ...(existing?.state?.recentFacts ?? []),
          ...(providerResult.understanding?.facts ?? []),
        ].slice(-20),
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: [
        ...history,
        { role: 'user' as const, content: input.message, createdAt: now },
        { role: 'assistant' as const, content: result.response.message, createdAt: now },
      ].slice(-20),
    };
    await this.sessions.upsert(session);

    return { sessionId, ...result };
  }

  async clearSession(sessionId: string): Promise<{ deleted: boolean }> {
    return { deleted: await this.sessions.delete(sessionId) };
  }
}
