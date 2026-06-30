import React, { useRef, useEffect, useState } from 'react';
import type { ChatMessage } from '../../types';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useForm } from '../../contexts/FormContext';
import { ROUTE_TO_SERVICE_MAP } from '../../data/services';
import { useLocation } from 'react-router-dom';
import { Bot, User, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

// ============================================================
// Markdown-like renderer for bot messages
// ============================================================
const renderContent = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <React.Fragment key={i}>
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
        )}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

// ============================================================
// ChatMessage component
// ============================================================
interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageProps> = ({ message }) => {
  const { state, confirmNavigation, cancelNavigation, sendMessage, dispatch, handleAIResponse } = useChatbot();
  const { fillFields } = useForm();
  const location = useLocation();
  const [fillDecision, setFillDecision] = useState<'confirmed' | 'cancelled' | null>(null);

  const isBot = message.role === 'bot';
  const time = message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Navigation confirm card (inside bot message)
  const renderNavConfirmCard = () => (
    <div className="nav-confirm-card" style={{ marginTop: 10 }}>
      <div className="nav-confirm-title">
        🗺️ Chuyển đến: {state.pendingNavigation?.serviceName}
      </div>
      <div className="nav-confirm-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={confirmNavigation}
          id="nav-confirm-yes"
        >
          ✓ Đồng ý
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={cancelNavigation}
          id="nav-confirm-no"
        >
          Ở lại
        </button>
      </div>
    </div>
  );

  // CCCD Preview card
  const renderCCCDPreviewCard = () => {
    const info = message.data?.cccdInfo as Record<string, string> | undefined;
    if (!info) return null;
    return (
      <div className="cccd-preview" style={{ marginTop: 10 }}>
        <div className="cccd-preview-header">🪪 Thông tin CCCD</div>
        <div className="cccd-preview-fields">
          {[
            { label: 'Số CCCD', key: 'id' },
            { label: 'Họ và tên', key: 'hoTen' },
            { label: 'Ngày sinh', key: 'ngaySinh' },
            { label: 'Giới tính', key: 'gioiTinh' },
            { label: 'Quê quán', key: 'queQuan' },
            { label: 'Nơi thường trú', key: 'thuongTru' },
          ].map(({ label, key }) => (
            info[key] && (
              <div className="cccd-field" key={key}>
                <span className="cccd-field-label">{label}</span>
                <span className="cccd-field-value">{info[key]}</span>
              </div>
            )
          ))}
        </div>
        <div className="cccd-preview-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const fields: Record<string, string> = {};
              const serviceRoute = location.pathname.replace(/\/buoc-\d+\/?$/, '');
              const service = ROUTE_TO_SERVICE_MAP[serviceRoute];

              service?.fields.forEach((field) => {
                if (!field.cccdKey) return;
                const rawValue = info[field.cccdKey];
                if (!rawValue) return;
                fields[field.id] = field.cccdKey === 'gioiTinh'
                  ? rawValue.toLowerCase().includes('nữ') ? 'Nu' : 'Nam'
                  : rawValue;
              });

              if (Object.keys(fields).length === 0) {
                handleAIResponse({
                  intent: 'CHAT',
                  message: 'Thủ tục hiện tại chưa khai báo trường nào để tự điền từ CCCD.',
                  suggestions: ['Nhập thông tin thủ công', 'Chọn thủ tục khác'],
                });
                return;
              }

              fillFields(fields);
              // Bot responds with confirmation — not a user message
              handleAIResponse({
                intent: 'FILL_FORM',
                message: '✅ Đã tự động điền thông tin từ CCCD vào form!\n\nVui lòng kiểm tra và bổ sung các thông tin còn thiếu trước khi nộp hồ sơ.',
                data: { fields },
                suggestions: ['Nút nộp ở đâu?', 'Cần điền thêm gì?', 'Cảm ơn!'],
              });
              // Auto-close on mobile so user can see the filled form
              if (window.innerWidth <= 768) {
                setTimeout(() => dispatch({ type: 'CLOSE' }), 1200);
              }
            }}
            id="cccd-confirm-btn"
          >
            ✓ Xác nhận & Điền
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => sendMessage('Thông tin CCCD cần sửa lại')}
          >
            Huỷ
          </button>
        </div>
      </div>
    );
  };

  const renderFillConfirmCard = () => {
    const fields = message.data?.fields as Record<string, string> | undefined;
    const labels = message.data?.fieldLabels as Record<string, string> | undefined;
    const previousValues = message.data?.previousValues as Record<string, string> | undefined;
    if (!fields || Object.keys(fields).length === 0) return null;

    return (
      <div className="fill-confirm-card">
        <div className="fill-confirm-title">Thông tin sẽ điền</div>
        <div className="fill-confirm-fields">
          {Object.entries(fields).map(([fieldId, value]) => (
            <div className="fill-confirm-field" key={fieldId}>
              <span className="fill-confirm-label">{labels?.[fieldId] || fieldId}</span>
              {previousValues?.[fieldId] && previousValues[fieldId] !== value && (
                <span className="fill-confirm-old">{previousValues[fieldId]} →</span>
              )}
              <span className="fill-confirm-value">{value}</span>
            </div>
          ))}
        </div>

        {fillDecision === null ? (
          <div className="fill-confirm-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                fillFields(fields);
                setFillDecision('confirmed');
                handleAIResponse({
                  intent: 'CHAT',
                  message: 'Đã điền các thông tin bạn vừa xác nhận. Bạn kiểm tra lại trên biểu mẫu trước khi tiếp tục nhé.',
                  suggestions: ['Cần điền thêm gì?', 'Giải thích trường tiếp theo'],
                });
              }}
            >
              Xác nhận và điền
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFillDecision('cancelled');
                handleAIResponse({
                  intent: 'CHAT',
                  message: 'Mình chưa thay đổi biểu mẫu. Bạn có thể gửi lại thông tin đúng khi sẵn sàng.',
                });
              }}
            >
              Không điền
            </button>
          </div>
        ) : (
          <div className={`fill-confirm-status ${fillDecision}`}>
            {fillDecision === 'confirmed' ? 'Đã xác nhận' : 'Đã bỏ qua'}
          </div>
        )}
      </div>
    );
  };

  // Validation result card
  const renderValidationCard = () => {
    const errors = (message.data?.validationErrors as Array<{ field: string; label: string; message: string; severity: string }>) || [];
    if (errors.length === 0) {
      return (
        <div className="validation-result">
          <div className="validation-item success">
            <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Tất cả thông tin đều hợp lệ! Bạn có thể nộp hồ sơ.</span>
          </div>
        </div>
      );
    }
    return (
      <div className="validation-result">
        {errors.map((err, i) => (
          <div key={i} className={`validation-item ${err.severity}`}>
            {err.severity === 'error'
              ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            <span><strong>{err.label}:</strong> {err.message}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`message-wrapper ${message.role}`}>
      {/* Avatar */}
      <div className="message-avatar">
        {isBot ? <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%' }}>
        {/* Bubble */}
        <div className="message-bubble">
          <div className="message-content">
            {renderContent(message.content)}
          </div>

          {/* Extra cards based on message type */}
          {message.type === 'navigation-confirm' && state.pendingNavigation && renderNavConfirmCard()}
          {message.type === 'cccd-preview' && renderCCCDPreviewCard()}
          {message.type === 'fill-confirm' && renderFillConfirmCard()}
          {message.type === 'validation-result' && renderValidationCard()}
        </div>

        {/* Timestamp */}
        <span className="message-time">{time}</span>

        {/* Suggestion chips */}
        {isBot && message.suggestions && message.suggestions.length > 0 && (
          <div className="suggestion-chips">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                className="suggestion-chip"
                onClick={() => sendMessage(s)}
                id={`suggestion-${message.id}-${i}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// ChatWindow — list of messages + typing indicator
// ============================================================
interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chatbot-messages" role="log" aria-live="polite" aria-label="Cuộc hội thoại">
      {messages.map((msg) => (
        <ChatMessageItem key={msg.id} message={msg} />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="message-wrapper bot typing-indicator">
          <div className="message-avatar">
            <Bot size={16} />
          </div>
          <div className="typing-dots">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export { ChatMessageItem, ChatWindow };
export default ChatWindow;
