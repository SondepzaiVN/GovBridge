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

interface STTApiResult {
    provider: 'mock' | 'vnpt';
    transcript: string;
    confidence: number | null;
    audioDuration: number | null;
}

const CHAT_SESSION_KEY = 'gov-bridge-chat-session-id';
let currentRoute = '/';
let recentOcrFacts: Record<string, string> = {};

const getStoredSessionId = () =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(CHAT_SESSION_KEY);

export const smartbotService = {
    setCurrentRoute: (route: string) => {
        currentRoute = route;
    },
    setRecentOcrFacts: (facts: Record<string, string>) => {
        recentOcrFacts = Object.fromEntries(
            Object.entries(facts)
                .filter(([, value]) => typeof value === 'string' && value.trim())
                .map(([key, value]) => [key, value.trim().slice(0, 2_000)]),
        );
    },
    clearHistory: async () => {
        const sessionId = getStoredSessionId();
        recentOcrFacts = {};
        window.sessionStorage.removeItem(CHAT_SESSION_KEY);
        if (!sessionId) return;

        try {
            await apiClient<{ deleted: boolean }>(`/assistant/sessions/${sessionId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.warn('[Assistant] Cannot clear backend session:', error);
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
                recentOcrFacts,
            }),
        });

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(CHAT_SESSION_KEY, result.sessionId);
        }

        return result;
    },
};

interface ActiveVoiceCapture {
    stream: MediaStream;
    audioContext: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
    sampleRate: number;
    callback: (transcript: string, isFinal: boolean) => void;
    onSilence?: () => void;
    hasSpeech: boolean;
    silenceStartedAt: number | null;
    autoStopping: boolean;
    speechSampleCount: number;
    maxRms: number;
}

let activeCapture: ActiveVoiceCapture | null = null;
let sharedStream: MediaStream | null = null;
const SPEECH_RMS_THRESHOLD = 0.018;
const SILENCE_END_MS = 1200;
const MAX_UTTERANCE_MS = 15000;
const MIN_SPEECH_MS = 300;

const mergeAudioChunks = (chunks: Float32Array[]): Float32Array => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
        samples.set(chunk, offset);
        offset += chunk.length;
    });
    return samples;
};

const writeString = (view: DataView, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
};

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = 44;
    samples.forEach((sample) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += bytesPerSample;
    });

    return new Blob([buffer], { type: 'audio/wav' });
};

const disposeVoiceCapture = async (capture: ActiveVoiceCapture) => {
    capture.processor.disconnect();
    capture.source.disconnect();
    await capture.audioContext.close().catch(() => undefined);
};

export const sttService = {
    warmupStream: async () => {
        if (!navigator.mediaDevices?.getUserMedia) return;
        if (!sharedStream || sharedStream.getAudioTracks().every(t => t.readyState === 'ended')) {
            try {
                sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (error) {
                console.warn('[STT] Warmup failed', error);
            }
        }
    },
    releaseStream: () => {
        if (sharedStream) {
            sharedStream.getTracks().forEach((track) => track.stop());
            sharedStream = null;
        }
    },
    startListening: async (
        callback: (transcript: string, isFinal: boolean) => void,
        options: { onSilence?: () => void } = {},
    ) => {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Trình duyệt không hỗ trợ thu âm microphone.');
        }

        await sttService.stopListening();
        
        if (!sharedStream || sharedStream.getAudioTracks().every(t => t.readyState === 'ended')) {
            sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        const stream = sharedStream;
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const chunks: Float32Array[] = [];
        const startedAt = performance.now();

        processor.onaudioprocess = (event) => {
            const input = new Float32Array(event.inputBuffer.getChannelData(0));
            chunks.push(input);

            const capture = activeCapture;
            if (!capture || capture.autoStopping || !capture.onSilence) return;

            let sum = 0;
            for (let index = 0; index < input.length; index += 1) {
                sum += input[index] * input[index];
            }
            const rms = Math.sqrt(sum / input.length);
            const now = performance.now();
            capture.maxRms = Math.max(capture.maxRms, rms);

            if (rms >= SPEECH_RMS_THRESHOLD) {
                capture.hasSpeech = true;
                capture.speechSampleCount += input.length;
                capture.silenceStartedAt = null;
                return;
            }

            if (capture.hasSpeech) {
                capture.silenceStartedAt ??= now;
                if (now - capture.silenceStartedAt >= SILENCE_END_MS) {
                    capture.autoStopping = true;
                    capture.onSilence();
                }
                return;
            }

            if (now - startedAt >= MAX_UTTERANCE_MS) {
                capture.autoStopping = true;
                capture.onSilence();
            }
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
        activeCapture = {
            stream,
            audioContext,
            source,
            processor,
            chunks,
            sampleRate: audioContext.sampleRate,
            callback,
            onSilence: options.onSilence,
            hasSpeech: false,
            silenceStartedAt: null,
            autoStopping: false,
            speechSampleCount: 0,
            maxRms: 0,
        };
    },
    stopListening: async (): Promise<string> => {
        const capture = activeCapture;
        if (!capture) return '';
        activeCapture = null;

        await disposeVoiceCapture(capture);

        const speechMs = (capture.speechSampleCount / capture.sampleRate) * 1000;
        if (speechMs < MIN_SPEECH_MS) {
            console.info('[STT] Skip transcription because captured speech is too short.', {
                speechMs: Math.round(speechMs),
                maxRms: Number(capture.maxRms.toFixed(4)),
            });
            return '';
        }

        const audioBlob = encodeWav(mergeAudioChunks(capture.chunks), capture.sampleRate);
        const formData = new FormData();
        formData.append('audioFile', audioBlob, `recording-${Date.now()}.wav`);
        formData.append('clientSession', crypto.randomUUID());

        const result = await apiClient<STTApiResult>('/speech/stt', {
            method: 'POST',
            body: formData,
        });
        const transcript = result.transcript.trim();
        if (transcript) capture.callback(transcript, true);
        return transcript;
    },
    cancelListening: async (): Promise<void> => {
        const capture = activeCapture;
        if (!capture) return;
        activeCapture = null;
        await disposeVoiceCapture(capture);
    },
};

let activeAudio: HTMLAudioElement | null = null;
let activeSpeechId = 0;
let resolveActiveAudio: (() => void) | null = null;

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
        const speechId = activeSpeechId;
        onStatusChange?.(true);
        try {
            const result = await apiClient<TTSApiResult>('/speech/tts', {
                method: 'POST',
                body: JSON.stringify({ text }),
            });
            if (speechId !== activeSpeechId) return;

            if (!result.audioUrl || result.useBrowserFallback) {
                await speakWithBrowser(text);
                return;
            }

            await new Promise<void>((resolve, reject) => {
                resolveActiveAudio = resolve;
                activeAudio = new Audio(result.audioUrl!);
                activeAudio.onended = () => resolve();
                activeAudio.onerror = () => reject(new Error('Không phát được audio từ backend.'));
                activeAudio.play().catch(reject);
            });
        } catch (error) {
            if (speechId !== activeSpeechId) return;
            console.warn('[TTS] Backend unavailable, using browser fallback:', error);
            await speakWithBrowser(text);
        } finally {
            if (speechId === activeSpeechId) {
                activeAudio = null;
                resolveActiveAudio = null;
                onStatusChange?.(false);
            }
        }
    },
    stop: () => {
        activeSpeechId += 1;
        activeAudio?.pause();
        activeAudio = null;
        resolveActiveAudio?.();
        resolveActiveAudio = null;
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
