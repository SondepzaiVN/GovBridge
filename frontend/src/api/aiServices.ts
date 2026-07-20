import type { AgentEvent } from '../utils/eventBus';
import type { AIResponse, AssistantPageContext, CCCDInfo, DocumentReviewResult, DocumentReviewRuleType, DocumentReviewUiStatus, VisibleFieldGroup } from '../types';
import { apiClient } from './client';
import { notifyCccdOcrExternalProcessing } from '../utils/externalProcessingNotices';

interface AssistantApiResult {
    sessionId: string;
    response: AIResponse;
    actions: AgentEvent[];
}

interface AssistantContext {
    currentRoute?: string;
    formValues?: Record<string, string>;
    /** Danh sách field phân tầng theo khu vực đang hiển thị trên màn hình. */
    visibleFieldGroups?: VisibleFieldGroup[];
    pageContext?: AssistantPageContext | null;
    clientInterruptedAssistantMessages?: ClientInterruptedAssistantMessage[];
}

export interface ClientInterruptedAssistantMessage {
    content: string;
    createdAt?: string;
}

export interface RecentDocumentReviewContext {
    label: string;
    fileName?: string;
    documentType?: DocumentReviewRuleType;
    status: Exclude<DocumentReviewUiStatus, 'checking'>;
    flag?: DocumentReviewResult['flag'];
    text: string;
    warnings?: string[];
    readerProvider?: string;
    reviewerProvider?: string;
    checkedAt: string;
}

interface AssistantRequestOptions {
    signal?: AbortSignal;
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

type DocumentReviewApiResult = DocumentReviewResult;

const CHAT_SESSION_KEY = 'gov-bridge-chat-session-id';
const MAX_RECENT_DOCUMENT_REVIEWS = 3;
let currentRoute = '/';
let recentOcrFacts: Record<string, string> = {};
let recentDocumentReviews: RecentDocumentReviewContext[] = [];

const compactDocumentReviewContext = (
    review: RecentDocumentReviewContext,
): RecentDocumentReviewContext | null => {
    const label = review.label.trim().slice(0, 200);
    const text = review.text.trim().slice(0, 1_200);
    if (!label || !text) return null;

    return {
        label,
        ...(review.fileName ? { fileName: review.fileName.trim().slice(0, 200) } : {}),
        ...(review.documentType ? { documentType: review.documentType } : {}),
        status: review.status,
        ...(review.flag ? { flag: review.flag } : {}),
        text,
        warnings: (review.warnings ?? [])
            .filter((warning) => typeof warning === 'string' && warning.trim())
            .map((warning) => warning.trim().slice(0, 500))
            .slice(0, 5),
        ...(review.readerProvider ? { readerProvider: review.readerProvider.trim().slice(0, 80) } : {}),
        ...(review.reviewerProvider ? { reviewerProvider: review.reviewerProvider.trim().slice(0, 80) } : {}),
        checkedAt: review.checkedAt,
    };
};

export const VOICE_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
};

const isAbortError = (error: unknown) =>
    error instanceof DOMException && error.name === 'AbortError';

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
    rememberDocumentReview: (review: RecentDocumentReviewContext) => {
        const compacted = compactDocumentReviewContext(review);
        if (!compacted) return;

        recentDocumentReviews = [
            compacted,
            ...recentDocumentReviews.filter((item) =>
                item.fileName !== compacted.fileName || item.label !== compacted.label
            ),
        ].slice(0, MAX_RECENT_DOCUMENT_REVIEWS);
    },
    clearHistory: async () => {
        const sessionId = getStoredSessionId();
        recentOcrFacts = {};
        recentDocumentReviews = [];
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
        options: AssistantRequestOptions = {},
    ): Promise<AssistantApiResult> => {
        const result = await apiClient<AssistantApiResult>('/assistant/messages', {
            method: 'POST',
            signal: options.signal,
            body: JSON.stringify({
                ...(getStoredSessionId() ? { sessionId: getStoredSessionId() } : {}),
                message,
                currentRoute: context.currentRoute ?? currentRoute,
                formValues: context.formValues ?? {},
                visibleFieldGroups: context.visibleFieldGroups ?? [],
                ...(context.pageContext ? { pageContext: context.pageContext } : {}),
                recentOcrFacts,
                recentDocumentReviews,
                clientInterruptedAssistantMessages: context.clientInterruptedAssistantMessages ?? [],
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

export interface VoiceInitialAudio {
    chunks: Float32Array[];
    speechSampleCount: number;
    maxRms: number;
    sampleRate: number;
}

let activeCapture: ActiveVoiceCapture | null = null;
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
    capture.stream.getTracks().forEach((track) => track.stop());
    await capture.audioContext.close().catch(() => undefined);
};

export const sttService = {
    startListening: async (
        callback: (transcript: string, isFinal: boolean) => void,
        options: { onSilence?: () => void; initialAudio?: VoiceInitialAudio } = {},
    ) => {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Trình duyệt không hỗ trợ thu âm microphone.');
        }

        await sttService.cancelListening();
        const stream = await navigator.mediaDevices.getUserMedia(VOICE_AUDIO_CONSTRAINTS);
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const initialAudio = options.initialAudio;
        const canUseInitialAudio = initialAudio && Math.abs(initialAudio.sampleRate - audioContext.sampleRate) <= 1;
        if (initialAudio && !canUseInitialAudio) {
            console.info('[STT] Skip barge-in prebuffer because sample rate changed.', {
                initialSampleRate: initialAudio.sampleRate,
                captureSampleRate: audioContext.sampleRate,
            });
        }
        const chunks: Float32Array[] = canUseInitialAudio
            ? initialAudio.chunks.map((chunk) => new Float32Array(chunk))
            : [];
        const initialSpeechSampleCount = canUseInitialAudio ? initialAudio.speechSampleCount : 0;
        const initialMaxRms = canUseInitialAudio ? initialAudio.maxRms : 0;
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
            hasSpeech: initialSpeechSampleCount > 0,
            silenceStartedAt: null,
            autoStopping: false,
            speechSampleCount: initialSpeechSampleCount,
            maxRms: initialMaxRms,
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
let activeTtsController: AbortController | null = null;

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
        const controller = new AbortController();
        activeTtsController = controller;
        onStatusChange?.(true);
        try {
            const result = await apiClient<TTSApiResult>('/speech/tts', {
                method: 'POST',
                signal: controller.signal,
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
            if (controller.signal.aborted || isAbortError(error)) return;
            console.warn('[TTS] Backend unavailable, using browser fallback:', error);
            await speakWithBrowser(text);
        } finally {
            if (speechId === activeSpeechId) {
                activeAudio = null;
                resolveActiveAudio = null;
                activeTtsController = null;
                onStatusChange?.(false);
            }
        }
    },
    stop: () => {
        activeSpeechId += 1;
        activeTtsController?.abort();
        activeTtsController = null;
        activeAudio?.pause();
        activeAudio = null;
        resolveActiveAudio?.();
        resolveActiveAudio = null;
        window.speechSynthesis.cancel();
    },
};

export const ocrService = {
    resizeImage: async (file: File): Promise<File> => {
        if (!file.type.startsWith('image/')) return file;

        const imageUrl = URL.createObjectURL(file);
        try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Không đọc được ảnh CCCD.'));
                img.src = imageUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (!context) return file;
            context.drawImage(image, 0, 0);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error('Không thể chuẩn hóa ảnh CCCD.'))),
                    'image/jpeg',
                    0.92,
                );
            });
            const baseName = file.name.replace(/\.[^.]+$/, '') || 'cccd-front';
            return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    },
    extractCCCDInfo: async (
        file: File,
        options: { showProcessingNotice?: boolean } = {},
    ): Promise<CCCDInfo> => {
        if (options.showProcessingNotice !== false) {
            notifyCccdOcrExternalProcessing();
        }
        const formData = new FormData();
        formData.append('file', file);
        const result = await apiClient<OCRApiResult>('/identity/cccd/ocr', {
            method: 'POST',
            body: formData,
        });
        return result.info;
    },
};

export const documentReviewService = {
    reviewCt01: async (
        file: File,
        context: { currentRoute?: string; documentType: DocumentReviewRuleType },
    ): Promise<DocumentReviewResult> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('currentRoute', context.currentRoute || currentRoute);
        formData.append('documentType', context.documentType);
        return apiClient<DocumentReviewApiResult>('/document-review/ct01', {
            method: 'POST',
            body: formData,
        });
    },
};
