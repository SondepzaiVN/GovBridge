import React, { useState } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { smartbotService } from '../../api/aiServices';
import { Minus, X, Volume2, VolumeX, RotateCcw } from 'lucide-react';

const ChatbotWidget: React.FC = () => {
  const { state, dispatch, sendMessage, enableVoiceResponse, setEnableVoiceResponse } = useChatbot();
  const [isExiting, setIsExiting] = useState(false);

  if (!state.isOpen) return null;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      dispatch({ type: 'CLOSE' });
      setIsExiting(false);
    }, 240);
  };

  const handleMinimize = () => {
    dispatch({ type: 'MINIMIZE' });
  };

  const handleClear = () => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    smartbotService.clearHistory();
    // Re-send welcome message
    setTimeout(() => {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: `msg_${Date.now()}`,
          role: 'bot',
          type: 'text',
          content: 'Đã xoá lịch sử chat! Tôi có thể giúp gì cho bạn? 😊',
          timestamp: new Date(),
          suggestions: ['Đăng ký khai sinh', 'Làm hộ khẩu mới', 'Cấp lại CCCD'],
        },
      });
    }, 100);
  };

  return (
    <div
      className={`chatbot-widget ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}
      role="dialog"
      aria-label="Trợ lý AI Dịch Vụ Công"
      aria-modal="false"
      id="chatbot-widget"
    >
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-avatar" style={{ padding: 0 }}>
          <img src="/logo_Gov_Bridge.jpg" alt="Gov Bridge" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          <div className="chatbot-status-dot" title="Đang hoạt động" />
        </div>

        <div className="chatbot-header-info">
          <div className="chatbot-header-name">Trợ lý AI DVC</div>
          <div className="chatbot-header-status">
            {state.isListening ? '🎤 Đang nghe...'
              : state.isSpeaking ? '🔊 Đang nói...'
              : state.isLoading ? '💭 Đang xử lý...'
              : smartbotService.getBackendInfo()}
          </div>
        </div>

        {/* Voice response toggle */}
        <button
          className={`voice-toggle ${enableVoiceResponse ? 'active' : ''}`}
          onClick={() => setEnableVoiceResponse(!enableVoiceResponse)}
          title={enableVoiceResponse ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
          id="voice-response-toggle"
        >
          {enableVoiceResponse ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {enableVoiceResponse ? 'Tắt' : 'Giọng'}
        </button>

        {/* Action buttons */}
        <div className="chatbot-header-actions">
          <button
            className="chatbot-header-btn"
            onClick={handleClear}
            title="Xoá lịch sử chat"
            aria-label="Xoá chat"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="chatbot-header-btn"
            onClick={handleMinimize}
            title={state.isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
            aria-label={state.isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
          >
            <Minus size={14} />
          </button>
          <button
            className="chatbot-header-btn"
            onClick={handleClose}
            title="Đóng"
            aria-label="Đóng chatbot"
            id="chatbot-close-btn"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!state.isMinimized && (
        <>
          <ChatWindow
            messages={state.messages}
            isLoading={state.isLoading}
          />
          <ChatInput
            onSend={sendMessage}
            disabled={state.isLoading}
          />
        </>
      )}
    </div>
  );
};

// ============================================================
// FAB (Floating Action Button)
// ============================================================
export const ChatbotFAB: React.FC = () => {
  const { state, openChatbot, dispatch, sendMessage } = useChatbot();
  const pttTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPTT, setIsPTT] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);
  // Track whether PTT was actually activated so onClick can be suppressed
  const pttActivatedRef = React.useRef(false);

  const handleClick = (e: React.MouseEvent) => {
    // If PTT was just activated, suppress the click toggle
    if (pttActivatedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      pttActivatedRef.current = false;
      return;
    }
    if (state.isOpen) {
      dispatch({ type: 'CLOSE' });
    } else {
      openChatbot();
    }
  };

  // PTT: hold FAB when chat is CLOSED to start voice
  const handlePointerDown = () => {
    if (state.isOpen) return; // normal click handled separately
    pttTimerRef.current = setTimeout(() => {
      pttActivatedRef.current = true; // mark PTT as activated to block onClick
      setIsPTT(true);
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const recognition: any = new SR();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = e.results[0][0].transcript;
        // Directly open chat then send the voice transcript as a message
        dispatch({ type: 'OPEN' });
        sendMessage(transcript);
      };
      recognition.onend = () => { setIsPTT(false); recognitionRef.current = null; };
      recognition.onerror = () => { setIsPTT(false); recognitionRef.current = null; };
      recognition.start();
      recognitionRef.current = recognition;
    }, 400); // hold 400ms to trigger PTT
  };

  const handlePointerUp = () => {
    if (pttTimerRef.current) {
      clearTimeout(pttTimerRef.current);
      pttTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Count unread messages (when chatbot is closed)
  const unreadCount = !state.isOpen
    ? state.messages.filter((m) => m.role === 'bot').length
    : 0;

  return (
    <div className={`chatbot-fab${state.isOpen ? ' chatbot-fab--open' : ''}${isPTT ? ' chatbot-fab--ptt' : ''}`}>
      <button
        className="chatbot-fab-btn"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-label={state.isOpen ? 'Đóng trợ lý AI' : 'Mở trợ lý AI Dịch Vụ Công'}
        title="Trợ lý AI Dịch Vụ Công"
        id="chatbot-fab"
      >
        <div className="chatbot-fab-pulse" />
        <div className="chatbot-fab-icon" style={!state.isOpen ? { width: 64, height: 64, borderRadius: '50%', padding: 2 } : {}}>
          {state.isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : isPTT ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93A8 8 0 0 1 4 12H2a10 10 0 0 0 9 9.93V23h2v-1.07A10 10 0 0 0 22 12h-2a8 8 0 0 1-7 7.93z"/>
              </svg>
            </div>
          ) : (
            <img src="/logo_Gov_Bridge.jpg" alt="Gov Bridge" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: 'white' }} />
          )}
        </div>
        {unreadCount > 0 && !state.isOpen && (
          <span className="chatbot-fab-badge" style={{ zIndex: 2 }}>{unreadCount}</span>
        )}
      </button>
      <div className="chatbot-fab-tooltip">{isPTT ? '🎤 Đang nghe...' : 'Trợ lý AI 24/7'}</div>
    </div>
  );
};

export default ChatbotWidget;
