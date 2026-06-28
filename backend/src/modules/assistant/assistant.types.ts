import type { Procedure } from '../procedures/procedure.types.js';

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
}

export interface AssistantResult {
  response: AIResponse;
  actions: AgentAction[];
}

export interface AssistantApiResult extends AssistantResult { sessionId: string; }

export interface AssistantToolContext {
  message: string;
  normalizedMessage: string;
  currentRoute: string;
  currentProcedure: Procedure | null;
  procedures: Procedure[];
  formValues: Record<string, string>;
}

export interface AssistantTool {
  readonly name: string;
  canHandle(context: AssistantToolContext): boolean;
  execute(context: AssistantToolContext): Promise<AssistantResult> | AssistantResult;
}
