import type { Procedure } from '../procedures/procedure.types.js';
import type { KnowledgeSessionIdentity } from './knowledge.types.js';

export type AIIntent = 'CHAT' | 'FILL_FORM' | 'NAVIGATE' | 'HIGHLIGHT' | 'VALIDATE' | 'OCR_CONFIRM' | 'CLARIFY';

export interface AIResponse {
  intent: AIIntent;
  message: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

export type AgentAction =
  | { type: 'CHAT'; message: string; suggestions?: string[] }
  | { type: 'FILL_FORM'; fields: Record<string, string>; message: string; suggestions?: string[] }
  | {
      type: 'REQUEST_CONFIRM_FILL';
      fields: Record<string, string>;
      fieldLabels: Record<string, string>;
      previousValues: Record<string, string>;
      message: string;
      suggestions?: string[];
    }
  | { type: 'NAVIGATE'; route: string; serviceName: string; message: string; suggestions?: string[] }
  | { type: 'NEXT_STEP'; step?: number; message?: string; suggestions?: string[] }
  | { type: 'HIGHLIGHT_ELEMENT'; elementId: string; message: string; suggestions?: string[] };

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AssistantSession {
  id: string;
  currentRoute: string;
  messages: ConversationMessage[];
  state?: AssistantSessionState;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantSessionStore {
  schemaVersion: number;
  sessions: AssistantSession[];
}

export interface AssistantMessageInput {
  sessionId?: string;
  message: string;
  currentRoute?: string;
  formValues?: Record<string, string>;
  currentSection?: string;
  recentOcrFacts?: Record<string, string>;
}

export interface AssistantResult {
  response: AIResponse;
  actions: AgentAction[];
}

export interface AssistantApiResult extends AssistantResult { sessionId: string; }

export type FactSource = 'chat' | 'ocr' | 'form' | 'inference';

export interface ExtractedFact {
  fieldHint: string;
  value: string;
  confidence: number;
  source: FactSource;
  evidence?: string;
}

export interface CaseSuggestion {
  id: string;
  confidence: number;
  reason: string;
}

export interface FieldExplanation {
  fieldId: string;
  explanation: string;
}

export interface AssistantUnderstanding {
  facts: ExtractedFact[];
  caseSuggestion: CaseSuggestion | null;
  followUpQuestion: string | null;
  fieldExplanation: FieldExplanation | null;
}

export interface OrchestratorFinalResult extends AssistantResult {
  understanding?: AssistantUnderstanding;
  responseProvenance?: 'orchestrator' | 'knowledge_composer';
}

export interface AssistantFormContext {
  currentStep: number | null;
  currentSection: string | null;
  knownFields: Record<string, string>;
  missingRequiredFields: Array<{ id: string; label: string }>;
  recentChanges: Record<string, string>;
  candidateCases: CaseSuggestion[];
  recentOcrFacts: Record<string, string>;
}

export interface AssistantSessionState {
  formSnapshot: Record<string, string>;
  candidateCases: CaseSuggestion[];
  recentFacts: ExtractedFact[];
  confirmedCase?: ConfirmedProcedureCase;
  knowledgeSession?: KnowledgeSessionIdentity;
}

export interface ConfirmedProcedureCase {
  id: string;
  procedureId: string;
}

export interface AssistantToolContext {
  sessionId: string;
  message: string;
  normalizedMessage: string;
  currentRoute: string;
  currentProcedure: Procedure | null;
  procedures: Procedure[];
  formValues: Record<string, string>;
  formContext: AssistantFormContext;
}

export interface AssistantTool {
  readonly name: string;
  canHandle(context: AssistantToolContext): boolean;
  execute(context: AssistantToolContext): Promise<OrchestratorFinalResult> | OrchestratorFinalResult;
}
