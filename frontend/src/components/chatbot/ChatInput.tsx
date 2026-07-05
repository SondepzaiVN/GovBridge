import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatbot } from '../../contexts/ChatbotContext';
import { ocrService, smartbotService } from '../../api/aiServices';
import { Send, Camera, ShieldCheck } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void | Promise<void>;
    disabled?: boolean;
    variant?: 'panel' | 'bar';
    autoFocus?: boolean;
    onFocusInput?: () => void;
    onBeforeSend?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled,
    variant = 'panel',
    autoFocus = false,
    onFocusInput,
    onBeforeSend,
}) => {
    const { state, dispatch, handleAIResponse } = useChatbot();
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [showCccdConsent, setShowCccdConsent] = useState(false);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
    }, [inputValue]);

    useEffect(() => {
        if (!autoFocus) return;
        const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
        return () => window.clearTimeout(timer);
    }, [autoFocus]);

    const handleSend = () => {
        const text = inputValue.trim();
        if (!text || disabled || state.isLoading) return;
        onBeforeSend?.();
        onSend(text);
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // OCR image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show uploading message
        const userMsg = {
            id: `msg_${Date.now()}`,
            role: 'user' as const,
            type: 'image' as const,
            content: `Đã gửi ảnh: ${file.name}`,
            timestamp: new Date(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
        dispatch({ type: 'SET_LOADING', payload: true });

        // Add processing bot message
        const processingMsg = {
            id: `msg_${Date.now()}_proc`,
            role: 'bot' as const,
            type: 'text' as const,
            content: 'Đang đọc thông tin từ ảnh CCCD...',
            timestamp: new Date(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: processingMsg });

        try {
            const resizedFile = await ocrService.resizeImage(file);
            const cccdInfo = await ocrService.extractCCCDInfo(resizedFile, { showProcessingNotice: false });
            smartbotService.setRecentOcrFacts(
                Object.fromEntries(
                    Object.entries(cccdInfo).filter(
                        ([key, value]) => key !== 'rawText' && typeof value === 'string' && value.trim(),
                    ),
                ),
            );

            handleAIResponse({
                intent: 'OCR_CONFIRM',
                message:
                    'Tôi đã đọc được thông tin từ CCCD của bạn!\n\nVui lòng kiểm tra lại thông tin bên dưới trước khi xác nhận điền vào form:',
                data: { cccdInfo },
                suggestions: ['Xác nhận và điền vào form', 'Thông tin cần sửa lại', 'Hủy'],
            });
        } catch (err) {
            console.warn('[ChatInput OCR] API failed:', err);
            handleAIResponse({
                intent: 'CHAT',
                message:
                    err instanceof Error
                        ? `Không thể đọc ảnh CCCD: ${err.message}`
                        : 'Không thể đọc ảnh CCCD. Vui lòng thử lại với ảnh rõ hơn.',
                suggestions: ['Thử ảnh khác', 'Nhập thông tin thủ công'],
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className={`chatbot-input-area chatbot-input-area--${variant}`}>
            <div className="chatbot-input-row">
                <textarea
                    ref={textareaRef}
                    className="chatbot-input-field"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={onFocusInput}
                    placeholder={variant === 'bar' ? 'Bạn có cần Agent giúp?' : 'Nhập tin nhắn hoặc câu hỏi...'}
                    disabled={disabled || state.isLoading}
                    rows={1}
                    aria-label="Nhập tin nhắn"
                    id="chat-input-field"
                />

                <div className="chatbot-input-actions">
                    {/* Image upload menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="input-action-btn"
                            onClick={() => {
                                setShowCameraMenu(false);
                                setShowCccdConsent(true);
                            }}
                            title="Upload hoặc chụp ảnh CCCD"
                            disabled={disabled || state.isLoading}
                            aria-label="Upload ảnh CCCD"
                        >
                            <Camera size={16} />
                        </button>

                        {showCameraMenu && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                    onClick={() => setShowCameraMenu(false)}
                                />
                                <div
                                    className="camera-options-menu"
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        marginBottom: '8px',
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        boxShadow:
                                            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minWidth: '160px',
                                        zIndex: 20,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <button
                                        onClick={() => {
                                            setShowCameraMenu(false);
                                            fileInputRef.current?.click();
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            border: 'none',
                                            background: 'none',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            borderBottom: '1px solid #f1f5f9',
                                        }}
                                    >
                                        Tải ảnh từ máy
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCameraMenu(false);
                                            cameraInputRef.current?.click();
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            border: 'none',
                                            background: 'none',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                        }}
                                    >
                                        Chụp bằng Camera
                                    </button>
                                </div>
                            </>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Send button */}
                    <button
                        className="send-btn"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || disabled || state.isLoading}
                        title="Gửi tin nhắn"
                        aria-label="Gửi"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>

            {showCccdConsent &&
                createPortal(
                    <div
                        className="cccd-consent-backdrop"
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setShowCccdConsent(false);
                        }}
                    >
                        <section
                            className="cccd-consent-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Đồng ý xử lý dữ liệu"
                        >
                            <div className="cccd-consent-icon">
                                <ShieldCheck size={24} />
                            </div>
                            <h2>Đồng ý xử lý dữ liệu?</h2>
                            <p>
                                Ảnh CCCD sẽ được gửi đến<strong>VNPT AI</strong> để xử lý, tự động điền thông tin. Bạn
                                có đồng ý không?
                            </p>
                            <div className="cccd-consent-actions">
                                <button
                                    type="button"
                                    className="cccd-consent-decline"
                                    onClick={() => setShowCccdConsent(false)}
                                >
                                    Từ chối
                                </button>
                                <button
                                    type="button"
                                    className="cccd-consent-accept"
                                    onClick={() => {
                                        setShowCccdConsent(false);
                                        setShowCameraMenu(true);
                                    }}
                                    autoFocus
                                >
                                    Đồng ý
                                </button>
                            </div>
                        </section>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default ChatInput;
