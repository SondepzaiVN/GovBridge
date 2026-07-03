import React, { useRef, useEffect, useState } from "react";
import { useChatbot } from "../../contexts/ChatbotContext";
import { ocrService, smartbotService, sttService } from "../../api/aiServices";
import { Mic, MicOff, Send, Camera } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
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
  const [showCameraMenu, setShowCameraMenu] = useState(false);

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

  // Voice recording toggle
  const toggleRecording = async () => {
    if (state.isListening) {
      sttService.stopListening();
      dispatch({ type: "SET_LISTENING", payload: false });
      // Send whatever was captured
      const finalText = inputValue.trim() || interimText.trim();
      if (finalText) {
        onSend(finalText);
        setInputValue("");
        setInterimText("");
      }
    } else {
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
        });
      } catch (error) {
        console.warn("[ChatInput Voice] Voice input unavailable, using mock listening state:", error);
      }
    }
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
      content: `📷 Đã gửi ảnh: ${file.name}`,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_LOADING", payload: true });

    // Add processing bot message
    const processingMsg = {
      id: `msg_${Date.now()}_proc`,
      role: "bot" as const,
      type: "text" as const,
      content: "🔍 Đang đọc thông tin từ ảnh CCCD...",
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
          "Tôi đã đọc được thông tin từ CCCD của bạn! 📋\n\nVui lòng kiểm tra lại thông tin bên dưới trước khi xác nhận điền vào form:",
        data: { cccdInfo },
        suggestions: [
          "Xác nhận và điền vào form",
          "Thông tin cần sửa lại",
          "Huỷ",
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

  return (
    <div className={`chatbot-input-area chatbot-input-area--${variant}`}>
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
            title={state.isListening ? "Dừng ghi âm" : "Ghi âm giọng nói"}
            disabled={disabled || state.isLoading}
            aria-label={state.isListening ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
          >
            {state.isListening ? <MicOff size={16} /> : <Mic size={16} />}
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
