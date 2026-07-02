import type {
  AssistantToolContext,
  ConversationMessage,
  OrchestratorFinalResult,
} from './assistant.types.js';
import type { KnowledgeQuery, KnowledgeResult } from './knowledge.types.js';

export interface OrchestratorContinuation {
  provider: string;
  state: unknown;
}

export interface OrchestratorKnowledgeContext {
  query: KnowledgeQuery;
  result: KnowledgeResult;
  continuation: OrchestratorContinuation | null;
}

export interface OrchestratorRequest {
  context: AssistantToolContext;
  history: ConversationMessage[];
  knowledge: OrchestratorKnowledgeContext | null;
}

export type OrchestratorResult =
  | {
      kind: 'final';
      result: OrchestratorFinalResult;
    }
  | {
      kind: 'tool_call';
      toolCall: {
        name: string;
        arguments: unknown;
        continuation?: OrchestratorContinuation;
      };
    };

export interface OrchestratorProvider {
  readonly name: string;
  orchestrate(request: OrchestratorRequest): Promise<OrchestratorResult>;
}
