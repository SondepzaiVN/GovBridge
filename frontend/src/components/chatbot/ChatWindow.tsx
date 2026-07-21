import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Bot, CheckCircle, LoaderCircle, User } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useForm } from '../../contexts/FormContext';
import { ROUTE_TO_SERVICE_MAP } from '../../data/services';

const FALLBACK_CCCD_FIELD_MAP: Record<string, Record<string, string>> = {
  '/dang-ky-tam-tru': {
    hoTen: 'fullName',
    ngaySinh: 'dateOfBirth',
    gioiTinh: 'gender',
    id: 'citizenId',
  },
  '/tam-tru': {
    hoTen: 'fullName',
    ngaySinh: 'dateOfBirth',
    gioiTinh: 'gender',
    id: 'citizenId',
  },
  '/xac-nhan-cu-tru': {
    hoTen: 'fullName',
    ngaySinh: 'birthDate',
    gioiTinh: 'gender',
    id: 'citizenId',
  },
  '/lien-thong-khai-tu': {
    hoTen: 'ltkt_fullName',
    ngaySinh: 'ltkt_dob',
    gioiTinh: 'ltkt_gender',
    id: 'ltkt_idNumber',
    ngayCap: 'ltkt_idIssueDate',
    noiCap: 'ltkt_idIssuePlace',
    thuongTru: 'ltkt_addressDetail',
  },
};

const normalizeGenderValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized.includes('nữ') || normalized.includes('nu') ? 'Nu' : 'Nam';
};

const normalizeServiceRoute = (pathname: string) => pathname.replace(/\/buoc-\d+\/?$/, '');

const AI_DECLARATION_PROCESSING_MESSAGE =
  'AI đang xử lý để tự động điền tờ khai, bạn chỉ cần in ra và ký thôi.';

const waitForAiDeclarationProcessing = () =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 550);
  });

const normalizeConfirmOptionText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/\b(?:tinh|thanh pho|phuong|xa|thi tran|dac khu)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const buildFieldsFromCccdMap = (info: Record<string, string>, fieldMap: Record<string, string>) => {
  const fields: Record<string, string> = {};
  Object.entries(fieldMap).forEach(([cccdKey, fieldId]) => {
    const rawValue = info[cccdKey];
    if (!rawValue) return;
    fields[fieldId] = cccdKey === 'gioiTinh'
      ? normalizeGenderValue(rawValue)
      : rawValue;
  });
  return fields;
};

const getRouteSpecificCccdFieldMap = (route: string, info: Record<string, string>): Record<string, string> | null => {
  const gender = info.gioiTinh ? normalizeGenderValue(info.gioiTinh) : '';
  const isFemale = gender === 'Nu';

  if (route === '/khai-sinh') {
    return isFemale
      ? { id: 'cccdMe', hoTen: 'hoTenMe', ngaySinh: 'ngaySinhMe' }
      : { id: 'cccdCha', hoTen: 'hoTenCha', ngaySinh: 'ngaySinhCha' };
  }

  if (route === '/lien-thong-khai-sinh') {
    return isFemale
      ? { id: 'ltks_cccdMe', hoTen: 'ltks_hoTenMe' }
      : { id: 'ltks_cccdCha', hoTen: 'ltks_hoTenCha' };
  }

  if (route === '/ket-hon') {
    return isFemale
      ? { hoTen: 'hoTenNu', id: 'cccdNu', ngaySinh: 'ngaySinhNu', thuongTru: 'diaChiNu' }
      : { hoTen: 'hoTenNam', id: 'cccdNam', ngaySinh: 'ngaySinhNam', thuongTru: 'diaChiNam' };
  }

  return null;
};

const renderInlineContent = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return parts.filter(Boolean).map((part, partIndex) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/u);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={partIndex}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="message-link"
        >
          {label}
        </a>
      );
    }
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/u);
    if (boldMatch) return <strong key={partIndex}>{boldMatch[1]}</strong>;
    return <span key={partIndex}>{part}</span>;
  });
};

const renderContent = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const headingMatch = line.match(/^#{2,4}\s+(.+)$/u);
    const renderedLine = headingMatch ? headingMatch[1] : line;
    return (
      <React.Fragment key={index}>
        {headingMatch
          ? <strong className="message-heading">{renderInlineContent(renderedLine)}</strong>
          : renderInlineContent(renderedLine)}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const getUserMessageStatusLabel = (status: ChatMessage['status']) => {
  switch (status) {
    case 'processing':
      return 'Đang xử lý';
    case 'failed':
      return 'Gửi thất bại';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return null;
  }
};

const getBotMessageStatusLabel = (status: ChatMessage['status']) => {
  switch (status) {
    case 'speaking':
      return 'Đang phát';
    case 'interrupted':
      return 'Đã bị ngắt';
    case 'failed':
      return 'Lỗi phản hồi';
    default:
      return null;
  }
};

const formatResponseTime = (responseTimeMs?: number) => {
  if (typeof responseTimeMs !== 'number' || !Number.isFinite(responseTimeMs)) return null;
  if (responseTimeMs < 1_000) return `${responseTimeMs} ms`;
  return `${(responseTimeMs / 1_000).toFixed(2)} giây`;
};

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageProps> = ({ message }) => {
  const {
    state,
    dispatch,
    confirmNavigation,
    cancelNavigation,
    reviewNavigation,
    resumeRealtimeWithVoice,
    sendMessage,
  } = useChatbot();
  const { fillFields } = useForm();
  const location = useLocation();
  const [fillDecision, setFillDecision] = useState<'confirmed' | 'cancelled' | null>(null);
  const [isAiProcessingDeclaration, setIsAiProcessingDeclaration] = useState(false);

  const isBot = message.role === 'bot';
  const isActiveConfirmation = state.requiresUserAction
    && state.messages[state.messages.length - 1]?.id === message.id;
  const time = message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const statusLabel = isBot
    ? getBotMessageStatusLabel(message.status)
    : getUserMessageStatusLabel(message.status);
  const responseTimeLabel = isBot ? formatResponseTime(message.responseTimeMs) : null;

  const showFillSuccessMessage = (
    voiceMessage: string,
    textMessage: string,
    voiceSuggestions: string[],
    textSuggestions: string[],
  ) => {
    if (state.confirmationSource === 'voice') {
      resumeRealtimeWithVoice(voiceMessage, voiceSuggestions);
      return;
    }

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: crypto.randomUUID(),
        role: 'bot',
        type: 'text',
        content: textMessage,
        timestamp: new Date(),
        suggestions: textSuggestions,
      }
    });
  };

  const confirmFill = async (fields: Record<string, string>) => {
    if (isAiProcessingDeclaration) return;
    setIsAiProcessingDeclaration(true);
    await waitForAiDeclarationProcessing();
    fillFields(fields);
    setIsAiProcessingDeclaration(false);
    setFillDecision('confirmed');
    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
    dispatch({ type: 'CLOSE' });
    showFillSuccessMessage(
        'Em đã điền các thông tin Anh/Chị vừa xác nhận. Anh/Chị muốn em kiểm tra các mục còn thiếu hay hướng dẫn bước tiếp theo?',
        'Em đã điền các thông tin Anh/Chị vừa xác nhận. Anh/Chị muốn em kiểm tra các mục còn thiếu hay hướng dẫn bước tiếp theo?',
        ['Kiểm tra mục còn thiếu', 'Hướng dẫn bước tiếp theo', 'Tiếp tục bằng giọng nói'],
        ['Kiểm tra mục còn thiếu', 'Hướng dẫn bước tiếp theo'],
    );
  };

  const cancelFill = () => {
    setFillDecision('cancelled');
    dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
    if (state.confirmationSource === 'voice') {
      resumeRealtimeWithVoice(
        'Dạ, em chưa thay đổi biểu mẫu. Anh/Chị muốn gửi lại thông tin, giải thích thêm hay tiếp tục bằng giọng nói?',
        ['Gửi lại thông tin', 'Giải thích thêm', 'Tiếp tục bằng giọng nói'],
      );
    } else {
      const msg = 'Dạ, em chưa thay đổi biểu mẫu. Anh/Chị muốn gửi lại thông tin hay giải thích thêm?';
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: crypto.randomUUID(),
          role: 'bot',
          type: 'text',
          content: msg,
          timestamp: new Date(),
          suggestions: ['Gửi lại thông tin', 'Giải thích thêm']
        }
      });
    }
  };

  const renderNavConfirmCard = () => (
    <div className="nav-confirm-card" style={{ marginTop: 10 }}>
      <div className="nav-confirm-title">
        Chuyển đến: {state.pendingNavigation?.serviceName}
      </div>
      <div className="confirmation-required-note">
        Chọn Đồng ý, Từ chối hoặc Xem lại thông tin.
      </div>
      <div className="nav-confirm-actions">
        <button className="btn btn-primary btn-sm" onClick={confirmNavigation} id="nav-confirm-yes">
          Đồng ý
        </button>
        <button className="btn btn-ghost btn-sm" onClick={cancelNavigation} id="nav-confirm-no">
          Từ chối
        </button>
        <button className="btn btn-ghost btn-sm" onClick={reviewNavigation} id="nav-confirm-review">
          Xem lại thông tin
        </button>
      </div>
    </div>
  );

  const renderCCCDPreviewCard = () => {
    const info = message.data?.cccdInfo as Record<string, string> | undefined;
    if (!info || !isActiveConfirmation) return null;

    return (
      <div className="cccd-preview" style={{ marginTop: 10 }}>
        <div className="cccd-preview-header">Thông tin CCCD</div>
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
            id="cccd-confirm-btn"
            disabled={isAiProcessingDeclaration}
            onClick={async () => {
              if (isAiProcessingDeclaration) return;
              const serviceRoute = normalizeServiceRoute(location.pathname);
              const service = ROUTE_TO_SERVICE_MAP[serviceRoute];
              const routeSpecificFieldMap = getRouteSpecificCccdFieldMap(serviceRoute, info);
              const fields: Record<string, string> = routeSpecificFieldMap
                ? buildFieldsFromCccdMap(info, routeSpecificFieldMap)
                : {};

              if (Object.keys(fields).length === 0) {
                service?.fields.forEach((field) => {
                  if (!field.cccdKey) return;
                  const rawValue = info[field.cccdKey];
                  if (!rawValue) return;
                  fields[field.id] = field.cccdKey === 'gioiTinh'
                    ? normalizeGenderValue(rawValue)
                    : rawValue;
                });
              }

              if (Object.keys(fields).length === 0) {
                const fallbackFieldMap = FALLBACK_CCCD_FIELD_MAP[serviceRoute];
                Object.assign(fields, buildFieldsFromCccdMap(info, fallbackFieldMap || {}));
              }

              if (Object.keys(fields).length === 0) {
                dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
                if (state.confirmationSource === 'voice') {
                  resumeRealtimeWithVoice(
                    'Thủ tục hiện tại chưa có trường phù hợp để tự điền từ CCCD. Anh/Chị muốn nhập thủ công hay chọn thủ tục khác?',
                    ['Nhập thông tin thủ công', 'Chọn thủ tục khác'],
                  );
                } else {
                  const msg = 'Thủ tục hiện tại chưa có trường phù hợp để tự điền từ CCCD. Anh/Chị muốn nhập thủ công hay chọn thủ tục khác?';
                  dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                      id: crypto.randomUUID(),
                      role: 'bot',
                      type: 'text',
                      content: msg,
                      timestamp: new Date(),
                      suggestions: ['Nhập thông tin thủ công', 'Chọn thủ tục khác']
                    }
                  });
                }
                return;
              }

              setIsAiProcessingDeclaration(true);
              await waitForAiDeclarationProcessing();
              fillFields(fields);
              setIsAiProcessingDeclaration(false);
              dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
              dispatch({ type: 'CLOSE' });
              showFillSuccessMessage(
                  'Em đã điền thông tin từ CCCD vào biểu mẫu. Anh/Chị muốn em kiểm tra các mục còn thiếu hay hướng dẫn bước tiếp theo?',
                  'Em đã điền thông tin từ CCCD vào biểu mẫu. Anh/Chị muốn em kiểm tra các mục còn thiếu hay hướng dẫn bước tiếp theo?',
                  ['Kiểm tra mục còn thiếu', 'Hướng dẫn bước tiếp theo', 'Tiếp tục bằng giọng nói'],
                  ['Kiểm tra mục còn thiếu', 'Hướng dẫn bước tiếp theo'],
              );
            }}
          >
            {isAiProcessingDeclaration ? 'AI đang xử lý...' : 'Xác nhận và điền'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
              if (state.confirmationSource === 'voice') {
                resumeRealtimeWithVoice(
                  'Dạ, em chưa dùng thông tin CCCD này. Anh/Chị muốn gửi ảnh khác, nhập thủ công hay tiếp tục bằng giọng nói?',
                  ['Gửi ảnh khác', 'Nhập thông tin thủ công', 'Tiếp tục bằng giọng nói'],
                );
              } else {
                const msg = 'Dạ, em chưa dùng thông tin CCCD này. Anh/Chị muốn gửi ảnh khác hay nhập thủ công?';
                dispatch({
                  type: 'ADD_MESSAGE',
                  payload: {
                    id: crypto.randomUUID(),
                    role: 'bot',
                    type: 'text',
                    content: msg,
                    timestamp: new Date(),
                    suggestions: ['Gửi ảnh khác', 'Nhập thông tin thủ công']
                  }
                });
              }
            }}
          >
            Hủy
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
    const serviceRoute = normalizeServiceRoute(location.pathname);
    const service = ROUTE_TO_SERVICE_MAP[serviceRoute];
    const getConfirmDisplayValue = (fieldId: string, value: string) => {
      const fieldOption = service?.fields
        .find((field) => field.id === fieldId)
        ?.options?.find((option) =>
          option.value === value
          || normalizeConfirmOptionText(option.value) === normalizeConfirmOptionText(value)
          || normalizeConfirmOptionText(option.label) === normalizeConfirmOptionText(value)
        );
      if (fieldOption) return fieldOption.label;

      const control = typeof document !== 'undefined' ? document.getElementById(fieldId) : null;
      if (control instanceof HTMLSelectElement) {
        const option = [...control.options].find((candidate) =>
          candidate.value === value
          || normalizeConfirmOptionText(candidate.value) === normalizeConfirmOptionText(value)
          || normalizeConfirmOptionText(candidate.label) === normalizeConfirmOptionText(value)
        );
        return option?.label || value;
      }

      return value;
    };

    return (
      <div className="fill-confirm-card">
        <div className="fill-confirm-title">Thông tin sẽ điền</div>
        {fillDecision === null && (
          <div className="confirmation-required-note">
            Chọn Xác nhận và điền hoặc Không điền.
          </div>
        )}
        <div className="fill-confirm-fields">
          {Object.entries(fields).map(([fieldId, value]) => (
            <div className="fill-confirm-field" key={fieldId}>
              <span className="fill-confirm-label">{labels?.[fieldId] || fieldId}</span>
              {previousValues?.[fieldId] && previousValues[fieldId] !== value && (
                <span className="fill-confirm-old">{getConfirmDisplayValue(fieldId, previousValues[fieldId])} →</span>
              )}
              <span className="fill-confirm-value">{getConfirmDisplayValue(fieldId, value)}</span>
            </div>
          ))}
        </div>

        {fillDecision === null ? (
          <div className="fill-confirm-actions">
            <button className="btn btn-primary btn-sm" onClick={() => confirmFill(fields)}>
              {isAiProcessingDeclaration ? 'AI đang xử lý...' : 'Xác nhận và điền'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancelFill}>
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

  const renderValidationCard = () => {
    const errors = (message.data?.validationErrors as Array<{
      field: string;
      label: string;
      message: string;
      severity: string;
    }>) || [];

    if (errors.length === 0) {
      return (
        <div className="validation-result">
          <div className="validation-item success">
            <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Tất cả thông tin đều hợp lệ. Bạn có thể nộp hồ sơ.</span>
          </div>
        </div>
      );
    }

    return (
      <div className="validation-result">
        {errors.map((error, index) => (
          <div key={index} className={`validation-item ${error.severity}`}>
            {error.severity === 'error'
              ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span><strong>{error.label}:</strong> {error.message}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderDocumentReviewCard = () => {
    const review = message.data?.documentReview as {
      flag?: 'green' | 'red';
      warnings?: string[];
      readerProvider?: string;
      provider?: string;
    } | undefined;
    if (!review?.flag) return null;
    const isValid = review.flag === 'green';

    return (
      <div className={`document-review-card ${isValid ? 'valid' : 'invalid'}`}>
        <div className="document-review-status">
          {isValid ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          <strong>{isValid ? 'Văn bản hợp lệ sơ bộ' : 'Văn bản cần chỉnh sửa'}</strong>
        </div>
        {review.warnings && review.warnings.length > 0 && (
          <div className="document-review-warning">
            Cảnh báo OCR: {review.warnings.slice(0, 2).join('; ')}
          </div>
        )}
        <div className="document-review-meta">
          SmartReader: {review.readerProvider || 'VNPT'} · Reviewer: {review.provider || 'OpenAI'}
        </div>
      </div>
    );
  };

  return (
    <>
    {isAiProcessingDeclaration && createPortal(
      <div className="ai-declaration-processing-overlay" role="status" aria-live="polite">
        <div className="ai-declaration-processing-card">
          <LoaderCircle className="ai-declaration-processing-spinner" size={28} />
          <strong>AI đang xử lý</strong>
          <span>{AI_DECLARATION_PROCESSING_MESSAGE}</span>
        </div>
      </div>,
      document.body,
    )}
    <div className={`message-wrapper ${message.role}${isActiveConfirmation ? ' message-wrapper--confirmation' : ''}`}>
      <div className="message-avatar">
        {isBot
          ? <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
          : <User size={14} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%' }}>
        <div className="message-bubble">
          <div className="message-content">{renderContent(message.content)}</div>
          {message.type === 'navigation-confirm' && state.pendingNavigation && isActiveConfirmation && renderNavConfirmCard()}
          {message.type === 'cccd-preview' && renderCCCDPreviewCard()}
          {message.type === 'fill-confirm' && (isActiveConfirmation || fillDecision) && renderFillConfirmCard()}
          {message.type === 'validation-result' && renderValidationCard()}
          {Boolean(message.data?.documentReview) && renderDocumentReviewCard()}
        </div>

        <span className="message-time">
          {time}
          {statusLabel && (
            <span className={`message-status message-status--${message.status}`}>
              {statusLabel}
            </span>
          )}
          {responseTimeLabel && (
            <span className="message-response-time" title="Thời gian từ lúc gửi câu hỏi đến khi nhận phản hồi hoàn chỉnh">
              Phản hồi: {responseTimeLabel}
            </span>
          )}
        </span>

        {isBot && !isActiveConfirmation && message.suggestions && message.suggestions.length > 0 && (
          <div className="suggestion-chips">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-chip"
                onClick={() => sendMessage(suggestion)}
                id={`suggestion-${message.id}-${index}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

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
      {messages.map((message) => (
        <ChatMessageItem key={message.id} message={message} />
      ))}

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
