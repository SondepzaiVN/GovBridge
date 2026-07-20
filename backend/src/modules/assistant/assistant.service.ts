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
import {
  createFallbackIntentNormalization,
  type IntentNormalizerProvider,
  type IntentNormalizationResult,
} from './intent-normalizer.types.js';
import type { OrchestratorProvider, OrchestratorResult } from './orchestrator.types.js';
import type { AssistantSessionRepository } from './assistant.repository.js';
import type {
  AgentAction,
  AssistantApiResult,
  ConfirmedProcedureCase,
  AssistantMessageInput,
  AssistantSession,
  AssistantSessionState,
  AssistantToolContext,
  OrchestratorFinalResult,
} from './assistant.types.js';
import {
  QUERY_PROCEDURE_KNOWLEDGE_TOOL,
} from './tools/query-procedure-knowledge.tool.js';

const HOUSING_LIFE_SITUATION_TERMS = [
  'mua nha',
  'nha moi',
  'chuyen nha',
  'chuyen den',
  'cho o moi',
  'noi o moi',
  've o',
  'can phai lam gi',
];

const RESIDENCE_PROCEDURE_TERMS = [
  'thuong tru',
  'tam tru',
  'cu tru',
  'cho o',
  'xac nhan cu tru',
];

const includesAny = (value: string, terms: string[]): boolean =>
  terms.some((term) => value.includes(term));

const PENDING_FILL_CONFIRM_TERMS = [
  'cap nhat',
  'cap nhat thong tin',
  'xac nhan',
  'dong y',
  'co',
  'ok',
  'duoc',
  'dien vao',
  'dien thong tin',
  'tiep tuc dien',
  'hoan tat bieu mau',
];

const PENDING_FILL_CANCEL_TERMS = [
  'huy',
  'huy bo',
  'khong',
  'khong dien',
  'bo qua',
];

const isPendingFillRelevant = (
  pendingFill: AssistantSessionState['pendingFill'] | undefined,
  knownFields: Record<string, string>,
): pendingFill is NonNullable<AssistantSessionState['pendingFill']> =>
  Boolean(
    pendingFill
    && Object.entries(pendingFill.fields).some(([fieldId, value]) => knownFields[fieldId] !== value),
  );

const shouldConfirmPendingFill = (normalizedMessage: string): boolean =>
  includesAny(normalizedMessage, PENDING_FILL_CONFIRM_TERMS)
  && !includesAny(normalizedMessage, PENDING_FILL_CANCEL_TERMS);

const shouldCancelPendingFill = (normalizedMessage: string): boolean =>
  includesAny(normalizedMessage, PENDING_FILL_CANCEL_TERMS);

const getRequestConfirmFillAction = (actions: AgentAction[]) =>
  actions.find((action): action is Extract<AgentAction, { type: 'REQUEST_CONFIRM_FILL' }> =>
    action.type === 'REQUEST_CONFIRM_FILL',
  );

const shouldLetOrchestratorHandleUnclear = (
  context: AssistantToolContext,
  normalization: IntentNormalizationResult,
): boolean => {
  if (normalization.intent !== 'UNCLEAR') return false;
  const message = context.normalizedMessage;
  if (!includesAny(message, HOUSING_LIFE_SITUATION_TERMS)) return false;

  return context.procedures.some((procedure) => {
    const corpus = [
      procedure.name,
      procedure.shortName,
      procedure.description,
      ...procedure.keywords,
      ...(procedure.citizenSituations ?? []),
      ...(procedure.citizenOutcomes ?? []),
      ...(procedure.negativeHints ?? []),
    ].map(normalizeText).join(' ');
    return includesAny(corpus, RESIDENCE_PROCEDURE_TERMS);
  });
};

export class AssistantService {
  private static readonly CLARIFY_INTENT_CONFIDENCE = 0.65;

  constructor(
    private readonly sessions: AssistantSessionRepository,
    private readonly procedures: ProcedureRepository,
    private readonly orchestrator: OrchestratorProvider,
    private readonly knowledgeProvider: KnowledgeProvider,
    private readonly intentNormalizer: IntentNormalizerProvider,
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
    const activePendingFill = isPendingFillRelevant(existing?.state?.pendingFill, formContext.knownFields)
      ? existing?.state?.pendingFill
      : undefined;

    if (activePendingFill && shouldCancelPendingFill(context.normalizedMessage)) {
      const cancelMessage = 'Dạ, mình chưa thay đổi biểu mẫu. Anh/Chị có thể cung cấp thông tin khác hoặc yêu cầu em hướng dẫn tiếp.';
      const session: AssistantSession = {
        id: sessionId,
        currentRoute,
        state: {
          formSnapshot: formContext.knownFields,
          candidateCases: existing?.state?.candidateCases ?? [],
          recentFacts: existing?.state?.recentFacts ?? [],
          ...(existing?.state?.confirmedCase
            ? { confirmedCase: existing.state.confirmedCase }
            : {}),
          knowledgeSession,
          ...(existing?.state?.lastIntentNormalization
            ? { lastIntentNormalization: existing.state.lastIntentNormalization }
            : {}),
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages: [
          ...history,
          { role: 'user' as const, content: input.message, createdAt: now },
          { role: 'assistant' as const, content: cancelMessage, createdAt: now },
        ].slice(-20),
      };
      await this.sessions.upsert(session);
      return {
        sessionId,
        response: {
          intent: 'CHAT',
          message: cancelMessage,
          suggestions: ['Cung cấp thông tin khác', 'Hướng dẫn biểu mẫu'],
        },
        actions: [],
      };
    }

    if (activePendingFill && shouldConfirmPendingFill(context.normalizedMessage)) {
      const fields = activePendingFill.fields;
      const previousValues = Object.fromEntries(
        Object.keys(fields)
          .filter((fieldId) => formContext.knownFields[fieldId])
          .map((fieldId) => [fieldId, formContext.knownFields[fieldId] ?? '']),
      );
      const message = 'Mình sẽ cập nhật các thông tin này vào biểu mẫu. Anh/Chị kiểm tra lại rồi bấm Xác nhận và điền nhé.';
      const suggestions = ['Gi?i th?ch c?c tr??ng n?y', 'T?i mu?n s?a th?ng tin'];
      const action: Extract<AgentAction, { type: 'REQUEST_CONFIRM_FILL' }> = {
        type: 'REQUEST_CONFIRM_FILL',
        fields,
        fieldLabels: activePendingFill.fieldLabels,
        previousValues,
        message,
        suggestions,
      };
      const session: AssistantSession = {
        id: sessionId,
        currentRoute,
        state: {
          formSnapshot: formContext.knownFields,
          candidateCases: existing?.state?.candidateCases ?? [],
          recentFacts: existing?.state?.recentFacts ?? [],
          pendingFill: {
            ...activePendingFill,
            previousValues,
          },
          ...(existing?.state?.confirmedCase
            ? { confirmedCase: existing.state.confirmedCase }
            : {}),
          knowledgeSession,
          ...(existing?.state?.lastIntentNormalization
            ? { lastIntentNormalization: existing.state.lastIntentNormalization }
            : {}),
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages: [
          ...history,
          { role: 'user' as const, content: input.message, createdAt: now },
          { role: 'assistant' as const, content: message, createdAt: now },
        ].slice(-20),
      };
      await this.sessions.upsert(session);
      return {
        sessionId,
        response: {
          intent: 'CLARIFY',
          message,
          data: {
            fields,
            fieldLabels: activePendingFill.fieldLabels,
            previousValues,
          },
          suggestions,
        },
        actions: [action],
      };
    }

    const intentNormalization = await this.normalizeIntent(
      context,
      history,
      existing?.state?.confirmedCase ?? null,
    );
    context.intentNormalization = intentNormalization;

    if (
      intentNormalization.intent === 'UNCLEAR'
      && intentNormalization.confidence >= AssistantService.CLARIFY_INTENT_CONFIDENCE
      && intentNormalization.clarificationQuestion
      && !shouldLetOrchestratorHandleUnclear(context, intentNormalization)
    ) {
      const clarificationMessage = intentNormalization.clarificationQuestion;
      const session: AssistantSession = {
        id: sessionId,
        currentRoute,
        state: {
          formSnapshot: formContext.knownFields,
          candidateCases: existing?.state?.candidateCases ?? [],
          recentFacts: existing?.state?.recentFacts ?? [],
          ...(existing?.state?.confirmedCase
            ? { confirmedCase: existing.state.confirmedCase }
            : {}),
          knowledgeSession,
          lastIntentNormalization: intentNormalization,
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages: [
          ...history,
          { role: 'user' as const, content: input.message, createdAt: now },
          { role: 'assistant' as const, content: clarificationMessage, createdAt: now },
        ].slice(-20),
      };
      await this.sessions.upsert(session);
      return {
        sessionId,
        response: {
          intent: 'CLARIFY',
          message: clarificationMessage,
          data: { intentNormalization },
          suggestions: [
            'Tra cứu thông tin thủ tục',
            'Hướng dẫn thao tác trên màn hình',
            'Điền thông tin vào biểu mẫu',
          ],
        },
        actions: [],
      };
    }

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
    const confirmFillAction = getRequestConfirmFillAction(result.actions);
    const pendingFill = confirmFillAction
      ? {
          fields: confirmFillAction.fields,
          fieldLabels: confirmFillAction.fieldLabels,
          previousValues: confirmFillAction.previousValues,
        }
      : activePendingFill;
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
        ...(pendingFill ? { pendingFill } : {}),
        ...(existing?.state?.confirmedCase
          ? { confirmedCase: existing.state.confirmedCase }
          : {}),
        knowledgeSession,
        lastIntentNormalization: intentNormalization,
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

  private async normalizeIntent(
    context: AssistantToolContext,
    history: AssistantSession['messages'],
    confirmedCase: ConfirmedProcedureCase | null,
  ): Promise<IntentNormalizationResult> {
    try {
      return await this.intentNormalizer.normalize({
        context,
        history,
        confirmedCase,
      });
    } catch (error) {
      console.warn('[Assistant] Intent normalizer unavailable, continuing with fallback.', error);
      return createFallbackIntentNormalization('Intent normalizer không khả dụng, tiếp tục dùng orchestrator.');
    }
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
