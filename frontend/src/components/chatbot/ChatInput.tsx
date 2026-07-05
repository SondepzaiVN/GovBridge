import React, { useRef, useEffect, useState } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import { Send } from 'lucide-react';

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
    const { state } = useChatbot();
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
        </div>
    );
};

export default ChatInput;
