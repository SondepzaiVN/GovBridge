import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Mic, MicOff, Minimize2, Phone, RotateCcw, Sparkles, X } from 'lucide-react';
import { smartbotService, sttService, ttsService } from '../../api/aiServices';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useAuth } from '../../contexts/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatInput from './ChatInput';
import ChatWindow from './ChatWindow';

interface ChatHeaderProps {
    title: string;
    subtitle: string;
    onClear: () => void;
    onClose: () => void;
    onMinimize?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
    title,
    subtitle,
    onClear,
    onClose,
    onMinimize,
}) => {
    const { state } = useChatbot();
    const statusText = state.isCallMode
        ? state.callStatusText ?? 'Đang trong cuộc gọi'
        : state.isLoading
          ? 'Trợ lý đang tra cứu...'
          : subtitle;

    return (
        <div className="chatbot-header">
            <div className="chatbot-avatar" style={{ padding: 0 }}>
                <img
                    src="/logo_Gov_Bridge.jpg"
                    alt="Gov Bridge"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
                <div className="chatbot-status-dot" title="Đang hoạt động" />
            </div>

            <div className="chatbot-header-info">
                <div className="chatbot-header-name">{title}</div>
                <div className="chatbot-header-status">{statusText}</div>
            </div>

            {state.isCallMode && (
                <div className="call-header-pill" aria-label="Đang trong cuộc gọi">
                    <Phone size={13} />
                    Cuộc gọi
                </div>
            )}

            <div className="chatbot-header-actions">
                <button
                    className="chatbot-header-btn"
                    onClick={onClear}
                    title="Xoá lịch sử chat"
                    aria-label="Xoá chat"
                    type="button"
                >
                    <RotateCcw size={14} />
                </button>

                {onMinimize && (
                    <button
                        className="chatbot-header-btn"
                        onClick={onMinimize}
                        title="Thu nhỏ"
                        aria-label="Thu nhỏ overlay"
                        type="button"
                    >
                        <Minimize2 size={14} />
                    </button>
                )}

                <button
                    className="chatbot-header-btn"
                    onClick={onClose}
                    title="Đóng"
                    aria-label="Đóng chatbot"
                    id="chatbot-close-btn"
                    type="button"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

const WelcomeState: React.FC = () => {
    const { sendMessage } = useChatbot();
    const suggestions = [
        'Đăng ký tạm trú',
        'Liên thông khai sinh',
        'Cấp lại CCCD',
        'Cần chuẩn bị giấy tờ gì?',
    ];

    return (
        <div className="chatbot-welcome-state">
            <div className="chatbot-welcome-icon">
                <Sparkles size={22} />
            </div>
            <h2>Xin chào, tôi có thể giúp gì cho bạn?</h2>
            <div className="chatbot-welcome-chips">
                {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => sendMessage(item)}>
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};

const getCallStatusLabel = (
    callStatus: ReturnType<typeof useChatbot>['state']['callStatus'],
    callStatusText: string | null,
) => callStatusText ?? (
    callStatus === 'connecting' ? 'Đang kết nối VNPT SmartVoice...'
        : callStatus === 'listening' ? 'Đang lắng nghe...'
        : callStatus === 'transcribing' ? 'Đang nhận dạng giọng nói...'
        : callStatus === 'thinking' ? 'Trợ lý đang suy nghĩ...'
        : callStatus === 'speaking' ? 'Trợ lý đang trả lời...'
        : callStatus === 'error' ? 'Cuộc gọi gặp lỗi'
    : 'Sẵn sàng lắng nghe'
);

const THINKING_ANNOUNCEMENTS = [
    'Tôi đã nghe câu hỏi của bạn, tôi sẽ giúp bạn ngay lập tức, đợi tôi suy nghĩ nhó',
    'Tôi đang suy nghĩ, bạn chờ tôi một chút nhé!',
    'Tôi sắp suy nghĩ xong rồi, bạn chờ tôi thêm một chút nhé!',
    'Sắp xong rồi, tôi đang hoàn thiện câu trả lời cho bạn.',
];

const INTRO_GREETING = 'Xin chào! Tôi là trợ lý VNPT AI, sẵn sàng hỗ trợ dịch vụ công cho bạn. Hãy nói điều bạn cần!';
const SUBSEQUENT_GREETING = 'Lại là tôi đây, bạn cần tui giúp gì nữa không?';

const VoiceCallController: React.FC = () => {
    const { state, dispatch, sendMessage, handleAIResponse } = useChatbot();
    const stateRef = useRef(state);
    const sendMessageRef = useRef(sendMessage);
    const isFinishingRef = useRef(false);
    const introPlayedRef = useRef(false);

    useEffect(() => {
        stateRef.current = state;
        sendMessageRef.current = sendMessage;
    }, [state, sendMessage]);

    // ── Lời chào khi bắt đầu cuộc gọi + warm-up mic song song ──────────────
    useEffect(() => {
        if (!state.isCallMode) {
            // Reset để lần sau phát lại
            introPlayedRef.current = false;
            return;
        }
        if (introPlayedRef.current) return;
        introPlayedRef.current = true;

        const greeting = state.messages.length === 0 ? INTRO_GREETING : SUBSEQUENT_GREETING;

        // Warm-up mic: xin quyền sớm trong lúc TTS đang nói
        void navigator.mediaDevices?.getUserMedia({ audio: true })
            .then((stream) => { stream.getTracks().forEach((t) => t.stop()); })
            .catch(() => undefined);

        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'speaking', text: greeting },
        });
        void ttsService.speak(greeting, (isPlaying) => {
            dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: {
                    status: isPlaying ? 'speaking' : 'listening',
                    text: isPlaying ? greeting : 'Đang lắng nghe...',
                },
            });
        });
    }, [state.isCallMode, dispatch, state.messages.length]);

    useEffect(() => {
        if (!state.isCallMode || !state.isLoading || state.requiresUserAction) return;

        let phraseIndex = 0;
        let cancelled = false;
        let pendingTimer: ReturnType<typeof window.setTimeout> | null = null;

        const announceNext = () => {
            if (
                cancelled
                || !stateRef.current.isCallMode
                || !stateRef.current.isLoading
                || stateRef.current.requiresUserAction
            ) {
                return;
            }

            const phrase = THINKING_ANNOUNCEMENTS[phraseIndex % THINKING_ANNOUNCEMENTS.length];
            phraseIndex += 1;
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'thinking', text: phrase },
            });
            void ttsService.speak(phrase, (isPlaying) => {
                dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: {
                        status: 'thinking',
                        text: isPlaying ? phrase : 'Trợ lý đang suy nghĩ...',
                    },
                });
                // Khi TTS vừa kết thúc (isPlaying chuyển false), lên lịch câu tiếp sau 3 giây
                if (!isPlaying && !cancelled) {
                    pendingTimer = window.setTimeout(announceNext, 3000);
                }
            });
        };

        // Bắt đầu câu đầu tiên sau 600ms
        pendingTimer = window.setTimeout(announceNext, 600);
        return () => {
            cancelled = true;
            if (pendingTimer !== null) window.clearTimeout(pendingTimer);
        };
    }, [dispatch, state.isCallMode, state.isLoading, state.requiresUserAction]);

    const finishVoiceUtterance = async () => {
        if (!stateRef.current.isCallMode || !stateRef.current.isListening || isFinishingRef.current) return;
        isFinishingRef.current = true;
        let shouldClearLoading = true;

        try {
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'transcribing', text: 'Đang gửi giọng nói lên VNPT SmartVoice...' },
            });
            dispatch({ type: 'SET_LOADING', payload: true });

            const transcript = (await sttService.stopListening()).trim();
            if (!stateRef.current.isCallMode) return;

            if (transcript) {
                dispatch({ type: 'SET_LOADING', payload: false });
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: { status: 'thinking', text: 'Trợ lý đang suy nghĩ...' },
                });
                shouldClearLoading = false;
                await sendMessageRef.current(transcript);
            } else {
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: { status: 'listening', text: 'Không nghe thấy câu nói rõ ràng. Tôi đang lắng nghe lại...' },
                });
            }
        } catch (error) {
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'error', text: 'Không thể nhận dạng giọng nói.' },
            });
            console.warn('[VoiceCallController] STT failed:', error);
            dispatch({ type: 'OPEN' });
            handleAIResponse({
                intent: 'CHAT',
                message: error instanceof Error
                    ? `Không thể nhận dạng giọng nói: ${error.message}`
                    : 'Không thể nhận dạng giọng nói. Vui lòng thử lại.',
                suggestions: ['Thử lại', 'Nhập bằng bàn phím'],
            });
        } finally {
            isFinishingRef.current = false;
            if (shouldClearLoading) dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    const startVoiceListening = async () => {
        if (
            !stateRef.current.isCallMode
            || stateRef.current.isListening
            || stateRef.current.isLoading
            || stateRef.current.isSpeaking
            || stateRef.current.requiresUserAction
            || isFinishingRef.current
        ) {
            return;
        }

        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'connecting', text: 'Đang kết nối microphone và VNPT SmartVoice...' },
        });
        dispatch({ type: 'SET_LISTENING', payload: true });

        try {
            await sttService.startListening(() => undefined, { onSilence: finishVoiceUtterance });
            if (!stateRef.current.isCallMode) {
                dispatch({ type: 'SET_LISTENING', payload: false });
                await sttService.cancelListening().catch(() => undefined);
                return;
            }

            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'listening', text: 'Đang lắng nghe...' },
            });
        } catch (error) {
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'error', text: 'Không thể bật microphone.' },
            });
            console.warn('[VoiceCallController] Voice input unavailable:', error);
            dispatch({ type: 'OPEN' });
            handleAIResponse({
                intent: 'CHAT',
                message: error instanceof Error
                    ? `Không thể bật microphone: ${error.message}`
                    : 'Không thể bật microphone. Vui lòng kiểm tra quyền truy cập.',
                suggestions: ['Thử lại', 'Nhập bằng bàn phím'],
            });
        }
    };

    useEffect(() => {
        if (!state.isCallMode) {
            ttsService.stop();
            dispatch({ type: 'SET_LISTENING', payload: false });
            void sttService.cancelListening().catch(() => undefined);
            return;
        }

        if (state.isListening || state.isLoading || state.isSpeaking || state.requiresUserAction) return;
        // Nếu intro đã phát xong thì nghe ngay, không delay nhiều
        const delay = introPlayedRef.current ? 150 : 800;
        const timer = window.setTimeout(() => {
            void startVoiceListening();
        }, delay);
        return () => window.clearTimeout(timer);
    }, [
        state.isCallMode,
        state.isListening,
        state.isLoading,
        state.isSpeaking,
        state.requiresUserAction,
    ]);

    return null;
};

const ChatbotWidget: React.FC = () => {
    const { state, dispatch, sendMessage, openChatbot } = useChatbot();
    const [isExiting, setIsExiting] = useState(false);
    const desktopPanelRef = useRef<HTMLElement | null>(null);

    const handleClose = () => {
        if (state.requiresUserAction) return;
        setIsExiting(true);
        window.setTimeout(() => {
            dispatch({ type: 'CLOSE' });
            setIsExiting(false);
        }, 180);
    };

    const handleOpen = () => {
        openChatbot();
    };

    const handleClear = () => {
        dispatch({ type: 'CLEAR_MESSAGES' });
        void smartbotService.clearHistory();
        window.setTimeout(() => {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `msg_${Date.now()}`,
                    role: 'bot',
                    type: 'text',
                    content: 'Đã xoá lịch sử chat. Tôi có thể giúp gì cho bạn?',
                    timestamp: new Date(),
                    suggestions: ['Đăng ký khai sinh', 'Liên thông khai sinh', 'Cần chuẩn bị gì?'],
                },
            });
        }, 100);
    };

    useEffect(() => {
        if (!state.isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && window.innerWidth >= 768) {
                handleClose();
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (window.innerWidth < 768) return;
            const target = event.target as Node | null;
            if (!target || desktopPanelRef.current?.contains(target)) return;
            handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [state.isOpen, state.requiresUserAction]);

    return (
        <>
            <VoiceCallController />

            {!state.isOpen && !state.isCallMode && (
                <div className="desktop-chat-bar" aria-label="Thanh chat Trợ lý AI Dịch Vụ Công">
                    <div className="desktop-chat-bar-brand">
                        <img src="/logo_Gov_Bridge.jpg" alt="" />
                        <Bot size={16} />
                    </div>
                    <ChatInput
                        variant="bar"
                        onSend={sendMessage}
                        disabled={state.isLoading}
                        onFocusInput={handleOpen}
                        onBeforeSend={handleOpen}
                    />
                </div>
            )}

            {state.isOpen && (
                <>
                    <div
                        className={`chatbot-soft-backdrop${state.requiresUserAction ? ' chatbot-soft-backdrop--confirmation' : ''}`}
                        aria-hidden="true"
                    />
                    <div className={`chatbot-desktop-overlay ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}>
                        <section
                            ref={desktopPanelRef}
                            className={`chatbot-overlay-panel${state.requiresUserAction ? ' chatbot-overlay-panel--confirmation' : ''}`}
                            role="dialog"
                            aria-label="Trợ lý AI Dịch Vụ Công"
                            aria-modal="true"
                        >
                            <div className="chatbot-panel-controls" aria-label="Điều khiển chatbot">
                                <button
                                    className="chatbot-panel-control chatbot-panel-control--center"
                                    type="button"
                                    onClick={handleClose}
                                    title={state.requiresUserAction ? 'Vui lòng hoàn tất xác nhận' : 'Thu nhỏ'}
                                    aria-label={state.requiresUserAction ? 'Đang chờ xác nhận, chưa thể thu nhỏ' : 'Thu nhỏ chatbot'}
                                    disabled={state.requiresUserAction}
                                >
                                    <ChevronDown size={18} />
                                </button>
                            </div>
                            {state.messages.length === 0 ? (
                                <WelcomeState />
                            ) : (
                                <ChatWindow messages={state.messages} isLoading={state.isLoading} />
                            )}
                            <ChatInput
                                variant="panel"
                                autoFocus
                                onSend={sendMessage}
                                disabled={state.isLoading || (state.requiresUserAction && state.confirmationSource === 'voice')}
                            />
                        </section>
                    </div>
                </>
            )}

            {state.isOpen && (
                <div
                    className={`chatbot-widget ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}
                    role="dialog"
                    aria-label="Trợ lý AI Dịch Vụ Công"
                    aria-modal="false"
                    id="chatbot-widget"
                >
                    <ChatHeader
                        title="Trợ lý AI DVC"
                        subtitle={smartbotService.getBackendInfo()}
                        onClear={handleClear}
                        onClose={handleClose}
                    />
                    {!state.isMinimized && (
                        <>
                            <ChatWindow messages={state.messages} isLoading={state.isLoading} />
                            <ChatInput onSend={sendMessage} disabled={state.isLoading || (state.requiresUserAction && state.confirmationSource === 'voice')} />
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export const ChatbotFAB: React.FC = () => {
    const { state, dispatch } = useChatbot();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const callStatusLabel = getCallStatusLabel(state.callStatus, state.callStatusText);
    const isRealtime = state.conversationState === 'REALTIME';
    const isWaitingForConfirmation = state.conversationState === 'WAITING_FOR_CONFIRMATION';

    const handleCallToggle = () => {
        if (isWaitingForConfirmation) return;

        if (isRealtime || state.isListening) {
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'SET_CALL_STATUS', payload: { status: 'idle', text: null } });
            return;
        }

        if (!user) {
            setShowAuthModal(true);
            return;
        }

        dispatch({ type: 'CLOSE' });
        dispatch({ type: 'SET_CALL_MODE', payload: true });
        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'connecting', text: 'Đang bắt đầu trò chuyện realtime...' },
        });
    };

    const buttonLabel = isWaitingForConfirmation
        ? 'Đang chờ xác nhận trong khung chat'
        : isRealtime
          ? 'Tắt trò chuyện realtime bằng giọng nói'
          : 'Bắt đầu trò chuyện realtime bằng giọng nói';

    return (
        <>
            <div
                className={[
                    'realtime-voice-control',
                    isRealtime ? 'realtime-voice-control--active' : '',
                    isWaitingForConfirmation ? 'realtime-voice-control--waiting' : '',
                    `realtime-voice-control--${state.callStatus}`,
                ].filter(Boolean).join(' ')}
                data-conversation-state={state.conversationState}
            >
                {isRealtime && (
                    <div className="realtime-voice-rings" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                )}

                <button
                    className="realtime-voice-button"
                    type="button"
                    id="realtime-voice-button"
                    onClick={handleCallToggle}
                    disabled={isWaitingForConfirmation}
                    aria-label={buttonLabel}
                    aria-pressed={isRealtime}
                    aria-describedby="realtime-voice-status"
                    title={buttonLabel}
                >
                    <span className="realtime-voice-icon" aria-hidden="true">
                        {isRealtime ? <MicOff size={30} /> : <Mic size={26} />}
                    </span>
                    {isRealtime && (
                        <span className="realtime-voice-equalizer" aria-hidden="true">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <span key={index} style={{ animationDelay: `${index * 90}ms` }} />
                            ))}
                        </span>
                    )}
                </button>

                <div
                    className="realtime-voice-status"
                    id="realtime-voice-status"
                    role="status"
                    aria-live="polite"
                >
                    {isWaitingForConfirmation
                        ? 'Vui lòng xác nhận trong khung chat'
                        : isRealtime
                          ? callStatusLabel
                          : 'Gọi AI realtime'}
                </div>
            </div>

            {showAuthModal && (
                <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
                    <div
                        className="auth-modal-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-modal-title"
                    >
                        <div className="auth-modal-header">
                            <div className="auth-modal-icon">
                                <Mic size={24} />
                            </div>
                            <div>
                                <h3 id="auth-modal-title" className="auth-modal-title">
                                    Yêu cầu đăng nhập
                                </h3>
                                <p className="auth-modal-desc">
                                    Vui lòng đăng nhập để tiếp tục sử dụng tính năng gọi giọng nói realtime với Trợ lý AI.
                                </p>
                            </div>
                        </div>

                        <div className="auth-modal-actions">
                            <button
                                type="button"
                                onClick={() => setShowAuthModal(false)}
                                className="auth-modal-btn auth-modal-btn--cancel"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAuthModal(false);
                                    navigate('/dang-nhap', { state: { from: location.pathname } });
                                }}
                                className="auth-modal-btn auth-modal-btn--primary"
                            >
                                Đăng nhập
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotWidget;
