export const KNOWLEDGE_TYPES = [
  'procedure_identification',
  'eligibility',
  'conditions',
  'documents',
  'forms',
  'process',
  'submission_method',
  'receiving_authority',
  'processing_time',
  'fees',
  'result',
  'legal_basis',
  'terminology',
  'special_case',
  'comparison',
] as const;

export type KnowledgeType = typeof KNOWLEDGE_TYPES[number];

export interface KnowledgeProcedureHint {
  id: string | null;
  name: string | null;
}

export interface KnowledgeFieldContext {
  fieldId: string | null;
  fieldLabel: string | null;
}

export interface KnowledgeQuery {
  question: string;
  knowledgeType: KnowledgeType;
  procedureHint: KnowledgeProcedureHint | null;
  selectedCaseHint: string | null;
  fieldContext: KnowledgeFieldContext | null;
  locality: string | null;
}

export type KnownPiiType =
  | 'cccd'
  | 'phone'
  | 'email'
  | 'person_name'
  | 'specific_address'
  | 'date_of_birth'
  | 'other_identifier';

export interface KnownPiiValue {
  type: KnownPiiType;
  value: string;
}

export interface KnowledgePrivacyContext {
  knownPii: KnownPiiValue[];
}

export interface KnowledgeProviderRequest {
  identity: KnowledgeSessionIdentity;
  query: KnowledgeQuery;
  currentStep: number | null;
  currentSection: string | null;
  privacy: KnowledgePrivacyContext;
}

export interface KnowledgeSessionIdentity {
  senderId: string;
  sessionId: string;
}

export interface KnowledgeReference {
  title: string;
  url: string | null;
  documentNumber: string | null;
}

export type KnowledgeStatus = 'success' | 'no_source' | 'provider_error';

export type KnowledgeErrorCode =
  | 'EMPTY_KNOWLEDGE_RESPONSE'
  | 'INVALID_KNOWLEDGE_STREAM'
  | 'KNOWLEDGE_PROVIDER_TIMEOUT'
  | 'KNOWLEDGE_PROVIDER_AUTH_ERROR'
  | 'KNOWLEDGE_PROVIDER_UNAVAILABLE';

export interface KnowledgeResult {
  answer: string;
  references: KnowledgeReference[];
  quickReplies: string[];
  provider: string;
  status: KnowledgeStatus;
  errorCode?: KnowledgeErrorCode;
}

export interface KnowledgeProvider {
  readonly name: string;
  query(request: KnowledgeProviderRequest): Promise<KnowledgeResult>;
}
