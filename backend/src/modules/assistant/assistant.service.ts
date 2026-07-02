import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
import { normalizeText } from '../../common/utils/normalize-text.js';
import type { ProcedureRepository } from '../procedures/procedure.repository.js';
import { planAssistantResult } from './assistant.action-planner.js';
import { buildAssistantFormContext } from './assistant.context.js';
import { buildKnowledgePrivacyContext } from './knowledge-privacy.context.js';
import { validateAndCanonicalizeKnowledgeQuery } from './knowledge-query.validator.js';
import type {
  KnowledgeProvider,
  KnowledgeResult,
  KnowledgeSessionIdentity,
} from './knowledge.types.js';
import type { OrchestratorProvider, OrchestratorResult } from './orchestrator.types.js';
import type { AssistantSessionRepository } from './assistant.repository.js';
import type {
  AssistantApiResult,
  ConfirmedProcedureCase,
  AssistantMessageInput,
  AssistantSession,
  AssistantToolContext,
  OrchestratorFinalResult,
} from './assistant.types.js';
import {
  QUERY_PROCEDURE_KNOWLEDGE_TOOL,
} from './tools/query-procedure-knowledge.tool.js';

export class AssistantService {
  constructor(
    private readonly sessions: AssistantSessionRepository,
    private readonly procedures: ProcedureRepository,
    private readonly orchestrator: OrchestratorProvider,
    private readonly knowledgeProvider: KnowledgeProvider,
  ) {}

  async sendMessage(input: AssistantMessageInput): Promise<AssistantApiResult> {
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date().toISOString();
    const existing = await this.sessions.findById(sessionId);
    const knowledgeSession = existing?.state?.knowledgeSession ?? {
      senderId: `sender_${randomUUID()}`,
      sessionId: `knowledge_${randomUUID()}`,
    };
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
    const firstPass = await this.orchestrator.orchestrate({
      context,
      history,
      knowledge: null,
    });
    const orchestratorResult = firstPass.kind === 'tool_call'
      ? await this.completeKnowledgeToolCall(
          context,
          history,
          firstPass,
          existing?.state?.confirmedCase ?? null,
          knowledgeSession,
        )
      : firstPass.result;
    const result = planAssistantResult(context, orchestratorResult);
    const suggestedCase = orchestratorResult.understanding?.caseSuggestion;
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
          ...(orchestratorResult.understanding?.facts ?? []),
        ].slice(-20),
        ...(existing?.state?.confirmedCase
          ? { confirmedCase: existing.state.confirmedCase }
          : {}),
        knowledgeSession,
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

  private async completeKnowledgeToolCall(
    context: AssistantToolContext,
    history: AssistantSession['messages'],
    firstPass: Extract<OrchestratorResult, { kind: 'tool_call' }>,
    confirmedCase: ConfirmedProcedureCase | null,
    knowledgeSession: KnowledgeSessionIdentity,
  ): Promise<OrchestratorFinalResult> {
    if (firstPass.toolCall.name !== QUERY_PROCEDURE_KNOWLEDGE_TOOL) {
      throw new AppError(400, 'UNSUPPORTED_ASSISTANT_TOOL', 'Orchestrator yêu cầu tool không được hỗ trợ.');
    }

    const query = validateAndCanonicalizeKnowledgeQuery({
      message: context.message,
      currentProcedure: context.currentProcedure,
      procedures: context.procedures,
      confirmedCase,
    }, firstPass.toolCall.arguments);
    let knowledgeResult: KnowledgeResult;
    try {
      knowledgeResult = await this.knowledgeProvider.query({
        identity: knowledgeSession,
        query,
        currentStep: context.formContext.currentStep,
        // Procedure schema hiện chưa có catalog section để đối chiếu an toàn.
        currentSection: null,
        privacy: buildKnowledgePrivacyContext(
          context.currentProcedure,
          context.formContext,
        ),
      });
    } catch (error) {
      if (
        error instanceof AppError
        && error.code === 'OUTBOUND_DATA_POLICY_VIOLATION'
      ) {
        throw error;
      }
      knowledgeResult = {
        answer: 'Dịch vụ tra cứu kiến thức hiện không khả dụng.',
        references: [],
        quickReplies: [],
        provider: this.knowledgeProvider.name,
        status: 'provider_error',
        errorCode: 'KNOWLEDGE_PROVIDER_UNAVAILABLE',
      };
    }

    const secondPass = await this.orchestrator.orchestrate({
      context,
      history,
      knowledge: {
        query,
        result: knowledgeResult,
        continuation: firstPass.toolCall.continuation ?? null,
      },
    });
    if (secondPass.kind === 'tool_call') {
      throw new AppError(
        400,
        'KNOWLEDGE_TOOL_LOOP',
        'Orchestrator không được gọi lặp tool kiến thức trong cùng một lượt.',
      );
    }
    return secondPass.result;
  }
}
