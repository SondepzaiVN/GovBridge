import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';
import type { IntentNormalizationResult } from './intent-normalizer.types.js';
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
  pageContext?: AssistantPageContext;
  recentOcrFacts?: Record<string, string>;
  recentDocumentReviews?: AssistantDocumentReviewContext[];
  visibleFieldIds?: string[];
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

export interface AssistantDocumentReviewContext {
  label: string;
  fileName?: string;
  documentType?: 'ct01' | 'chung_minh_cho_o_hop_phap';
  status: 'valid' | 'invalid' | 'error';
  flag?: 'green' | 'red';
  text: string;
  warnings: string[];
  readerProvider?: string;
  reviewerProvider?: string;
  checkedAt?: string;
}

export interface AssistantPageRequirementContext {
  id: string;
  name: string;
  required: boolean;
  selected?: boolean;
  hasFile?: boolean;
  fileCount?: number;
  canUseSpecializedData?: boolean;
  useSpecializedData?: boolean;
  guidance?: string;
}

export interface AssistantPageCaseContext {
  id: string;
  title: string;
  isVisible?: boolean;
  isOpen?: boolean;
  selectionHint?: string;
  requirements?: AssistantPageRequirementContext[];
}

export interface AssistantPageSectionContext {
  id: string;
  title: string;
  isOpen?: boolean;
  isVisible?: boolean;
}

export interface AssistantSubmissionChecklistItemContext {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  reminder?: string;
}

export interface AssistantPageContext {
  pageId: string;
  currentSection?: string | null;
  sections?: AssistantPageSectionContext[];
  submissionChecklist?: AssistantSubmissionChecklistItemContext[];
  residenceRegistration?: {
    procedureCase?: string;
    registrationMode?: string;
    isOverseasDossier?: boolean;
    openUploadCaseId?: string;
    uploadCases?: AssistantPageCaseContext[];
  };
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
  navigationRoute: string | null;
  highlightElementId: string | null;
  nextStepRequested: boolean;
}

export interface OrchestratorFinalResult extends AssistantResult {
  understanding?: AssistantUnderstanding;
  responseProvenance?: 'orchestrator' | 'knowledge_composer';
}

export interface AssistantFormContext {
  currentStep: number | null;
  currentSection: string | null;
  pageContext: AssistantPageContext | null;
  knownFields: Record<string, string>;
  missingRequiredFields: Array<{ id: string; label: string }>;
  importantVisibleFields: Array<{
    id: string;
    label: string;
    type: ProcedureField['type'];
    required: boolean;
    isEmpty: boolean;
    priority: 'high';
    options?: Array<{ value: string; label: string }>;
  }>;
  recentChanges: Record<string, string>;
  candidateCases: CaseSuggestion[];
  recentOcrFacts: Record<string, string>;
  recentDocumentReviews: AssistantDocumentReviewContext[];
}

export interface AssistantSessionState {
  formSnapshot: Record<string, string>;
  candidateCases: CaseSuggestion[];
  recentFacts: ExtractedFact[];
  pendingFill?: {
    fields: Record<string, string>;
    fieldLabels: Record<string, string>;
    previousValues: Record<string, string>;
  };
  confirmedCase?: ConfirmedProcedureCase;
  knowledgeSession?: KnowledgeSessionIdentity;
  lastIntentNormalization?: IntentNormalizationResult;
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
  intentNormalization?: IntentNormalizationResult;
}

export interface AssistantTool {
  readonly name: string;
  canHandle(context: AssistantToolContext): boolean;
  execute(context: AssistantToolContext): Promise<OrchestratorFinalResult> | OrchestratorFinalResult;
}
