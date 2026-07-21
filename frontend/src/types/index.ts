// ============================================================
// Chat Message Types
// ============================================================
export type MessageRole = 'user' | 'bot' | 'system';

export type MessageType =
  | 'text'
  | 'voice'
  | 'image'
  | 'cccd-preview'
  | 'fill-confirm'
  | 'navigation-confirm'
  | 'validation-result'
  | 'document-review'
  | 'form-filled'
  | 'loading';

export type MessageStatus =
  | 'processing'
  | 'speaking'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  generationId?: number;
  interruptedAt?: Date;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

// ============================================================
// AI Intent & Response
// ============================================================
export type AIIntent =
  | 'CHAT'
  | 'FILL_FORM'
  | 'NAVIGATE'
  | 'HIGHLIGHT'
  | 'VALIDATE'
  | 'OCR_CONFIRM'
  | 'CLARIFY';

export interface ValidationError {
  field: string;
  label: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AIResponse {
  intent: AIIntent;
  message: string;
  data?: {
    fields?: Record<string, string>;
    route?: string;
    serviceName?: string;
    elementId?: string;
    elementLabel?: string;
    validationErrors?: ValidationError[];
    cccdInfo?: CCCDInfo;
    documentReview?: DocumentReviewResult;
  };
  suggestions?: string[];
}

export interface DocumentReviewResult {
  text: string;
  flag: 'green' | 'red';
  extractedText?: string;
  warnings?: string[];
  provider?: string;
  readerProvider?: string;
}

export type DocumentReviewRuleType = 'ct01' | 'chung_minh_cho_o_hop_phap';

export type DocumentReviewUiStatus = 'checking' | 'valid' | 'invalid' | 'error';

export interface DocumentReviewUiState {
  status: DocumentReviewUiStatus;
  text: string;
  flag?: 'green' | 'red';
  result?: DocumentReviewResult;
}

// ============================================================
// CCCD / eKYC
// ============================================================
export interface CCCDInfo {
  id: string;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  queQuan: string;
  thuongTru: string;
  ngayCap: string;
  noiCap: string;
  rawText?: string;
}

// ============================================================
// Form System
// ============================================================
export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'file'
  | 'textarea'
  | 'phone';

/**
 * Nhóm các field đang hiển thị trên màn hình, phân theo khu vực (section/fieldset/card).
 * isPrimaryFocus = true nếu khu vực này chiếm diện tích lớn nhất trong viewport.
 */
export interface VisibleFieldGroup {
  sectionId?: string;
  sectionTitle?: string;
  fieldIds: string[];
  isPrimaryFocus?: boolean;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  step?: number;
  placeholder?: string;
  options?: FormFieldOption[];
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
  // Maps to CCCD field for auto-fill
  cccdKey?: keyof CCCDInfo;
  disabled?: boolean;
}

export interface FormValues {
  [fieldId: string]: string;
}

export interface FormState {
  values: FormValues;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
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
  /** true nếu case này đang thực sự nằm trong vùng nhìn thấy của màn hình lúc gửi tin nhắn. */
  isCurrentlyVisible?: boolean;
  isOpen?: boolean;
  selectionHint?: string;
  requirements?: AssistantPageRequirementContext[];
}

export interface AssistantPageSectionContext {
  id: string;
  title: string;
  isOpen?: boolean;
  isVisible?: boolean;
  /** true nếu section này đang thực sự nằm trong vùng nhìn thấy của màn hình lúc gửi tin nhắn. */
  isCurrentlyVisible?: boolean;
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

// ============================================================
// Public Services
// ============================================================
export interface PublicService {
  id: string;
  name: string;
  shortName: string;
  description: string;
  route: string;
  icon: string;
  category: string;
  processingTime: string;
  fee: string;
  fields: FormField[];
  requiredDocs: string[];
  steps: string[];
  keywords: string[];
  citizenSituations?: string[];
  citizenOutcomes?: string[];
  negativeHints?: string[];
}

// ============================================================
// Chatbot State
// ============================================================
export type ConversationState = 'IDLE' | 'REALTIME' | 'WAITING_FOR_CONFIRMATION';

export interface ChatbotState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isCallMode: boolean;
  callStatus: 'idle' | 'connecting' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'interrupting' | 'error';
  callStatusText: string | null;
  conversationState: ConversationState;
  requiresUserAction: boolean;
  confirmationSource: 'text' | 'voice' | null;
  highlightedElementId: string | null;
  pendingNavigation: { route: string; serviceName: string } | null;
  currentService: string | null;
  conversationVersion: number;
}

export type ChatbotAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'MINIMIZE' }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE_STATUS'; payload: { id: string; status: MessageStatus } }
  | { type: 'MARK_LATEST_ASSISTANT_INTERRUPTED'; payload: { interruptedAt: Date } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_SPEAKING'; payload: boolean }
  | { type: 'SET_CALL_MODE'; payload: boolean }
  | {
      type: 'SET_CALL_STATUS';
      payload: { status: ChatbotState['callStatus']; text?: string | null };
    }
  | { type: 'SET_REQUIRES_USER_ACTION'; payload: { action: boolean; source?: 'text' | 'voice' | null } }
  | { type: 'SET_HIGHLIGHT'; payload: string | null }
  | { type: 'SET_PENDING_NAV'; payload: { route: string; serviceName: string } | null }
  | { type: 'SET_CURRENT_SERVICE'; payload: string | null }
  | { type: 'CLEAR_MESSAGES' };

// ============================================================
// Voice
// ============================================================
export interface VoiceState {
  isRecording: boolean;
  audioLevel: number;
  transcript: string;
  error: string | null;
}

// ============================================================
// VNPT API
// ============================================================
export interface VNPTOCRResponse {
  errorCode: number;
  errorMessage: string;
  data: {
    type: string;
    info: Record<string, string>;
  };
}

export interface VNPTSTTResponse {
  transcript: string;
  confidence: number;
}

export interface VNPTSmartbotResponse {
  status: number;
  result: string;
  intent?: string;
  entities?: Record<string, string>;
}
