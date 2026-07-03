import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Mic, MicOff, Minimize2, Phone, RotateCcw, Sparkles, X } from 'lucide-react';
import { smartbotService, sttService, ttsService } from '../../api/aiServices';
import { useChatbot } from '../../contexts/ChatbotContext';
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

const VoiceCallController: React.FC = () => {
    const { state, dispatch, sendMessage, handleAIResponse } = useChatbot();
    const stateRef = useRef(state);
    const sendMessageRef = useRef(sendMessage);
    const isFinishingRef = useRef(false);

    useEffect(() => {
        stateRef.current = state;
        sendMessageRef.current = sendMessage;
    }, [state, sendMessage]);

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
        const timer = window.setTimeout(() => {
            void startVoiceListening();
        }, 450);
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
    }, [state.isOpen]);

    return (
        <>
            <VoiceCallController />

            {!state.isOpen && (
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
                    <div className="chatbot-soft-backdrop" aria-hidden="true" />
                    <div className={`chatbot-desktop-overlay ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}>
                        <section
                            ref={desktopPanelRef}
                            className="chatbot-overlay-panel"
                            role="dialog"
                            aria-label="Trợ lý AI Dịch Vụ Công"
                            aria-modal="true"
                        >
                            <div className="chatbot-panel-controls" aria-label="Điều khiển chatbot">
                                <button
                                    className="chatbot-panel-control chatbot-panel-control--center"
                                    type="button"
                                    onClick={handleClose}
                                    title="Thu nhỏ"
                                    aria-label="Thu nhỏ chatbot"
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
                                disabled={state.isLoading}
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
                            <ChatInput onSend={sendMessage} disabled={state.isLoading} />
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export const ChatbotFAB: React.FC = () => {
    const { state, openChatbot, dispatch } = useChatbot();
    const callStatusLabel = getCallStatusLabel(state.callStatus, state.callStatusText);

    const handleClick = () => {
        if (state.isOpen) {
            dispatch({ type: 'CLOSE' });
        } else {
            openChatbot();
        }
    };

    const handleCallToggle = () => {
        if (state.isCallMode || state.isListening) {
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'SET_CALL_STATUS', payload: { status: 'idle', text: null } });
            return;
        }

        dispatch({ type: 'SET_CALL_MODE', payload: true });
        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'connecting', text: '\u0110ang b\u1eaft \u0111\u1ea7u cu\u1ed9c g\u1ecdi...' },
        });
    };

    const unreadCount = !state.isOpen ? state.messages.filter((m) => m.role === 'bot').length : 0;

    return (
        <div className={`chatbot-fab${state.isOpen ? ' chatbot-fab--open' : ''}${state.isCallMode ? ' chatbot-fab--calling' : ''}`}>
            {!state.isOpen && state.isCallMode && (
                <div className={`chatbot-fab-call-status call-mode-panel--${state.callStatus}`} role="status">
                    <span className="chatbot-fab-call-dot" aria-hidden="true" />
                    <span>{callStatusLabel}</span>
                </div>
            )}

            <button
                className="chatbot-fab-btn"
                onClick={handleClick}
                aria-label={state.isOpen ? '\u0110\u00f3ng tr\u1ee3 l\u00fd AI' : 'M\u1edf tr\u1ee3 l\u00fd AI D\u1ecbch V\u1ee5 C\u00f4ng'}
                title="Tr\u1ee3 l\u00fd AI D\u1ecbch V\u1ee5 C\u00f4ng"
                id="chatbot-fab"
                type="button"
            >
                <div className="chatbot-fab-pulse" />
                <div
                    className="chatbot-fab-icon"
                    style={!state.isOpen ? { width: 64, height: 64, borderRadius: '50%', padding: 2 } : {}}
                >
                    {state.isOpen ? (
                        <X size={24} />
                    ) : (
                        <img
                            src="/logo_Gov_Bridge.jpg"
                            alt="Gov Bridge"
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                background: 'white',
                            }}
                        />
                    )}
                </div>
                {unreadCount > 0 && !state.isOpen && !state.isCallMode && (
                    <span className="chatbot-fab-badge" style={{ zIndex: 2 }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {!state.isOpen && (
                <button
                    className={`chatbot-fab-call-btn ${state.isCallMode ? 'active' : ''}`}
                    type="button"
                    onClick={handleCallToggle}
                    title={state.isCallMode ? 'K\u1ebft th\u00fac cu\u1ed9c g\u1ecdi' : 'B\u1eaft \u0111\u1ea7u cu\u1ed9c g\u1ecdi'}
                    aria-label={state.isCallMode ? 'K\u1ebft th\u00fac cu\u1ed9c g\u1ecdi' : 'B\u1eaft \u0111\u1ea7u cu\u1ed9c g\u1ecdi'}
                >
                    {state.isCallMode ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
            )}
            <div className="chatbot-fab-tooltip">Tr\u1ee3 l\u00fd AI 24/7</div>
        </div>
    );
};

export default ChatbotWidget;
