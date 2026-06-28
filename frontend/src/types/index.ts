// ============================================================
// Chat Message Types
// ============================================================
export type MessageRole = 'user' | 'bot' | 'system';

export type MessageType =
  | 'text'
  | 'voice'
  | 'image'
  | 'cccd-preview'
  | 'navigation-confirm'
  | 'validation-result'
  | 'form-filled'
  | 'loading';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: Date;
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
  };
  suggestions?: string[];
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

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
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
}

// ============================================================
// Chatbot State
// ============================================================
export interface ChatbotState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  highlightedElementId: string | null;
  pendingNavigation: { route: string; serviceName: string } | null;
  currentService: string | null;
}

export type ChatbotAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'MINIMIZE' }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_SPEAKING'; payload: boolean }
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
