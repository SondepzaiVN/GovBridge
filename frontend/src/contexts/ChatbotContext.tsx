import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import type { AssistantPageContext, ChatbotState, ChatbotAction, ChatMessage, AIResponse } from '../types';
import { smartbotService, ttsService, type ClientInterruptedAssistantMessage } from '../api/aiServices';
import { agentEventBus } from '../utils/eventBus';
import type { AgentEvent } from '../utils/eventBus';
import { collectVisibleFieldGroups } from '../utils/visibleFormFields';
import {
  CONNECTIVITY_FALLBACK_MESSAGE,
  isLikelyConnectivityError,
  notifyConnectivityFallback,
  suppressConnectivityFallback,
} from '../utils/connectivityFallback';

const CONFIRMATION_GUIDANCE = 'Vui lòng lựa chọn để tiếp tục cuộc trò chuyện.';

const withConfirmationGuidance = (message: string) =>
  message.includes(CONFIRMATION_GUIDANCE)
    ? message
    : `${message.trim()}\n\n${CONFIRMATION_GUIDANCE}`;

const toSpeechText = (message: string) =>
  message
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const MAX_CLIENT_INTERRUPTED_ASSISTANT_MESSAGES = 5;

const toInterruptedAssistantMessage = (message: ChatMessage): ClientInterruptedAssistantMessage | null => {
  const content = message.content.trim();
  if (!content) return null;
  return {
    content,
    createdAt: message.interruptedAt?.toISOString() ?? message.timestamp.toISOString(),
  };
};

const hasSameInterruptedAssistantMessage = (
  messages: ClientInterruptedAssistantMessage[],
  candidate: ClientInterruptedAssistantMessage,
) =>
  messages.some((message) => message.content.trim() === candidate.content.trim());

// ============================================================
// Reducer
// ============================================================
const chatbotReducer = (state: ChatbotState, action: ChatbotAction): ChatbotState => {
  switch (action.type) {
    case 'OPEN': return { ...state, isOpen: true, isMinimized: false };
    case 'CLOSE_PANEL': return {
      ...state,
      isOpen: false,
      isMinimized: false,
    };
    case 'CLOSE': return {
      ...state,
      isOpen: false,
      isCallMode: false,
      isListening: false,
      isSpeaking: false,
      callStatus: 'idle',
      callStatusText: null,
      conversationState: state.requiresUserAction ? 'WAITING_FOR_CONFIRMATION' : 'IDLE',
    };
    case 'MINIMIZE': return { ...state, isMinimized: !state.isMinimized };
    case 'ADD_MESSAGE': return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE_STATUS': return {
      ...state,
      messages: state.messages.map((message) =>
        message.id === action.payload.id
          ? { ...message, status: action.payload.status }
          : message
      ),
    };
    case 'MARK_LATEST_ASSISTANT_INTERRUPTED': {
      const messages = [...state.messages];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== 'bot' || message.status !== 'speaking') continue;
        messages[index] = {
          ...message,
          status: 'interrupted',
          interruptedAt: action.payload.interruptedAt,
        };
        break;
      }
      return { ...state, messages };
    }
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_LISTENING': return { ...state, isListening: action.payload };
    case 'SET_SPEAKING': return { ...state, isSpeaking: action.payload };
    case 'SET_CALL_MODE': return {
      ...state,
      isOpen: action.payload ? false : state.isOpen,
      isCallMode: action.payload,
      callStatus: action.payload ? state.callStatus : 'idle',
      callStatusText: action.payload ? state.callStatusText : null,
      isListening: action.payload ? state.isListening : false,
      isSpeaking: action.payload ? state.isSpeaking : false,
      conversationState: action.payload
        ? 'REALTIME'
        : state.requiresUserAction
          ? 'WAITING_FOR_CONFIRMATION'
          : 'IDLE',
    };
    case 'SET_CALL_STATUS': return {
      ...state,
      callStatus: action.payload.status,
      callStatusText: action.payload.text ?? null,
    };
    case 'SET_REQUIRES_USER_ACTION': return {
      ...state,
      isOpen: action.payload.action ? true : state.isOpen,
      isCallMode: action.payload.action ? false : state.isCallMode,
      isListening: action.payload.action ? false : state.isListening,
      isSpeaking: action.payload.action ? false : state.isSpeaking,
      callStatus: action.payload.action ? 'idle' : state.callStatus,
      callStatusText: action.payload.action ? null : state.callStatusText,
      conversationState: action.payload.action
        ? 'WAITING_FOR_CONFIRMATION'
        : state.isCallMode
          ? 'REALTIME'
          : 'IDLE',
      requiresUserAction: action.payload.action,
      confirmationSource: action.payload.action ? (action.payload.source ?? null) : null,
    };
    case 'SET_HIGHLIGHT': return { ...state, highlightedElementId: action.payload };
    case 'SET_PENDING_NAV': return { ...state, pendingNavigation: action.payload };
    case 'SET_CURRENT_SERVICE': return { ...state, currentService: action.payload };
    case 'CLEAR_MESSAGES': return {
      ...state,
      messages: [],
      isLoading: false,
      requiresUserAction: false,
      confirmationSource: null,
      pendingNavigation: null,
      conversationState: state.isCallMode ? 'REALTIME' : 'IDLE',
      conversationVersion: state.conversationVersion + 1,
    };
    default: return state;
  }
};

const initialState: ChatbotState = {
  isOpen: false,
  isMinimized: false,
  messages: [],
  isLoading: false,
  isListening: false,
  isSpeaking: false,
  isCallMode: false,
  callStatus: 'idle',
  callStatusText: null,
  conversationState: 'IDLE',
  requiresUserAction: false,
  confirmationSource: null,
  highlightedElementId: null,
  pendingNavigation: null,
  currentService: null,
  conversationVersion: 0,
};

// ============================================================
// Context
// ============================================================
interface ChatbotContextValue {
  state: ChatbotState;
  dispatch: React.Dispatch<ChatbotAction>;
  sendMessage: (text: string) => Promise<void>;
  cancelAssistantResponse: () => void;
  handleAIResponse: (response: AIResponse) => void;
  interruptAssistantTurn: () => void;
  openChatbot: () => void;
  clearHighlight: () => void;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  reviewNavigation: () => void;
  resumeRealtimeWithVoice: (message: string, suggestions?: string[]) => void;
}

const ChatbotContext = createContext<ChatbotContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
interface ChatbotProviderProps {
  children: React.ReactNode;
  onNavigate: (route: string) => void;
  onFillForm: (fields: Record<string, string>) => void;
  currentRoute: string;
  formValues: Record<string, string>;
  pageContext: AssistantPageContext | null;
}

interface ChatMessageRequest {
  id: string;
  text: string;
  conversationVersion: number;
}

export const ChatbotProvider: React.FC<ChatbotProviderProps> = ({
  children,
  onNavigate,
  onFillForm,
  currentRoute,
  formValues,
  pageContext,
}) => {
  const [state, dispatch] = useReducer(chatbotReducer, initialState);
  const messageIdCounter = useRef(0);
  const messagesRef = useRef<ChatMessage[]>(state.messages);
  const pendingInterruptedAssistantMessagesRef = useRef<ClientInterruptedAssistantMessage[]>([]);
  const isProcessingMessageRef = useRef(false);
  const activeGenerationRef = useRef(0);
  const assistantAbortControllerRef = useRef<AbortController | null>(null);
  const activeMessageRequestIdRef = useRef<string | null>(null);

  // Dùng ref để tránh stale closure trong event handlers.
  const onNavigateRef = useRef(onNavigate);
  const onFillFormRef = useRef(onFillForm);
  const callModeRef = useRef(state.isCallMode);
  const currentRouteRef = useRef(currentRoute);
  const formValuesRef = useRef(formValues);
  const pageContextRef = useRef(pageContext);
  const requiresUserActionRef = useRef(state.requiresUserAction);
  const confirmationSourceRef = useRef(state.confirmationSource);
  const conversationVersionRef = useRef(state.conversationVersion);
  const pendingHighlightSpeechRef = useRef<string | null>(null);
  const pendingHighlightShouldSpeakRef = useRef(false);
  const pendingHighlightMessageIdRef = useRef<string | null>(null);
  const highlightSpeechTimerRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = state.messages;
    if (state.messages.length === 0) {
      pendingInterruptedAssistantMessagesRef.current = [];
    }
    if (conversationVersionRef.current !== state.conversationVersion) {
      conversationVersionRef.current = state.conversationVersion;
    }
    onNavigateRef.current = onNavigate;
    onFillFormRef.current = onFillForm;
    callModeRef.current = state.isCallMode;
    currentRouteRef.current = currentRoute;
    formValuesRef.current = formValues;
    pageContextRef.current = pageContext;
    requiresUserActionRef.current = state.requiresUserAction;
    confirmationSourceRef.current = state.confirmationSource;
  });

  const rememberLatestInterruptedAssistantMessage = useCallback(() => {
    for (let index = messagesRef.current.length - 1; index >= 0; index -= 1) {
      const message = messagesRef.current[index];
      if (message.role !== 'bot' || message.status !== 'speaking') continue;
      const interruptedMessage = toInterruptedAssistantMessage({
        ...message,
        interruptedAt: new Date(),
      });
      if (!interruptedMessage) return;
      if (hasSameInterruptedAssistantMessage(
        pendingInterruptedAssistantMessagesRef.current,
        interruptedMessage,
      )) {
        return;
      }
      pendingInterruptedAssistantMessagesRef.current = [
        ...pendingInterruptedAssistantMessagesRef.current,
        interruptedMessage,
      ].slice(-MAX_CLIENT_INTERRUPTED_ASSISTANT_MESSAGES);
      return;
    }
  }, []);

  const collectInterruptedAssistantMessages = useCallback(() => {
    const messages = [...pendingInterruptedAssistantMessagesRef.current];
    for (const message of messagesRef.current) {
      if (message.role !== 'bot' || message.status !== 'interrupted') continue;
      const interruptedMessage = toInterruptedAssistantMessage(message);
      if (!interruptedMessage || hasSameInterruptedAssistantMessage(messages, interruptedMessage)) continue;
      messages.push(interruptedMessage);
    }
    return messages.slice(-MAX_CLIENT_INTERRUPTED_ASSISTANT_MESSAGES);
  }, []);

  const createMessageId = () => `msg_${Date.now()}_${messageIdCounter.current++}`;

  const speakPendingHighlight = useCallback(() => {
    const message = pendingHighlightSpeechRef.current;
    const shouldSpeak = pendingHighlightShouldSpeakRef.current;
    if (!message || !shouldSpeak) {
      pendingHighlightSpeechRef.current = null;
      pendingHighlightShouldSpeakRef.current = false;
      pendingHighlightMessageIdRef.current = null;
      return;
    }

    const messageId = pendingHighlightMessageIdRef.current;
    pendingHighlightSpeechRef.current = null;
    pendingHighlightShouldSpeakRef.current = false;
    pendingHighlightMessageIdRef.current = null;
    if (highlightSpeechTimerRef.current !== null) {
      window.clearTimeout(highlightSpeechTimerRef.current);
      highlightSpeechTimerRef.current = null;
    }
    void ttsService.speak(toSpeechText(message), (isPlaying) => {
      dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
      if (!isPlaying && messageId) {
        dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: messageId, status: 'completed' } });
      }
      dispatch({
        type: 'SET_CALL_STATUS',
        payload: {
          status: isPlaying ? 'speaking' : 'idle',
          text: isPlaying ? 'Trợ lý đang đọc nội dung chỉ dẫn...' : null,
        },
      });
    });
  }, []);

  // Update smartbot với route hiện tại.
  useEffect(() => {
    smartbotService.setCurrentRoute(currentRoute);
  }, [currentRoute]);

  // ============================================================
  // Hàm thêm message từ bot vào chat.
  // ============================================================
  const addBotMessage = useCallback((
    content: string,
    type: ChatMessage['type'] = 'text',
    data?: Record<string, unknown>,
    suggestions?: string[],
    options: { speak?: boolean } = {},
  ) => {
    const shouldSpeak = callModeRef.current && options.speak !== false;
    const msg: ChatMessage = {
      id: createMessageId(),
      role: 'bot',
      type,
      content,
      timestamp: new Date(),
      status: callModeRef.current ? 'speaking' : 'completed',
      generationId: activeGenerationRef.current,
      data,
      suggestions,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });

    if (shouldSpeak) {
      ttsService.speak(content, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
        if (!isPlaying) {
          dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: msg.id, status: 'completed' } });
        }
        dispatch({
          type: 'SET_CALL_STATUS',
          payload: {
            status: isPlaying ? 'speaking' : 'idle',
            text: isPlaying ? 'Trợ lý đang trả lời bằng giọng nói...' : null,
          },
        });
      });
    }

    return msg.id;
  }, []);

  const enterConfirmationMode = useCallback(() => {
    const source = callModeRef.current ? 'voice' : 'text';
    callModeRef.current = false;
    ttsService.stop();
    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: true, source } });
    return source;
  }, []);

  const speakConfirmation = useCallback((message: string) => {
    void ttsService.speak(toSpeechText(message), (isPlaying) => {
      dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
      dispatch({
        type: 'SET_CALL_STATUS',
        payload: {
          status: isPlaying ? 'speaking' : 'idle',
          text: isPlaying ? 'Trợ lý đang đọc yêu cầu xác nhận...' : null,
        },
      });
    });
  }, []);

  const resumeRealtimeWithVoice = useCallback((message: string, suggestions?: string[]) => {
    callModeRef.current = true;

    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
    dispatch({ type: 'SET_CALL_MODE', payload: true });
    dispatch({
      type: 'SET_CALL_STATUS',
      payload: { status: 'thinking', text: 'Đang chuẩn bị phản hồi bằng giọng nói...' },
    });
    addBotMessage(message, 'text', undefined, suggestions);
  }, [addBotMessage]);

  // ============================================================
  // Event-driven: lắng nghe tất cả AgentEvent từ agentEventBus.
  // ============================================================
  useEffect(() => {
    const handleAgentEvent = (event: AgentEvent) => {
      switch (event.type) {
        case 'CHAT':
          addBotMessage(event.message, 'text', event.data, event.suggestions);
          if (event.data?.documentReview) {
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'OPEN' });
          }
          break;

        case 'HIGHLIGHT_ELEMENT':
          {
          const shouldSpeakAfterHighlight = callModeRef.current;
          if (shouldSpeakAfterHighlight) {
            ttsService.stop();
          }
          const messageId = addBotMessage(
            event.message,
            'text',
            undefined,
            event.suggestions,
            { speak: false },
          );
          // Thu chat xuống trước để không che phần giao diện đang được chỉ dẫn.
          dispatch({ type: 'CLOSE_PANEL' });
          dispatch({ type: 'SET_HIGHLIGHT', payload: event.elementId });
          pendingHighlightSpeechRef.current = event.message;
          pendingHighlightShouldSpeakRef.current = shouldSpeakAfterHighlight;
          pendingHighlightMessageIdRef.current = shouldSpeakAfterHighlight ? messageId : null;
          if (highlightSpeechTimerRef.current !== null) {
            window.clearTimeout(highlightSpeechTimerRef.current);
          }
          highlightSpeechTimerRef.current = window.setTimeout(
            speakPendingHighlight,
            1_200,
          );
          break;
          }

        case 'HIGHLIGHT_READY':
          // Chỉ đọc sau khi spotlight đã cuộn tới và hiển thị xong.
          speakPendingHighlight();
          break;

        case 'FILL_FORM':
          addBotMessage(event.message, 'form-filled', undefined, event.suggestions);
          onFillFormRef.current(event.fields);
          if (window.innerWidth <= 768) {
            setTimeout(() => dispatch({ type: 'CLOSE' }), 800);
          }
          break;

        case 'REQUEST_CONFIRM_FILL':
          {
          const confirmationMessage = withConfirmationGuidance(event.message);
          const source = enterConfirmationMode();
          addBotMessage(
            confirmationMessage,
            'fill-confirm',
            {
              fields: event.fields,
              fieldLabels: event.fieldLabels,
              previousValues: event.previousValues,
            },
            event.suggestions,
          );
          if (source === 'voice') speakConfirmation(confirmationMessage);
          break;
          }

        case 'NAVIGATE':
          {
          const confirmationMessage = withConfirmationGuidance(event.message);
          const source = enterConfirmationMode();
          addBotMessage(confirmationMessage, 'navigation-confirm', undefined, event.suggestions);
          // Đặt pending navigation, user confirm thì mới navigate.
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: event.route, serviceName: event.serviceName },
          });
          if (source === 'voice') speakConfirmation(confirmationMessage);
          break;
          }

        case 'VALIDATE_FORM':
          addBotMessage(
            event.message,
            'validation-result',
            { validationErrors: event.validationErrors },
            event.suggestions
          );
          break;

        case 'SHOW_SERVICE_INFO':
          addBotMessage(event.message, 'text', undefined, event.suggestions);
          break;

        case 'ERROR':
          addBotMessage(event.message, 'text', undefined, ['Thử lại', 'Tôi cần hỗ trợ']);
          break;

        case 'NEXT_STEP':
          if (event.message) {
            addBotMessage(event.message, 'text', undefined, event.suggestions);
          }
          break;
      }
    };

    // Đăng ký wildcard listener để bắt tất cả events.
    agentEventBus.on('*', handleAgentEvent);
    return () => {
      agentEventBus.off('*', handleAgentEvent);
      if (highlightSpeechTimerRef.current !== null) {
        window.clearTimeout(highlightSpeechTimerRef.current);
        highlightSpeechTimerRef.current = null;
      }
    };
  }, [addBotMessage, enterConfirmationMode, speakConfirmation, speakPendingHighlight]);

  // ============================================================
  // handleAIResponse vẫn hỗ trợ backward compatibility cho mock/VNPT path.
  // Khi dùng OpenAI Tool Calling, event đã được emit qua agentEventBus.
  // ============================================================
  const handleAIResponse = useCallback((response: AIResponse) => {
    // Legacy path: mock/VNPT không emit event thì xử lý trực tiếp.
    const isConfirmation = response.intent === 'NAVIGATE' || response.intent === 'OCR_CONFIRM';
    const responseMessage = isConfirmation
      ? withConfirmationGuidance(response.message)
      : response.message;
    const msg: ChatMessage = {
      id: createMessageId(),
      role: 'bot',
      type: response.intent === 'VALIDATE' ? 'validation-result'
        : response.intent === 'OCR_CONFIRM' ? 'cccd-preview'
        : response.intent === 'NAVIGATE' ? 'navigation-confirm'
        : 'text',
      content: responseMessage,
      timestamp: new Date(),
      status: callModeRef.current ? 'speaking' : 'completed',
      generationId: activeGenerationRef.current,
      data: response.data as Record<string, unknown> | undefined,
      suggestions: response.suggestions,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });

    switch (response.intent) {
      case 'FILL_FORM':
        if (response.data?.fields) {
          onFillFormRef.current(response.data.fields as Record<string, string>);
          if (window.innerWidth <= 768) {
            setTimeout(() => dispatch({ type: 'CLOSE' }), 800);
          }
        }
        break;
      case 'NAVIGATE':
        if (response.data?.route && response.data?.serviceName) {
          const source = enterConfirmationMode();
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: response.data.route, serviceName: response.data.serviceName },
          });
          if (source === 'voice') speakConfirmation(responseMessage);
        }
        break;
      case 'HIGHLIGHT':
        if (response.data?.elementId) {
          const shouldSpeakAfterHighlight = callModeRef.current;
          if (shouldSpeakAfterHighlight) {
            ttsService.stop();
          }
          dispatch({ type: 'CLOSE_PANEL' });
          dispatch({ type: 'SET_HIGHLIGHT', payload: response.data.elementId });
          pendingHighlightSpeechRef.current = response.message;
          pendingHighlightShouldSpeakRef.current = shouldSpeakAfterHighlight;
          pendingHighlightMessageIdRef.current = shouldSpeakAfterHighlight ? msg.id : null;
          if (highlightSpeechTimerRef.current !== null) {
            window.clearTimeout(highlightSpeechTimerRef.current);
          }
          highlightSpeechTimerRef.current = window.setTimeout(
            speakPendingHighlight,
            1_200,
          );
        }
        break;
    }

    if (response.intent === 'OCR_CONFIRM') {
      const source = enterConfirmationMode();
      if (source === 'voice') speakConfirmation(responseMessage);
    }

    if (callModeRef.current && response.intent !== 'HIGHLIGHT') {
      ttsService.speak(response.message, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
        if (!isPlaying) {
          dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: msg.id, status: 'completed' } });
        }
        dispatch({
          type: 'SET_CALL_STATUS',
          payload: {
            status: isPlaying ? 'speaking' : 'idle',
            text: isPlaying ? 'Trợ lý đang trả lời bằng giọng nói...' : null,
          },
        });
      });
    }
  }, [enterConfirmationMode, speakConfirmation, speakPendingHighlight]);

  const interruptAssistantTurn = useCallback(() => {
    rememberLatestInterruptedAssistantMessage();
    activeGenerationRef.current += 1;
    suppressConnectivityFallback();
    assistantAbortControllerRef.current?.abort();
    assistantAbortControllerRef.current = null;
    activeMessageRequestIdRef.current = null;
    isProcessingMessageRef.current = false;
    ttsService.stop();

    dispatch({ type: 'MARK_LATEST_ASSISTANT_INTERRUPTED', payload: { interruptedAt: new Date() } });
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'SET_SPEAKING', payload: false });
    dispatch({
      type: 'SET_CALL_STATUS',
      payload: { status: 'interrupting', text: 'Đã nghe bạn, tôi dừng câu trả lời hiện tại...' },
    });
    console.info('[Voice] interrupt requested: current generation invalidated and audio stopped.');
  }, [rememberLatestInterruptedAssistantMessage]);

  const cancelAssistantResponse = useCallback(() => {
    const activeMessageId = activeMessageRequestIdRef.current;
    activeGenerationRef.current += 1;
    suppressConnectivityFallback();
    assistantAbortControllerRef.current?.abort();
    assistantAbortControllerRef.current = null;
    activeMessageRequestIdRef.current = null;
    isProcessingMessageRef.current = false;
    ttsService.stop();

    if (activeMessageId) {
      dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: activeMessageId, status: 'cancelled' } });
    }
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'SET_SPEAKING', payload: false });
    console.info('[Assistant] text response cancelled by user.');
  }, []);

  const processMessage = useCallback(async (messageRequest: ChatMessageRequest) => {
    const generationId = activeGenerationRef.current + 1;
    activeGenerationRef.current = generationId;
    const controller = new AbortController();
    assistantAbortControllerRef.current = controller;
    activeMessageRequestIdRef.current = messageRequest.id;
    isProcessingMessageRef.current = true;
    dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: messageRequest.id, status: 'processing' } });
    dispatch({ type: 'SET_LOADING', payload: true });

    if (callModeRef.current) {
      dispatch({
        type: 'SET_CALL_STATUS',
        payload: { status: 'thinking', text: 'Trợ lý đang suy nghĩ...' },
      });
    }

    try {
      const visibleFieldGroups = collectVisibleFieldGroups();

      // Thu thập tất cả sectionId đang hiển thị trong viewport
      const visibleSectionIds = new Set(
        visibleFieldGroups
          .filter((g) => g.sectionId)
          .map((g) => g.sectionId as string),
      );
      // Clone pageContext và đánh dấu isCurrentlyVisible cho từng case/section
      const rawPageContext = pageContextRef.current;
      const enrichedPageContext = rawPageContext
        ? {
            ...rawPageContext,
            sections: rawPageContext.sections?.map((section) => ({
              ...section,
              isCurrentlyVisible:
                visibleSectionIds.has(section.id)
                || Boolean(section.isVisible),
            })),
            residenceRegistration: rawPageContext.residenceRegistration
              ? {
                  ...rawPageContext.residenceRegistration,
                  uploadCases: rawPageContext.residenceRegistration.uploadCases?.map((uploadCase) => ({
                    ...uploadCase,
                    isCurrentlyVisible:
                      visibleSectionIds.has(uploadCase.id)
                      || visibleFieldGroups.some((g) =>
                        g.fieldIds.some((fid) => fid.startsWith(uploadCase.id))
                      )
                      || Boolean(uploadCase.isVisible),
                  })),
                }
              : undefined,
          }
        : null;

      const result = await smartbotService.sendMessage(messageRequest.text, {
        currentRoute: currentRouteRef.current,
        formValues: formValuesRef.current,
        pageContext: enrichedPageContext,
        visibleFieldGroups,
        clientInterruptedAssistantMessages: collectInterruptedAssistantMessages(),
      }, {
        signal: controller.signal,
      });

      if (
        messageRequest.conversationVersion !== conversationVersionRef.current
        || controller.signal.aborted
        || generationId !== activeGenerationRef.current
      ) {
        if (generationId === activeGenerationRef.current) {
          isProcessingMessageRef.current = false;
          dispatch({ type: 'SET_LOADING', payload: false });
        }
        return;
      }

      if (result.actions.length > 0) {
        result.actions.forEach((action) => agentEventBus.emit(action));
      } else {
        handleAIResponse(result.response);
      }
      dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: messageRequest.id, status: 'completed' } });
    } catch (err) {
      if (
        messageRequest.conversationVersion !== conversationVersionRef.current
        || controller.signal.aborted
        || generationId !== activeGenerationRef.current
        || isAbortError(err)
      ) {
        console.info('[Assistant] request ignored after interruption or conversation change.');
        return;
      }

      console.error('Send message error:', err);
      dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: messageRequest.id, status: 'failed' } });
      const isConnectivityIssue = isLikelyConnectivityError(err);
      const message = isConnectivityIssue
        ? CONNECTIVITY_FALLBACK_MESSAGE
        : 'Mình đã nhận được câu hỏi nhưng hệ thống chưa thể phân tích đủ tin cậy để trả lời chính xác. Bạn hãy cho biết rõ mục tiêu cần hỗ trợ và thông tin chính liên quan, chẳng hạn muốn tra cứu thủ tục, thao tác trên màn hình hay điền biểu mẫu.';
      const errMsg: ChatMessage = {
        id: createMessageId(),
        role: 'bot',
        type: 'text',
        content: message,
        timestamp: new Date(),
        suggestions: isConnectivityIssue
          ? ['Kiểm tra Wi-Fi', 'Thử lại sau']
          : ['Tra cứu thủ tục', 'Hướng dẫn thao tác', 'Điền biểu mẫu'],
      };
      dispatch({ type: 'ADD_MESSAGE', payload: errMsg });

      if (callModeRef.current) {
        if (isConnectivityIssue) {
          dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'error', text: message },
          });
          dispatch({ type: 'SET_SPEAKING', payload: true });
          notifyConnectivityFallback({ playAudio: true });
          window.setTimeout(() => dispatch({ type: 'SET_SPEAKING', payload: false }), 4_000);
        } else {
          ttsService.speak(message, (isPlaying) => {
            dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
          });
        }
      } else if (isConnectivityIssue) {
        notifyConnectivityFallback();
      }
    } finally {
      if (assistantAbortControllerRef.current === controller) {
        assistantAbortControllerRef.current = null;
      }
      if (activeMessageRequestIdRef.current === messageRequest.id) {
        activeMessageRequestIdRef.current = null;
      }
      const shouldIgnoreStaleRequest =
        messageRequest.conversationVersion !== conversationVersionRef.current
        || controller.signal.aborted
        || generationId !== activeGenerationRef.current;

      if (shouldIgnoreStaleRequest) {
        if (generationId === activeGenerationRef.current && !controller.signal.aborted) {
          isProcessingMessageRef.current = false;
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else {
        isProcessingMessageRef.current = false;
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  }, [collectInterruptedAssistantMessages, handleAIResponse]);

  // ============================================================
  // sendMessage là điểm vào chính.
  // ============================================================
  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    if (isProcessingMessageRef.current) return;

    const messageRequest: ChatMessageRequest = {
      id: createMessageId(),
      text: trimmedText,
      conversationVersion: conversationVersionRef.current,
    };
    const userMsg: ChatMessage = {
      id: messageRequest.id,
      role: 'user',
      type: 'text',
      content: trimmedText,
      timestamp: new Date(),
      status: 'processing',
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });

    await processMessage(messageRequest);
  }, [processMessage]);

  const openChatbot = useCallback(() => {
    dispatch({ type: 'OPEN' });

    if (state.messages.length === 0) {
      setTimeout(() => {
        const welcomeMsg: ChatMessage = {
          id: createMessageId(),
          role: 'bot',
          type: 'text',
          content: 'Xin chào! Tôi là **Trợ lý AI Dịch Vụ Công**\n\nTôi có thể giúp bạn:\n- Tư vấn thủ tục hành chính\n- Tự động điền form từ giọng nói\n- Đọc thông tin từ ảnh CCCD\n- Chỉ dẫn vị trí các nút trên trang\n\nBạn cần hỗ trợ gì hôm nay?',
          timestamp: new Date(),
          suggestions: ['Đăng ký khai sinh', 'Làm hộ khẩu mới', 'Cấp lại CCCD', 'Đăng ký kết hôn'],
        };
        dispatch({ type: 'ADD_MESSAGE', payload: welcomeMsg });
      }, 300);
    }
  }, [state.messages.length]);

  const clearHighlight = useCallback(() => {
    dispatch({ type: 'SET_HIGHLIGHT', payload: null });
  }, []);

  const confirmNavigation = useCallback(() => {
    if (state.pendingNavigation) {
      const pendingNavigation = state.pendingNavigation;
      addBotMessage(`Em đang chuyển Anh/Chị sang trang **${pendingNavigation.serviceName}**...`);
      onNavigateRef.current(pendingNavigation.route);
      dispatch({ type: 'SET_PENDING_NAV', payload: null });
      dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
      dispatch({ type: 'CLOSE' });

      window.setTimeout(() => {
        if (state.confirmationSource === 'voice') {
          resumeRealtimeWithVoice(
            `Em đã chuyển Anh/Chị sang trang ${pendingNavigation.serviceName}. Anh/Chị muốn em hướng dẫn điền thông tin, kiểm tra hồ sơ hay giải thích điều kiện thủ tục?`,
            ['Hướng dẫn điền thông tin', 'Kiểm tra hồ sơ', 'Giải thích điều kiện'],
          );
        } else {
          const followUpMessage = `Em đã chuyển Anh/Chị sang trang ${pendingNavigation.serviceName}. Anh/Chị muốn em hướng dẫn điền thông tin, kiểm tra hồ sơ hay giải thích điều kiện thủ tục?`;
          addBotMessage(
            followUpMessage,
            'text',
            undefined,
            ['Hướng dẫn điền thông tin', 'Kiểm tra hồ sơ', 'Giải thích điều kiện']
          );
        }
      }, 120);
    }
  }, [addBotMessage, resumeRealtimeWithVoice, state.pendingNavigation, state.confirmationSource]);

  const cancelNavigation = useCallback(() => {
    const serviceName = state.pendingNavigation?.serviceName;
    dispatch({ type: 'SET_PENDING_NAV', payload: null });
    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });

    if (state.confirmationSource === 'voice') {
      resumeRealtimeWithVoice(
        serviceName
          ? `Dạ, em sẽ không chuyển sang trang ${serviceName} nữa. Anh/Chị muốn em giải thích thêm về thủ tục này hay hỗ trợ việc khác?`
          : 'Dạ, em đã hủy thao tác. Anh/Chị muốn em hỗ trợ việc gì tiếp theo?',
        ['Giải thích thêm', 'Hỗ trợ việc khác', 'Tiếp tục bằng giọng nói'],
      );
    } else {
      const cancelMessage = serviceName
        ? `Dạ, em sẽ không chuyển sang trang ${serviceName} nữa. Anh/Chị muốn em giải thích thêm về thủ tục này hay hỗ trợ việc khác?`
        : 'Dạ, em đã hủy thao tác. Anh/Chị muốn em hỗ trợ việc gì tiếp theo?';
      addBotMessage(
        cancelMessage,
        'text',
        undefined,
        ['Giải thích thêm', 'Hỗ trợ việc khác']
      );
    }
  }, [addBotMessage, resumeRealtimeWithVoice, state.pendingNavigation, state.confirmationSource]);

  const reviewNavigation = useCallback(() => {
    if (!state.pendingNavigation) return;
    const reviewMessage = withConfirmationGuidance(
      `Đây là thông tin em sẽ dùng: chuyển Anh/Chị đến trang **${state.pendingNavigation.serviceName}** (${state.pendingNavigation.route}). Anh/Chị muốn tiếp tục chuyển trang không?`,
    );
    addBotMessage(
      reviewMessage,
      'navigation-confirm',
    );
    if (state.confirmationSource === 'voice') speakConfirmation(reviewMessage);
  }, [addBotMessage, speakConfirmation, state.pendingNavigation, state.confirmationSource]);

  return (
    <ChatbotContext.Provider value={{
      state, dispatch, sendMessage, handleAIResponse,
      cancelAssistantResponse,
      interruptAssistantTurn,
      openChatbot, clearHighlight, confirmNavigation, cancelNavigation, reviewNavigation,
      resumeRealtimeWithVoice,
    }}>
      {children}
    </ChatbotContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChatbot = () => {
  const ctx = useContext(ChatbotContext);
  if (!ctx) throw new Error('useChatbot must be used within ChatbotProvider');
  return ctx;
};
