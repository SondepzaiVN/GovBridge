import type { AgentEvent } from '../utils/eventBus';
import type { AIResponse, CCCDInfo } from '../types';
import { apiClient } from './client';

interface AssistantApiResult {
    sessionId: string;
    response: AIResponse;
    actions: AgentEvent[];
}

interface AssistantContext {
    currentRoute?: string;
    formValues?: Record<string, string>;
}

interface OCRApiResult {
    provider: 'mock' | 'vnpt';
    info: CCCDInfo;
}

interface TTSApiResult {
    provider: 'mock' | 'vnpt';
    audioUrl: string | null;
    useBrowserFallback: boolean;
}

const CHAT_SESSION_KEY = 'gov-bridge-chat-session-id';
let currentRoute = '/';

const getStoredSessionId = () =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(CHAT_SESSION_KEY);

export const smartbotService = {
    setCurrentRoute: (route: string) => {
        currentRoute = route;
    },
    clearHistory: async () => {
        const sessionId = getStoredSessionId();
        window.sessionStorage.removeItem(CHAT_SESSION_KEY);
        if (!sessionId) return;

        try {
            await apiClient<{ deleted: boolean }>(`/assistant/sessions/${sessionId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.warn('[Assistant] Không thể xóa session ở backend:', error);
        }
    },
    getBackendInfo: () => 'Express Backend API',
    sendMessage: async (
        message: string,
        context: AssistantContext = {},
    ): Promise<AssistantApiResult> => {
        const result = await apiClient<AssistantApiResult>('/assistant/messages', {
            method: 'POST',
            body: JSON.stringify({
                ...(getStoredSessionId() ? { sessionId: getStoredSessionId() } : {}),
                message,
                currentRoute: context.currentRoute ?? currentRoute,
                formValues: context.formValues ?? {},
            }),
        });

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(CHAT_SESSION_KEY, result.sessionId);
        }

        return result;
    },
};

interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: ArrayLike<{
        isFinal: boolean;
        0: { transcript: string };
    }>;
}

interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
let activeRecognition: SpeechRecognitionLike | null = null;

export const sttService = {
    startListening: async (callback: (transcript: string, isFinal: boolean) => void) => {
        const speechWindow = window as typeof window & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
        };
        const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

        if (!Recognition) {
            throw new Error('Trình duyệt không hỗ trợ nhận dạng giọng nói.');
        }

        activeRecognition?.stop();
        const recognition = new Recognition();
        activeRecognition = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (!result) continue;
                if (result.isFinal) final += result[0].transcript;
                else interim += result[0].transcript;
            }
            callback((final || interim).trim(), Boolean(final));
        };
        recognition.onerror = () => {
            activeRecognition = null;
        };
        recognition.onend = () => {
            activeRecognition = null;
        };
        recognition.start();
    },
    stopListening: () => {
        activeRecognition?.stop();
        activeRecognition = null;
    },
};

let activeAudio: HTMLAudioElement | null = null;

const speakWithBrowser = (text: string): Promise<void> =>
    new Promise((resolve) => {
        const plainText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/[#•]/g, '')
            .replace(/\n+/g, ' ')
            .trim();
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });

export const ttsService = {
    speak: async (text: string, onStatusChange?: (isPlaying: boolean) => void) => {
        ttsService.stop();
        onStatusChange?.(true);
        try {
            const result = await apiClient<TTSApiResult>('/speech/tts', {
                method: 'POST',
                body: JSON.stringify({ text }),
            });

            if (!result.audioUrl || result.useBrowserFallback) {
                await speakWithBrowser(text);
                return;
            }

            await new Promise<void>((resolve, reject) => {
                activeAudio = new Audio(result.audioUrl!);
                activeAudio.onended = () => resolve();
                activeAudio.onerror = () => reject(new Error('Không phát được âm thanh từ backend.'));
                activeAudio.play().catch(reject);
            });
        } catch (error) {
            console.warn('[TTS] Backend không khả dụng, dùng giọng đọc trình duyệt:', error);
            await speakWithBrowser(text);
        } finally {
            activeAudio = null;
            onStatusChange?.(false);
        }
    },
    stop: () => {
        activeAudio?.pause();
        activeAudio = null;
        window.speechSynthesis.cancel();
    },
};

export const ocrService = {
    resizeImage: async (file: File) => file,
    extractCCCDInfo: async (file: File): Promise<CCCDInfo> => {
        const formData = new FormData();
        formData.append('file', file);
        const result = await apiClient<OCRApiResult>('/identity/cccd/ocr', {
            method: 'POST',
            body: formData,
        });
        return result.info;
    },
};
