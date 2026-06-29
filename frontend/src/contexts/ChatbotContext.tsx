import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import type { ChatbotState, ChatbotAction, ChatMessage, AIResponse } from '../types';
import { smartbotService } from '../api/aiServices';
import { ttsService } from '../api/aiServices';
import { agentEventBus } from '../utils/eventBus';
import type { AgentEvent } from '../utils/eventBus';

// ============================================================
// Reducer
// ============================================================
const chatbotReducer = (state: ChatbotState, action: ChatbotAction): ChatbotState => {
  switch (action.type) {
    case 'OPEN': return { ...state, isOpen: true, isMinimized: false };
    case 'CLOSE': return { ...state, isOpen: false };
    case 'MINIMIZE': return { ...state, isMinimized: !state.isMinimized };
    case 'ADD_MESSAGE': return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_LISTENING': return { ...state, isListening: action.payload };
    case 'SET_SPEAKING': return { ...state, isSpeaking: action.payload };
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
  enableVoiceResponse: boolean;
  setEnableVoiceResponse: (v: boolean) => void;
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
  const [enableVoiceResponse, setEnableVoiceResponse] = React.useState(false);
  const messageIdCounter = useRef(0);

  // Dùng ref để tránh stale closure trong event handlers
  const onNavigateRef = useRef(onNavigate);
  const onFillFormRef = useRef(onFillForm);
  const enableVoiceRef = useRef(enableVoiceResponse);
  const currentRouteRef = useRef(currentRoute);
  const formValuesRef = useRef(formValues);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onFillFormRef.current = onFillForm;
    enableVoiceRef.current = enableVoiceResponse;
    currentRouteRef.current = currentRoute;
    formValuesRef.current = formValues;
  });

  const createMessageId = () => `msg_${Date.now()}_${messageIdCounter.current++}`;

  // Update smartbot với route hiện tại
  useEffect(() => {
    smartbotService.setCurrentRoute(currentRoute);
  }, [currentRoute]);

  // ============================================================
  // Hàm thêm message từ bot vào chat (dùng nội bộ)
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

    // Voice response
    if (enableVoiceRef.current) {
      ttsService.speak(content, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
      });
    }
  }, []);

  // ============================================================
  // ✅ Event-Driven: Lắng nghe tất cả AgentEvent từ agentEventBus
  // ============================================================
  useEffect(() => {
    const handleAgentEvent = (event: AgentEvent) => {
      switch (event.type) {
        case 'CHAT':
          addBotMessage(event.message, 'text', undefined, event.suggestions);
          break;

        case 'HIGHLIGHT_ELEMENT':
          addBotMessage(event.message, 'text', undefined, event.suggestions);
          // Cập nhật state để UIHighlighter (legacy path) cũng hoạt động
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

        case 'NAVIGATE':
          addBotMessage(event.message, 'navigation-confirm', undefined, event.suggestions);
          // Đặt pending navigation — user confirm thì mới navigate
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: event.route, serviceName: event.serviceName },
          });
          break;

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

    // Đăng ký wildcard listener — bắt tất cả events
    agentEventBus.on('*', handleAgentEvent);
    return () => agentEventBus.off('*', handleAgentEvent);
  }, [addBotMessage]);

  // ============================================================
  // handleAIResponse — vẫn hỗ trợ backward compat (mock/VNPT path)
  // Khi dùng OpenAI Tool Calling, event đã được emit qua agentEventBus
  // nên ChatbotContext chỉ cần hiển thị message (không re-process intent)
  // ============================================================
  const handleAIResponse = useCallback((response: AIResponse) => {
    // Nếu OpenAI Tool Calling đã emit event (và listener đã xử lý),
    // response này chỉ cần hiển thị message vào chat mà không trigger thêm action
    // Để tránh duplicate, chúng ta chỉ xử lý khi không phải Tool Calling path
    // (Tool Calling path đã được xử lý bởi agentEventBus listener ở trên)

    // Legacy path: mock / VNPT (không emit event) → xử lý trực tiếp
    const msg: ChatMessage = {
      id: createMessageId(),
      role: 'bot',
      type: response.intent === 'VALIDATE' ? 'validation-result'
        : response.intent === 'OCR_CONFIRM' ? 'cccd-preview'
        : response.intent === 'NAVIGATE' ? 'navigation-confirm'
        : 'text',
      content: response.message,
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
          dispatch({
            type: 'SET_PENDING_NAV',
            payload: { route: response.data.route, serviceName: response.data.serviceName },
          });
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

    if (enableVoiceRef.current) {
      ttsService.speak(response.message, (isPlaying) => {
        dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
      });
    }
  }, []);

  // ============================================================
  // sendMessage — điểm vào chính
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
      const errMsg: ChatMessage = {
        id: createMessageId(),
        role: 'bot',
        type: 'text',
        content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại! 🙏',
        timestamp: new Date(),
        suggestions: ['Thử lại', 'Tôi cần hỗ trợ'],
      };
      dispatch({ type: 'ADD_MESSAGE', payload: errMsg });
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
          content: 'Xin chào! Tôi là **Trợ lý AI Dịch Vụ Công**\n\nTôi có thể giúp bạn:\n• 📝 Tư vấn thủ tục hành chính\n• ✍️ Tự động điền form từ giọng nói\n• 📷 Đọc thông tin từ ảnh CCCD\n• 💡 Chỉ dẫn vị trí các nút trên trang\n\nBạn cần hỗ trợ gì hôm nay?',
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
      onNavigateRef.current(state.pendingNavigation.route);
      dispatch({ type: 'SET_PENDING_NAV', payload: null });

      const confirmMsg: ChatMessage = {
        id: createMessageId(),
        role: 'bot',
        type: 'text',
        content: `Đã chuyển đến trang **${state.pendingNavigation.serviceName}**! ✅\n\nBạn có thể bắt đầu điền thông tin. Tôi sẵn sàng hỗ trợ!`,
        timestamp: new Date(),
        suggestions: ['Điền bằng giọng nói', 'Upload ảnh CCCD', 'Hướng dẫn điền form'],
      };
      dispatch({ type: 'ADD_MESSAGE', payload: confirmMsg });

      if (window.innerWidth <= 768) {
        setTimeout(() => dispatch({ type: 'CLOSE' }), 600);
      }
    }
  }, [state.pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    dispatch({ type: 'SET_PENDING_NAV', payload: null });
  }, []);

  return (
    <ChatbotContext.Provider value={{
      state, dispatch, sendMessage, handleAIResponse,
      openChatbot, clearHighlight, confirmNavigation, cancelNavigation,
      enableVoiceResponse, setEnableVoiceResponse,
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
