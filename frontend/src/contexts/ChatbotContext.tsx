import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import type { ChatbotState, ChatbotAction, ChatMessage, AIResponse } from '../types';
import { smartbotService } from '../api/aiServices';
import { ttsService } from '../api/aiServices';
import { ApiClientError } from '../api/client';
import { agentEventBus } from '../utils/eventBus';
import type { AgentEvent } from '../utils/eventBus';

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

// ============================================================
// Reducer
// ============================================================
const chatbotReducer = (state: ChatbotState, action: ChatbotAction): ChatbotState => {
  switch (action.type) {
    case 'OPEN': return { ...state, isOpen: true, isMinimized: false };
    case 'CLOSE': return {
      ...state,
      isOpen: false,
      isCallMode: false,
      callStatus: 'idle',
      callStatusText: null,
    };
    case 'MINIMIZE': return { ...state, isMinimized: !state.isMinimized };
    case 'ADD_MESSAGE': return { ...state, messages: [...state.messages, action.payload] };
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
    case 'CLEAR_MESSAGES': return { ...state, messages: [] };
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
};

// ============================================================
// Context
// ============================================================
interface ChatbotContextValue {
  state: ChatbotState;
  dispatch: React.Dispatch<ChatbotAction>;
  sendMessage: (text: string) => Promise<void>;
  handleAIResponse: (response: AIResponse) => void;
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
}

export const ChatbotProvider: React.FC<ChatbotProviderProps> = ({
  children,
  onNavigate,
  onFillForm,
  currentRoute,
  formValues,
}) => {
  const [state, dispatch] = useReducer(chatbotReducer, initialState);
  const messageIdCounter = useRef(0);

  // Dùng ref để tránh stale closure trong event handlers.
  const onNavigateRef = useRef(onNavigate);
  const onFillFormRef = useRef(onFillForm);
  const callModeRef = useRef(state.isCallMode);
  const currentRouteRef = useRef(currentRoute);
  const formValuesRef = useRef(formValues);
  const requiresUserActionRef = useRef(state.requiresUserAction);
  const confirmationSourceRef = useRef(state.confirmationSource);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onFillFormRef.current = onFillForm;
    callModeRef.current = state.isCallMode;
    currentRouteRef.current = currentRoute;
    formValuesRef.current = formValues;
    requiresUserActionRef.current = state.requiresUserAction;
    confirmationSourceRef.current = state.confirmationSource;
  });

  const createMessageId = () => `msg_${Date.now()}_${messageIdCounter.current++}`;

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
    suggestions?: string[]
  ) => {
    const msg: ChatMessage = {
      id: createMessageId(),
      role: 'bot',
      type,
      content,
      timestamp: new Date(),
      data,
      suggestions,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });

    if (callModeRef.current) {
      ttsService.speak(content, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
        dispatch({
          type: 'SET_CALL_STATUS',
          payload: {
            status: isPlaying ? 'speaking' : 'idle',
            text: isPlaying ? 'Trợ lý đang trả lời bằng giọng nói...' : null,
          },
        });
      });
    }
  }, []);

  const enterConfirmationMode = useCallback(() => {
    const source = callModeRef.current ? 'voice' : 'text';
    callModeRef.current = false;
    ttsService.stop();
    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: true, source } });
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
          addBotMessage(event.message, 'text', undefined, event.suggestions);
          break;

        case 'HIGHLIGHT_ELEMENT':
          addBotMessage(event.message, 'text', undefined, event.suggestions);
          // Cập nhật state để UIHighlighter legacy path cũng hoạt động.
          if (window.innerWidth <= 768) {
            setTimeout(() => {
              dispatch({ type: 'CLOSE' });
              dispatch({ type: 'SET_HIGHLIGHT', payload: event.elementId });
            }, 400);
          } else {
            dispatch({ type: 'SET_HIGHLIGHT', payload: event.elementId });
          }
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
          enterConfirmationMode();
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
          speakConfirmation(confirmationMessage);
          break;
          }

        case 'NAVIGATE':
          {
          const confirmationMessage = withConfirmationGuidance(event.message);
          enterConfirmationMode();
          addBotMessage(confirmationMessage, 'navigation-confirm', undefined, event.suggestions);
          // Đặt pending navigation, user confirm thì mới navigate.
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: event.route, serviceName: event.serviceName },
          });
          speakConfirmation(confirmationMessage);
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
    return () => agentEventBus.off('*', handleAgentEvent);
  }, [addBotMessage, enterConfirmationMode, speakConfirmation]);

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
          enterConfirmationMode();
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: response.data.route, serviceName: response.data.serviceName },
          });
          speakConfirmation(responseMessage);
        }
        break;
      case 'HIGHLIGHT':
        if (response.data?.elementId) {
          if (window.innerWidth <= 768) {
            setTimeout(() => {
              dispatch({ type: 'CLOSE' });
              dispatch({ type: 'SET_HIGHLIGHT', payload: response.data!.elementId ?? null });
            }, 400);
          } else {
            dispatch({ type: 'SET_HIGHLIGHT', payload: response.data.elementId });
          }
        }
        break;
    }

    if (response.intent === 'OCR_CONFIRM') {
      enterConfirmationMode();
      speakConfirmation(responseMessage);
    }

    if (callModeRef.current) {
      ttsService.speak(response.message, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
        dispatch({
          type: 'SET_CALL_STATUS',
          payload: {
            status: isPlaying ? 'speaking' : 'idle',
            text: isPlaying ? 'Trợ lý đang trả lời bằng giọng nói...' : null,
          },
        });
      });
    }
  }, [enterConfirmationMode, speakConfirmation]);

  // ============================================================
  // sendMessage là điểm vào chính.
  // ============================================================
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });

    dispatch({ type: 'SET_LOADING', payload: true });
    if (callModeRef.current) {
      dispatch({
        type: 'SET_CALL_STATUS',
        payload: { status: 'thinking', text: 'Trợ lý đang suy nghĩ...' },
      });
    }

    try {
      const result = await smartbotService.sendMessage(text, {
        currentRoute: currentRouteRef.current,
        formValues: formValuesRef.current,
      });

      if (result.actions.length > 0) {
        result.actions.forEach((action) => agentEventBus.emit(action));
      } else {
        handleAIResponse(result.response);
      }
    } catch (err) {
      console.error('Send message error:', err);
      const message = err instanceof ApiClientError
        ? err.message + (err.code ? ' (' + err.code + ')' : '')
        : 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại!';
      const errMsg: ChatMessage = {
        id: createMessageId(),
        role: 'bot',
        type: 'text',
        content: message,
        timestamp: new Date(),
        suggestions: ['Thử lại', 'Tôi cần hỗ trợ'],
      };
      dispatch({ type: 'ADD_MESSAGE', payload: errMsg });

      if (callModeRef.current) {
        ttsService.speak(message, (isPlaying) => {
          dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [handleAIResponse]);

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

      window.setTimeout(() => {
        if (state.confirmationSource === 'voice') {
          resumeRealtimeWithVoice(
            `Em đã chuyển Anh/Chị sang trang ${pendingNavigation.serviceName}. Anh/Chị muốn em hướng dẫn điền thông tin, kiểm tra hồ sơ hay giải thích điều kiện thủ tục?`,
            ['Hướng dẫn điền thông tin', 'Kiểm tra hồ sơ', 'Giải thích điều kiện'],
          );
        } else {
          addBotMessage(
            `Em đã chuyển Anh/Chị sang trang ${pendingNavigation.serviceName}. Anh/Chị muốn em hướng dẫn điền thông tin, kiểm tra hồ sơ hay giải thích điều kiện thủ tục?`,
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
      addBotMessage(
        serviceName
          ? `Dạ, em sẽ không chuyển sang trang ${serviceName} nữa. Anh/Chị muốn em giải thích thêm về thủ tục này hay hỗ trợ việc khác?`
          : 'Dạ, em đã hủy thao tác. Anh/Chị muốn em hỗ trợ việc gì tiếp theo?',
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
    speakConfirmation(reviewMessage);
  }, [addBotMessage, speakConfirmation, state.pendingNavigation]);

  return (
    <ChatbotContext.Provider value={{
      state, dispatch, sendMessage, handleAIResponse,
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
