import React, { useRef, useEffect, useState, useCallback } from "react";
import { useChatbot } from "../../contexts/ChatbotContext";
import { ocrService, smartbotService, sttService, ttsService } from "../../api/aiServices";
import { Mic, MicOff, Send, Camera } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  variant?: "panel" | "bar";
  autoFocus?: boolean;
  onFocusInput?: () => void;
  onBeforeSend?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  variant = "panel",
  autoFocus = false,
  onFocusInput,
  onBeforeSend,
}) => {
  const { state, dispatch, handleAIResponse } = useChatbot();
  const [inputValue, setInputValue] = useState("");
  const [interimText, setInterimText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const voiceConversationRef = useRef(false);
  const stateRef = useRef(state);
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
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
    setInputValue("");
    setInterimText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const finishVoiceUtterance = useCallback(async () => {
    if (!stateRef.current.isListening) return;
    let shouldClearSttLoading = true;
    try {
        dispatch({ type: "SET_LISTENING", payload: false });
        dispatch({
          type: "SET_CALL_STATUS",
          payload: { status: "transcribing", text: "Đang gửi giọng nói lên VNPT SmartVoice..." },
        });
        dispatch({ type: "SET_LOADING", payload: true });
        const transcript = (await sttService.stopListening()).trim();
        const finalText = transcript || inputValue.trim() || interimText.trim();
        if (finalText) {
          setInputValue("");
          setInterimText("");
          dispatch({ type: "SET_LOADING", payload: false });
          dispatch({
            type: "SET_CALL_STATUS",
            payload: { status: "thinking", text: "Trợ lý đang suy nghĩ..." },
          });
          shouldClearSttLoading = false;
          await onSend(finalText);
        } else {
          dispatch({
            type: "SET_CALL_STATUS",
            payload: { status: "listening", text: "Không nghe thấy câu nói rõ ràng. Tôi đang lắng nghe lại..." },
          });
        }
      } catch (error) {
        voiceConversationRef.current = false;
        dispatch({ type: "SET_CALL_MODE", payload: false });
        dispatch({
          type: "SET_CALL_STATUS",
          payload: { status: "error", text: "Không thể nhận dạng giọng nói." },
        });
        console.warn("[ChatInput Voice] STT failed:", error);
      handleAIResponse({
        intent: "CHAT",
        message: error instanceof Error
          ? `Không thể nhận dạng giọng nói: ${error.message}`
          : "Không thể nhận dạng giọng nói. Vui lòng thử lại.",
        suggestions: ["Thử lại", "Nhập bằng bàn phím"],
      });
    } finally {
      if (shouldClearSttLoading) dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [dispatch, handleAIResponse, inputValue, interimText, onSend]);

  const startVoiceListening = useCallback(async () => {
    if (!voiceConversationRef.current || !stateRef.current.isCallMode || stateRef.current.isListening || stateRef.current.isLoading || stateRef.current.isSpeaking) return;
    dispatch({
      type: "SET_CALL_STATUS",
      payload: { status: "connecting", text: "Đang kết nối microphone và VNPT SmartVoice..." },
    });
    dispatch({ type: "SET_LISTENING", payload: true });
    setInterimText("");
    setInputValue("");

    try {
      await sttService.startListening((transcript: string, isFinal: boolean) => {
        if (isFinal) {
          setInputValue(transcript);
          setInterimText("");
        } else {
          setInterimText(transcript);
        }
      }, { onSilence: finishVoiceUtterance });
      dispatch({
        type: "SET_CALL_STATUS",
        payload: { status: "listening", text: "Đang lắng nghe..." },
      });
    } catch (error) {
      dispatch({ type: "SET_LISTENING", payload: false });
      voiceConversationRef.current = false;
      dispatch({ type: "SET_CALL_MODE", payload: false });
      dispatch({
        type: "SET_CALL_STATUS",
        payload: { status: "error", text: "Không thể bật microphone." },
      });
      console.warn("[ChatInput Voice] Voice input unavailable:", error);
      handleAIResponse({
        intent: "CHAT",
        message: error instanceof Error
          ? `Không thể bật microphone: ${error.message}`
          : "Không thể bật microphone. Vui lòng kiểm tra quyền truy cập.",
        suggestions: ["Thử lại", "Nhập bằng bàn phím"],
      });
    }
  }, [dispatch, finishVoiceUtterance, handleAIResponse]);

  useEffect(() => {
    if (!state.isCallMode || !voiceConversationRef.current || state.isListening || state.isLoading || state.isSpeaking) return;
    const timer = window.setTimeout(() => {
      void startVoiceListening();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state.isCallMode, state.isListening, state.isLoading, state.isSpeaking, startVoiceListening]);

  // Voice recording toggle
  const toggleRecording = async () => {
    if (variant === "bar") {
      onBeforeSend?.();
      onFocusInput?.();
      return;
    }

    if (voiceConversationRef.current || state.isListening) {
      voiceConversationRef.current = false;
      stateRef.current = { ...stateRef.current, isCallMode: false, isListening: false, isSpeaking: false };
      dispatch({ type: "SET_CALL_MODE", payload: false });
      dispatch({
        type: "SET_CALL_STATUS",
        payload: { status: "idle", text: null },
      });
      ttsService.stop();
      if (state.isListening) {
        dispatch({ type: "SET_LISTENING", payload: false });
        await sttService.stopListening().catch(() => "");
      }
      return;
    }

    voiceConversationRef.current = true;
    stateRef.current = { ...stateRef.current, isCallMode: true };
    dispatch({ type: "SET_CALL_MODE", payload: true });
    dispatch({
      type: "SET_CALL_STATUS",
      payload: { status: "connecting", text: "Đang bắt đầu cuộc gọi..." },
    });
    await startVoiceListening();
  };

  // OCR image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show uploading message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user" as const,
      type: "image" as const,
      content: `Đã gửi ảnh: ${file.name}`,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_LOADING", payload: true });

    // Add processing bot message
    const processingMsg = {
      id: `msg_${Date.now()}_proc`,
      role: "bot" as const,
      type: "text" as const,
      content: "Đang đọc thông tin từ ảnh CCCD...",
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: processingMsg });

    try {
      const resizedFile = await ocrService.resizeImage(file);
      const cccdInfo = await ocrService.extractCCCDInfo(resizedFile);
      smartbotService.setRecentOcrFacts(
        Object.fromEntries(
          Object.entries(cccdInfo)
            .filter(([key, value]) => key !== "rawText" && typeof value === "string" && value.trim()),
        ),
      );

      handleAIResponse({
        intent: "OCR_CONFIRM",
        message:
          "Tôi đã đọc được thông tin từ CCCD của bạn!\n\nVui lòng kiểm tra lại thông tin bên dưới trước khi xác nhận điền vào form:",
        data: { cccdInfo },
        suggestions: [
          "Xác nhận và điền vào form",
          "Thông tin cần sửa lại",
          "Hủy",
        ],
      });
    } catch (err) {
      console.warn("[ChatInput OCR] API failed:", err);
      handleAIResponse({
        intent: "CHAT",
        message: err instanceof Error
          ? `Không thể đọc ảnh CCCD: ${err.message}`
          : "Không thể đọc ảnh CCCD. Vui lòng thử lại với ảnh rõ hơn.",
        suggestions: ["Thử ảnh khác", "Nhập thông tin thủ công"],
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayValue = state.isListening
    ? interimText || inputValue
    : inputValue;

  const callStatusLabel = state.callStatusText ?? (
    state.callStatus === "connecting" ? "Đang kết nối VNPT SmartVoice..."
      : state.callStatus === "listening" ? "Đang lắng nghe..."
      : state.callStatus === "transcribing" ? "Đang nhận dạng giọng nói..."
      : state.callStatus === "thinking" ? "Trợ lý đang suy nghĩ..."
      : state.callStatus === "speaking" ? "Trợ lý đang trả lời..."
      : state.callStatus === "error" ? "Cuộc gọi gặp lỗi"
      : "Sẵn sàng lắng nghe"
  );

  return (
    <div className={`chatbot-input-area chatbot-input-area--${variant} ${state.isCallMode ? "call-mode" : ""}`}>
      {state.isCallMode && (
        <div className={`call-mode-panel call-mode-panel--${state.callStatus}`}>
          <div className="call-mode-orb" aria-hidden="true">
            <Mic size={14} />
          </div>
          <div className="call-mode-copy">
            <div className="call-mode-title">Đang trong cuộc gọi với Trợ lý AI</div>
            <div className="call-mode-status">{callStatusLabel}</div>
          </div>
          <button
            className="call-mode-end-btn"
            type="button"
            onClick={toggleRecording}
            aria-label="Kết thúc cuộc gọi"
          >
            Kết thúc
          </button>
        </div>
      )}
      <div className={`chatbot-input-row ${state.isListening ? "is-recording" : ""}`}>
        {state.isListening ? (
          <div className="voice-input-state">
            <div className="voice-status-left">
              <Mic size={16} />
              <span>{interimText ? `"${interimText.slice(0, 28)}${interimText.length > 28 ? "..." : ""}"` : "Đang nghe..."}</span>
            </div>
            <div className="voice-waveform" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="chatbot-input-field"
            value={displayValue}
            onChange={(e) => !state.isListening && setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocusInput}
            placeholder={
              variant === "bar"
                ? "Hỏi Trợ lý AI về thủ tục, giấy tờ, cách điền hồ sơ..."
                : "Nhập tin nhắn hoặc câu hỏi..."
            }
            disabled={disabled || state.isLoading}
            rows={1}
            aria-label="Nhập tin nhắn"
            id="chat-input-field"
          />
        )}

        <div className="chatbot-input-actions">
          {/* Image upload menu */}
          <div style={{ position: "relative" }}>
            <button
              className="input-action-btn"
              onClick={() => setShowCameraMenu(!showCameraMenu)}
              title="Upload hoặc chụp ảnh CCCD"
              disabled={disabled || state.isLoading || state.isListening}
              aria-label="Upload ảnh CCCD"
            >
              <Camera size={16} />
            </button>

            {showCameraMenu && (
              <>
                <div 
                  style={{ position: "fixed", inset: 0, zIndex: 10 }} 
                  onClick={() => setShowCameraMenu(false)}
                />
                <div className="camera-options-menu" style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginBottom: "8px",
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: "160px",
                  zIndex: 20,
                  overflow: "hidden"
                }}>
                  <button 
                    onClick={() => { setShowCameraMenu(false); fileInputRef.current?.click(); }}
                    style={{ padding: "10px 12px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px", borderBottom: "1px solid #f1f5f9" }}
                  >
                    Tải ảnh từ máy
                  </button>
                  <button 
                    onClick={() => { setShowCameraMenu(false); cameraInputRef.current?.click(); }}
                    style={{ padding: "10px 12px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px" }}
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
              style={{ display: "none" }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Mic button */}
          <button
            className={`input-action-btn ${state.isListening ? "recording" : ""}`}
            onClick={toggleRecording}
            title={variant === "bar" ? "Mở khung chat để gọi" : state.isCallMode ? "Kết thúc cuộc gọi" : "Bắt đầu cuộc gọi"}
            disabled={disabled}
            aria-label={variant === "bar" ? "Mở khung chat để gọi" : state.isCallMode ? "Kết thúc cuộc gọi" : "Bắt đầu cuộc gọi"}
          >
            {state.isCallMode ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

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
    </div>
  );
};

export default ChatInput;
