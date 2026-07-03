import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Minimize2, Phone, RotateCcw, Sparkles, X } from 'lucide-react';
import { smartbotService } from '../../api/aiServices';
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

    const handleClick = () => {
        if (state.isOpen) {
            dispatch({ type: 'CLOSE' });
        } else {
            openChatbot();
        }
    };

    const unreadCount = !state.isOpen ? state.messages.filter((m) => m.role === 'bot').length : 0;

    return (
        <div className={`chatbot-fab${state.isOpen ? ' chatbot-fab--open' : ''}`}>
            <button
                className="chatbot-fab-btn"
                onClick={handleClick}
                aria-label={state.isOpen ? 'Đóng trợ lý AI' : 'Mở trợ lý AI Dịch Vụ Công'}
                title="Trợ lý AI Dịch Vụ Công"
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
                {unreadCount > 0 && !state.isOpen && (
                    <span className="chatbot-fab-badge" style={{ zIndex: 2 }}>
                        {unreadCount}
                    </span>
                )}
            </button>
            <div className="chatbot-fab-tooltip">Trợ lý AI 24/7</div>
        </div>
    );
};

export default ChatbotWidget;
