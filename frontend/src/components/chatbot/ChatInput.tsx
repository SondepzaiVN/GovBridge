import React, { useRef, useEffect, useState } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void | Promise<void>;
    disabled?: boolean;
    isProcessing?: boolean;
    onCancel?: () => void;
    variant?: 'panel' | 'bar';
    autoFocus?: boolean;
    onFocusInput?: () => void;
    onBeforeSend?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled,
    isProcessing = false,
    onCancel,
    variant = 'panel',
    autoFocus = false,
    onFocusInput,
    onBeforeSend,
}) => {
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        if (!text || disabled || isProcessing) return;
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
                    disabled={disabled || isProcessing}
                    rows={1}
                    aria-label="Nhập tin nhắn"
                    id="chat-input-field"
                />

                <div className="chatbot-input-actions">
                    {isProcessing ? (
                        <button
                            className="send-btn send-btn--cancel"
                            onClick={onCancel}
                            disabled={disabled || !onCancel}
                            title="Hủy phản hồi"
                            aria-label="Hủy phản hồi"
                            type="button"
                        >
                            <Square size={13} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            className="send-btn"
                            onClick={handleSend}
                            disabled={!inputValue.trim() || disabled}
                            title="Gửi tin nhắn"
                            aria-label="Gửi"
                            type="button"
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatInput;
