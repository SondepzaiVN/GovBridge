import type {
  AssistantToolContext,
  ConversationMessage,
  ConfirmedProcedureCase,
} from './assistant.types.js';

export const NORMALIZED_INTENTS = [
  'UI_HIGHLIGHT',
  'NAVIGATION',
  'PROCEDURE_KNOWLEDGE',
  'FORM_FILL',
  'CHITCHAT',
  'UNCLEAR',
] as const;

export type NormalizedIntent = typeof NORMALIZED_INTENTS[number];

export type NormalizedTargetTool =
  | 'ui_highlighter'
  | 'navigation'
  | 'procedure_knowledge'
  | 'form_fill'
  | 'chat'
  | null;

export interface NormalizedProcedureHint {
  id: string;
  name: string;
  route: string;
}

export interface IntentNormalizationResult {
  intent: NormalizedIntent;
  confidence: number;
  reason: string;
  targetTool: NormalizedTargetTool;
  clarificationQuestion: string | null;
  procedureHint: NormalizedProcedureHint | null;
  fieldHints: string[];
  secondaryIntents: NormalizedIntent[];
  safetyFlags: string[];
}

export interface IntentNormalizerRequest {
  context: AssistantToolContext;
  history: ConversationMessage[];
  confirmedCase: ConfirmedProcedureCase | null;
}

export interface IntentNormalizerProvider {
  readonly name: string;
  normalize(request: IntentNormalizerRequest): Promise<IntentNormalizationResult>;
}

export const createFallbackIntentNormalization = (
  reason = 'Không có lớp phân loại ý định chuyên dụng.',
): IntentNormalizationResult => ({
  intent: 'UNCLEAR',
  confidence: 0,
  reason,
  targetTool: null,
  clarificationQuestion: null,
  procedureHint: null,
  fieldHints: [],
  secondaryIntents: [],
  safetyFlags: ['normalizer_fallback'],
});
