import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Mic, MicOff, Minimize2, Phone, RotateCcw, Sparkles, X } from 'lucide-react';
import { smartbotService, sttService, ttsService, VOICE_AUDIO_CONSTRAINTS, type VoiceInitialAudio } from '../../api/aiServices';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useAuth } from '../../contexts/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatInput from './ChatInput';
import ChatWindow from './ChatWindow';
import {
    CONNECTIVITY_FALLBACK_MESSAGE,
    isLikelyConnectivityError,
    notifyConnectivityFallback,
    preloadConnectivityFallbackAudio,
} from '../../utils/connectivityFallback';

interface ChatHeaderProps {
    title: string;
    subtitle: string;
    onClear: () => void;
    onClose: () => void;
    onMinimize?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
    title,
    subtitle,
    onClear,
    onClose,
    onMinimize,
}) => {
    const { state } = useChatbot();
    const statusText = state.isCallMode
        ? state.callStatusText ?? 'Đang trong cuộc gọi'
        : state.isLoading
          ? 'Trợ lý đang tra cứu...'
          : subtitle;

    return (
        <div className="chatbot-header">
            <div className="chatbot-avatar" style={{ padding: 0 }}>
                <img
                    src="/logo_Gov_Bridge.jpg"
                    alt="Gov Bridge"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
                <div className="chatbot-status-dot" title="Đang hoạt động" />
            </div>

            <div className="chatbot-header-info">
                <div className="chatbot-header-name">{title}</div>
                <div className="chatbot-header-status">{statusText}</div>
            </div>

            {state.isCallMode && (
                <div className="call-header-pill" aria-label="Đang trong cuộc gọi">
                    <Phone size={13} />
                    Cuộc gọi
                </div>
            )}

            <div className="chatbot-header-actions">
                <button
                    className="chatbot-header-btn"
                    onClick={onClear}
                    title="Xoá lịch sử chat"
                    aria-label="Xoá chat"
                    type="button"
                >
                    <RotateCcw size={14} />
                </button>

                {onMinimize && (
                    <button
                        className="chatbot-header-btn"
                        onClick={onMinimize}
                        title="Thu nhỏ"
                        aria-label="Thu nhỏ overlay"
                        type="button"
                    >
                        <Minimize2 size={14} />
                    </button>
                )}

                <button
                    className="chatbot-header-btn"
                    onClick={onClose}
                    title="Đóng"
                    aria-label="Đóng chatbot"
                    id="chatbot-close-btn"
                    type="button"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

const WelcomeState: React.FC = () => {
    const { sendMessage } = useChatbot();
    const suggestions = [
        'Đăng ký tạm trú',
        'Liên thông khai sinh',
        'Cấp lại CCCD',
        'Cần chuẩn bị giấy tờ gì?',
    ];

    return (
        <div className="chatbot-welcome-state">
            <div className="chatbot-welcome-icon">
                <Sparkles size={22} />
            </div>
            <h2>Xin chào, tôi có thể giúp gì cho bạn?</h2>
            <div className="chatbot-welcome-chips">
                {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => sendMessage(item)}>
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};

const getCallStatusLabel = (
    callStatus: ReturnType<typeof useChatbot>['state']['callStatus'],
    callStatusText: string | null,
) => callStatusText ?? (
    callStatus === 'connecting' ? 'Đang kết nối VNPT SmartVoice...'
        : callStatus === 'listening' ? 'Đang lắng nghe...'
        : callStatus === 'transcribing' ? 'Đang nhận dạng giọng nói...'
        : callStatus === 'thinking' ? 'Trợ lý đang suy nghĩ...'
        : callStatus === 'speaking' ? 'Trợ lý đang trả lời...'
        : callStatus === 'interrupting' ? 'Đang nghe bạn nói chen...'
        : callStatus === 'error' ? 'Cuộc gọi gặp lỗi'
    : 'Sẵn sàng lắng nghe'
);

const THINKING_ANNOUNCEMENTS = [
    'Tôi đã nghe câu hỏi của bạn, tôi sẽ giúp bạn ngay lập tức, đợi tôi suy nghĩ nhó',
    'Tôi đang suy nghĩ, bạn chờ tôi một chút nhé!',
    'Tôi sắp suy nghĩ xong rồi, bạn chờ tôi thêm một chút nhé!',
    'Sắp xong rồi, tôi đang hoàn thiện câu trả lời cho bạn.',
];

const INTRO_GREETINGS = [
    'Xin chào! Tôi là trợ lý VNPT AI. Bạn đang cần hỗ trợ thủ tục nào hôm nay?',
    'Chào bạn! Tôi là trợ lý VNPT AI, luôn sẵn sàng đồng hành cùng bạn. Hãy cho tôi biết bạn cần hỗ trợ gì nhé!',
    'Rất vui được gặp bạn! Tôi là trợ lý VNPT AI, có thể giúp việc thực hiện thủ tục hành chính trở nên đơn giản hơn. Bạn muốn bắt đầu từ đâu?',
    'Chào mừng bạn! VNPT AI rất vui được hỗ trợ. Bạn cứ chia sẻ điều đang cần giải đáp nhé!',
    'Bạn cần tra cứu thủ tục, chuẩn bị giấy tờ hay điền hồ sơ? Tôi là trợ lý VNPT AI và sẵn sàng giúp bạn.',
    'Tôi là trợ lý VNPT AI. Thủ tục hành chính đôi khi có nhiều bước, nhưng bạn đừng lo, tôi sẽ hướng dẫn từng bước.',
    'VNPT AI xin chào bạn! Bạn cứ nói tự nhiên điều mình cần, tôi đang lắng nghe.',
    'Tôi là trợ lý VNPT AI, sẵn sàng giải đáp thắc mắc về dịch vụ công thật rõ ràng và dễ hiểu. Bạn cần hỗ trợ gì?',
    'Chào bạn! Trợ lý VNPT AI có thể giúp bạn tìm đúng thủ tục và chuẩn bị đúng giấy tờ. Bạn muốn hỏi nội dung nào?',
    'Trợ lý VNPT AI rất hân hạnh được hỗ trợ bạn hôm nay. Bạn đang quan tâm đến thủ tục hành chính nào?',
    'VNPT AI xin chào bạn! Hãy cho tôi biết nhu cầu của bạn, chúng ta sẽ cùng xử lý từng bước nhé.',
    'Tôi là trợ lý VNPT AI và đã sẵn sàng đồng hành cùng bạn. Bạn cần hướng dẫn, tra cứu hay kiểm tra hồ sơ?',
];

const SUBSEQUENT_GREETINGS = [
    'Trợ lý VNPT AI lại ở đây rồi! Bạn cần hỗ trợ thêm việc gì?',
    'VNPT AI xin chào bạn lần nữa! Hãy cho tôi biết bạn muốn tiếp tục với nội dung nào nhé.',
    'Tôi là trợ lý VNPT AI, rất vui được tiếp tục hỗ trợ bạn. Lần này bạn đang cần giải đáp điều gì?',
    'Trợ lý VNPT AI đang lắng nghe đây. Bạn cần tôi giúp thêm việc gì?',
    'Tôi là trợ lý VNPT AI. Chúng ta tiếp tục nhé, bạn cứ nói điều mình đang cần hỗ trợ.',
];

type VoiceActivityEvent = 'speech_candidate' | 'speech_start' | 'speech_end';

interface BargeInMonitor {
    stop: () => Promise<void>;
}

const BARGE_IN_RMS_THRESHOLD = 0.036;
const BARGE_IN_CONFIRM_MS = 520;
const BARGE_IN_RELEASE_MS = 650;
const BARGE_IN_COOLDOWN_MS = 900;
const BARGE_IN_MIN_ACTIVE_RATIO = 0.68;
const BARGE_IN_MIN_AVG_RMS = 0.038;
const BARGE_IN_MIN_PEAK_RMS = 0.052;

const calculateRms = (input: Float32Array) => {
    let sum = 0;
    for (let index = 0; index < input.length; index += 1) {
        sum += input[index] * input[index];
    }
    return Math.sqrt(sum / input.length);
};

const startBargeInMonitor = async (
    onActivity: (event: VoiceActivityEvent, details: { rms: number; initialAudio?: VoiceInitialAudio }) => void,
): Promise<BargeInMonitor> => {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ microphone.');
    }

    const stream = await navigator.mediaDevices.getUserMedia(VOICE_AUDIO_CONSTRAINTS);
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    let candidateStartedAt: number | null = null;
    let candidateLastActiveAt: number | null = null;
    let candidateFrameCount = 0;
    let activeFrameCount = 0;
    let candidateRmsSum = 0;
    let candidatePeakRms = 0;
    const candidateChunks: Float32Array[] = [];
    let confirmedInitialAudio: VoiceInitialAudio | null = null;
    let confirmed = false;

    const resetCandidate = () => {
        candidateStartedAt = null;
        candidateLastActiveAt = null;
        candidateFrameCount = 0;
        activeFrameCount = 0;
        candidateRmsSum = 0;
        candidatePeakRms = 0;
        candidateChunks.length = 0;
        confirmedInitialAudio = null;
    };

    processor.onaudioprocess = (event) => {
        const input = new Float32Array(event.inputBuffer.getChannelData(0));
        const rms = calculateRms(input);
        const now = performance.now();
        const isActiveFrame = rms >= BARGE_IN_RMS_THRESHOLD;

        if (confirmed) {
            candidateChunks.push(input);
            candidateRmsSum += rms;
            candidatePeakRms = Math.max(candidatePeakRms, rms);
            if (isActiveFrame) {
                activeFrameCount += 1;
                if (confirmedInitialAudio) {
                    confirmedInitialAudio.speechSampleCount += input.length;
                }
            }
            if (confirmedInitialAudio) {
                confirmedInitialAudio.maxRms = Math.max(confirmedInitialAudio.maxRms, rms);
            }
            return;
        }

        if (isActiveFrame || candidateStartedAt !== null) {
            if (candidateStartedAt === null) {
                candidateStartedAt = now;
                candidateLastActiveAt = now;
                onActivity('speech_candidate', { rms });
            }

            candidateFrameCount += 1;
            candidateChunks.push(input);
            candidateRmsSum += rms;
            candidatePeakRms = Math.max(candidatePeakRms, rms);
            if (isActiveFrame) {
                activeFrameCount += 1;
                candidateLastActiveAt = now;
            }

            const candidateAgeMs = now - candidateStartedAt;
            const activeRatio = activeFrameCount / Math.max(candidateFrameCount, 1);
            const averageRms = candidateRmsSum / Math.max(candidateFrameCount, 1);
            const hasStableSpeech = activeRatio >= BARGE_IN_MIN_ACTIVE_RATIO
                && averageRms >= BARGE_IN_MIN_AVG_RMS
                && candidatePeakRms >= BARGE_IN_MIN_PEAK_RMS;

            if (candidateAgeMs >= BARGE_IN_CONFIRM_MS && hasStableSpeech) {
                confirmed = true;
                confirmedInitialAudio = {
                    chunks: candidateChunks,
                    speechSampleCount: activeFrameCount * input.length,
                    maxRms: candidatePeakRms,
                    sampleRate: audioContext.sampleRate,
                };
                onActivity('speech_start', {
                    rms,
                    initialAudio: confirmedInitialAudio,
                });
            }
            if (
                !isActiveFrame
                && candidateLastActiveAt !== null
                && now - candidateLastActiveAt >= BARGE_IN_RELEASE_MS
            ) {
                resetCandidate();
                onActivity('speech_end', { rms });
            }
            return;
        }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return {
        stop: async () => {
            processor.disconnect();
            source.disconnect();
            stream.getTracks().forEach((track) => track.stop());
            await audioContext.close().catch(() => undefined);
        },
    };
};

const pickRandomGreeting = (greetings: string[], previousGreeting: string | null) => {
    const choices = greetings.filter((greeting) => greeting !== previousGreeting);
    return choices[Math.floor(Math.random() * choices.length)] ?? greetings[0];
};

const VoiceCallController: React.FC = () => {
    const { state, dispatch, sendMessage, handleAIResponse, interruptAssistantTurn } = useChatbot();
    const stateRef = useRef(state);
    const sendMessageRef = useRef(sendMessage);
    const isFinishingRef = useRef(false);
    const introPlayedRef = useRef(false);
    const isGreetingInProgressRef = useRef(false);
    const previousGreetingRef = useRef<string | null>(null);
    const bargeInMonitorRef = useRef<BargeInMonitor | null>(null);
    const pendingBargeInAudioRef = useRef<VoiceInitialAudio | null>(null);
    const isStartingBargeInRef = useRef(false);
    const lastBargeInAtRef = useRef(0);

    useEffect(() => {
        stateRef.current = state;
        sendMessageRef.current = sendMessage;
    }, [state, sendMessage]);

    const stopBargeInMonitor = useCallback(async () => {
        const monitor = bargeInMonitorRef.current;
        pendingBargeInAudioRef.current = null;
        if (!monitor) return;
        bargeInMonitorRef.current = null;
        await monitor.stop();
    }, []);

    // ── Lời chào khi bắt đầu cuộc gọi + warm-up mic song song ──────────────
    useEffect(() => {
        if (!state.isCallMode) {
            // Reset để lần sau phát lại
            introPlayedRef.current = false;
            isGreetingInProgressRef.current = false;
            return;
        }
        if (introPlayedRef.current) return;
        introPlayedRef.current = true;
        isGreetingInProgressRef.current = true;

        const greetings = state.messages.length === 0 ? INTRO_GREETINGS : SUBSEQUENT_GREETINGS;
        const greeting = pickRandomGreeting(greetings, previousGreetingRef.current);
        previousGreetingRef.current = greeting;

        // Lời chào khi bắt đầu cuộc gọi

        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'speaking', text: greeting },
        });
        void ttsService.speak(greeting, (isPlaying) => {
            if (!isPlaying) {
                isGreetingInProgressRef.current = false;
            }
            dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: {
                    status: isPlaying ? 'speaking' : 'listening',
                    text: isPlaying ? greeting : 'Đang lắng nghe...',
                },
            });
        });
    }, [state.isCallMode, dispatch, state.messages.length]);

    useEffect(() => {
        if (!state.isCallMode || !state.isLoading || state.requiresUserAction) return;

        let phraseIndex = 0;
        let cancelled = false;
        let pendingTimer: ReturnType<typeof window.setTimeout> | null = null;

        const announceNext = () => {
            if (
                cancelled
                || !stateRef.current.isCallMode
                || !stateRef.current.isLoading
                || stateRef.current.requiresUserAction
            ) {
                return;
            }

            const phrase = THINKING_ANNOUNCEMENTS[phraseIndex % THINKING_ANNOUNCEMENTS.length];
            phraseIndex += 1;
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'thinking', text: phrase },
            });
            void ttsService.speak(phrase, (isPlaying) => {
                dispatch({ type: 'SET_SPEAKING', payload: isPlaying });
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: {
                        status: 'thinking',
                        text: isPlaying ? phrase : 'Trợ lý đang suy nghĩ...',
                    },
                });
                // Khi TTS vừa kết thúc (isPlaying chuyển false), lên lịch câu tiếp sau 4 giây
                if (!isPlaying && !cancelled) {
                    pendingTimer = window.setTimeout(announceNext, 4000);
                }
            });
        };

        // Bắt đầu câu đầu tiên sau 600ms
        pendingTimer = window.setTimeout(announceNext, 600);
        return () => {
            cancelled = true;
            if (pendingTimer !== null) window.clearTimeout(pendingTimer);
        };
    }, [dispatch, state.isCallMode, state.isLoading, state.requiresUserAction]);

    const finishVoiceUtterance = useCallback(async () => {
        if (!stateRef.current.isCallMode || !stateRef.current.isListening || isFinishingRef.current) return;
        isFinishingRef.current = true;
        let shouldClearLoading = true;

        try {
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'transcribing', text: 'Đang gửi giọng nói lên VNPT SmartVoice...' },
            });

            const transcript = (await sttService.stopListening()).trim();
            if (!stateRef.current.isCallMode) return;

            if (transcript) {
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: { status: 'thinking', text: 'Trợ lý đang suy nghĩ...' },
                });
                shouldClearLoading = false;
                await sendMessageRef.current(transcript);
            } else {
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: { status: 'listening', text: 'Không nghe thấy câu nói rõ ràng. Tôi đang lắng nghe lại...' },
                });
            }
        } catch (error) {
            const isConnectivityIssue = isLikelyConnectivityError(error);
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: {
                    status: 'error',
                    text: isConnectivityIssue ? CONNECTIVITY_FALLBACK_MESSAGE : 'Không thể nhận dạng giọng nói.',
                },
            });
            console.warn('[VoiceCallController] STT failed:', error);
            dispatch({ type: 'OPEN' });
            if (isConnectivityIssue) {
                notifyConnectivityFallback({ playAudio: true });
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `msg_${Date.now()}`,
                        role: 'bot',
                        type: 'text',
                        content: CONNECTIVITY_FALLBACK_MESSAGE,
                        timestamp: new Date(),
                        suggestions: ['Kiểm tra Wi-Fi', 'Thử lại sau'],
                    },
                });
            } else {
                handleAIResponse({
                    intent: 'CHAT',
                    message: error instanceof Error
                        ? `Không thể nhận dạng giọng nói: ${error.message}`
                        : 'Không thể nhận dạng giọng nói. Vui lòng thử lại.',
                    suggestions: ['Thử lại', 'Nhập bằng bàn phím'],
                });
            }
        } finally {
            isFinishingRef.current = false;
            // SET_LISTENING: false was already dispatched at the top of the try block, so no need to do it here
            if (shouldClearLoading) {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        }
    }, [dispatch, handleAIResponse]);

    const startVoiceListening = useCallback(async (options: { force?: boolean } = {}) => {
        if (
            !stateRef.current.isCallMode
            || stateRef.current.isListening
            || (!options.force && stateRef.current.isLoading)
            || (!options.force && stateRef.current.isSpeaking)
            || stateRef.current.requiresUserAction
            || (!options.force && isFinishingRef.current)
        ) {
            return;
        }

        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'connecting', text: 'Đang kết nối microphone và VNPT SmartVoice...' },
        });
        dispatch({ type: 'SET_LISTENING', payload: true });

        try {
            const initialAudio = pendingBargeInAudioRef.current;
            await sttService.startListening(() => undefined, {
                onSilence: finishVoiceUtterance,
                ...(options.force && initialAudio ? { initialAudio } : {}),
            });
            if (options.force) {
                pendingBargeInAudioRef.current = null;
                await stopBargeInMonitor();
            }
            if (!stateRef.current.isCallMode) {
                dispatch({ type: 'SET_LISTENING', payload: false });
                await sttService.cancelListening().catch(() => undefined);
                return;
            }

            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'listening', text: 'Đang lắng nghe...' },
            });
        } catch (error) {
            pendingBargeInAudioRef.current = null;
            await stopBargeInMonitor();
            dispatch({ type: 'SET_LISTENING', payload: false });
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({
                type: 'SET_CALL_STATUS',
                payload: { status: 'error', text: 'Không thể bật microphone.' },
            });
            console.warn('[VoiceCallController] Voice input unavailable:', error);
            dispatch({ type: 'OPEN' });
            handleAIResponse({
                intent: 'CHAT',
                message: error instanceof Error
                    ? `Không thể bật microphone: ${error.message}`
                    : 'Không thể bật microphone. Vui lòng kiểm tra quyền truy cập.',
                suggestions: ['Thử lại', 'Nhập bằng bàn phím'],
            });
        }
    }, [dispatch, finishVoiceUtterance, handleAIResponse, stopBargeInMonitor]);

    const handleBargeInSpeechStart = useCallback((initialAudio?: VoiceInitialAudio) => {
        if (isGreetingInProgressRef.current) {
            pendingBargeInAudioRef.current = null;
            console.info('[Voice] speech detected during greeting; barge-in ignored.');
            return;
        }

        const now = performance.now();
        if (now - lastBargeInAtRef.current < BARGE_IN_COOLDOWN_MS) return;
        lastBargeInAtRef.current = now;

        pendingBargeInAudioRef.current = initialAudio ?? null;
        console.info('[Voice] speech confirmed: interrupting active assistant turn.');
        interruptAssistantTurn();
        dispatch({ type: 'SET_LISTENING', payload: false });

        window.setTimeout(() => {
            void startVoiceListening({ force: true });
        }, 80);
    }, [dispatch, interruptAssistantTurn, startVoiceListening]);

    useEffect(() => {
        const shouldMonitorBargeIn = state.isCallMode
            && !isGreetingInProgressRef.current
            && !state.requiresUserAction
            && !state.isListening
            && (state.isSpeaking || state.isLoading || state.callStatus === 'thinking' || state.callStatus === 'speaking');

        if (!shouldMonitorBargeIn) {
            if (pendingBargeInAudioRef.current) return;
            void stopBargeInMonitor();
            isStartingBargeInRef.current = false;
            return;
        }

        if (bargeInMonitorRef.current || isStartingBargeInRef.current) return;
        isStartingBargeInRef.current = true;

        void startBargeInMonitor((event, details) => {
            if (event === 'speech_candidate') {
                console.info('[Voice] speech candidate detected.', { rms: Number(details.rms.toFixed(4)) });
                return;
            }

            if (event === 'speech_end') {
                console.info('[Voice] speech candidate released.', { rms: Number(details.rms.toFixed(4)) });
                return;
            }

            handleBargeInSpeechStart(details.initialAudio);
        })
            .then((monitor) => {
                isStartingBargeInRef.current = false;
                if (!stateRef.current.isCallMode || stateRef.current.isListening || stateRef.current.requiresUserAction) {
                    void monitor.stop();
                    return;
                }
                bargeInMonitorRef.current = monitor;
            })
            .catch((error) => {
                isStartingBargeInRef.current = false;
                console.warn('[Voice] Barge-in monitor unavailable:', error);
            });

        return () => {
            isStartingBargeInRef.current = false;
        };
    }, [
        handleBargeInSpeechStart,
        state.callStatus,
        state.isCallMode,
        state.isListening,
        state.isLoading,
        state.isSpeaking,
        state.requiresUserAction,
        stopBargeInMonitor,
    ]);

    useEffect(() => {
        if (!state.isCallMode) {
            void stopBargeInMonitor();
            // Khi vào confirmation mode (navigate/fill), speakConfirmation đang đọc tin nhắn.
            // Không stop TTS nếu đang chờ xác nhận.
            if (!state.requiresUserAction) {
                ttsService.stop();
            }
            dispatch({ type: 'SET_LISTENING', payload: false });
            void sttService.cancelListening().catch(() => undefined);
            return;
        }

        if (state.isListening || state.isLoading || state.isSpeaking || state.requiresUserAction) return;
        // Nếu intro đã phát xong thì nghe ngay, không delay nhiều
        const delay = introPlayedRef.current ? 150 : 800;
        const timer = window.setTimeout(() => {
            void startVoiceListening();
        }, delay);
        return () => window.clearTimeout(timer);
    }, [
        state.isCallMode,
        state.isListening,
        state.isLoading,
        state.isSpeaking,
        state.requiresUserAction,
        dispatch,
        startVoiceListening,
        stopBargeInMonitor,
    ]);

    return null;
};

const ChatbotWidget: React.FC = () => {
    const { state, dispatch, sendMessage, cancelAssistantResponse, openChatbot } = useChatbot();
    const [isExiting, setIsExiting] = useState(false);
    const desktopPanelRef = useRef<HTMLElement | null>(null);

    const handleClose = useCallback(() => {
        if (state.requiresUserAction && state.confirmationSource === 'voice') return;
        setIsExiting(true);
        window.setTimeout(() => {
            dispatch({ type: 'CLOSE' });
            setIsExiting(false);
        }, 180);
    }, [dispatch, state.confirmationSource, state.requiresUserAction]);

    const handleOpen = () => {
        openChatbot();
    };

    const handleClear = () => {
        dispatch({ type: 'CLEAR_MESSAGES' });
        void smartbotService.clearHistory();
        window.setTimeout(() => {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `msg_${Date.now()}`,
                    role: 'bot',
                    type: 'text',
                    content: 'Đã xoá lịch sử chat. Tôi có thể giúp gì cho bạn?',
                    timestamp: new Date(),
                    suggestions: ['Đăng ký khai sinh', 'Liên thông khai sinh', 'Cần chuẩn bị gì?'],
                },
            });
        }, 100);
    };

    const isTextInputProcessing = state.isLoading && !state.isCallMode;
    const isTextInputDisabled = state.requiresUserAction && state.confirmationSource === 'voice';

    useEffect(() => {
        if (!state.isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && window.innerWidth >= 768) {
                handleClose();
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (window.innerWidth < 768) return;
            const target = event.target as Node | null;
            if (!target || desktopPanelRef.current?.contains(target)) return;
            handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [handleClose, state.isOpen]);

    const wasLoadingRef = useRef(state.isLoading);
    useEffect(() => {
        // Nếu vừa chuyển từ isLoading = true -> false (đã trả lời xong)
        // và chatbot đang đóng, và không phải đang dùng giọng nói -> tự động mở lên
        if (wasLoadingRef.current && !state.isLoading && !state.isOpen && !state.isCallMode) {
            openChatbot();
        }
        wasLoadingRef.current = state.isLoading;
    }, [state.isLoading, state.isOpen, state.isCallMode, openChatbot]);

    return (
        <>
            <VoiceCallController />

            {!state.isOpen && !state.isCallMode && (
                <div className="desktop-chat-bar" aria-label="Thanh chat Trợ lý AI Dịch Vụ Công">
                    <div className="desktop-chat-bar-brand">
                        <img src="/logo_Gov_Bridge.jpg" alt="" />
                        <Bot size={16} />
                    </div>
                    <ChatInput
                        variant="bar"
                        onSend={sendMessage}
                        disabled={isTextInputDisabled}
                        isProcessing={isTextInputProcessing}
                        onCancel={cancelAssistantResponse}
                        onFocusInput={handleOpen}
                        onBeforeSend={handleOpen}
                    />
                </div>
            )}

            {state.isOpen && (
                <>
                    <div
                        className={`chatbot-soft-backdrop${state.requiresUserAction && state.confirmationSource === 'voice' ? ' chatbot-soft-backdrop--confirmation' : ''}`}
                        aria-hidden="true"
                    />
                    <div className={`chatbot-desktop-overlay ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}>
                        <section
                            ref={desktopPanelRef}
                            className={`chatbot-overlay-panel${state.requiresUserAction && state.confirmationSource === 'voice' ? ' chatbot-overlay-panel--confirmation' : ''}`}
                            role="dialog"
                            aria-label="Trợ lý AI Dịch Vụ Công"
                            aria-modal="true"
                        >
                            <div className="chatbot-panel-controls" aria-label="Điều khiển chatbot">
                                <button
                                    className="chatbot-panel-control chatbot-panel-control--center"
                                    type="button"
                                    onClick={handleClose}
                                    title={state.requiresUserAction && state.confirmationSource === 'voice' ? 'Vui lòng hoàn tất xác nhận' : 'Thu nhỏ'}
                                    aria-label={state.requiresUserAction && state.confirmationSource === 'voice' ? 'Đang chờ xác nhận, chưa thể thu nhỏ' : 'Thu nhỏ chatbot'}
                                    disabled={state.requiresUserAction && state.confirmationSource === 'voice'}
                                >
                                    <ChevronDown size={18} />
                                </button>
                            </div>
                            {state.messages.length === 0 ? (
                                <WelcomeState />
                            ) : (
                                <ChatWindow messages={state.messages} isLoading={state.isLoading} />
                            )}
                            <ChatInput
                                variant="panel"
                                autoFocus
                                onSend={sendMessage}
                                disabled={isTextInputDisabled}
                                isProcessing={isTextInputProcessing}
                                onCancel={cancelAssistantResponse}
                            />
                        </section>
                    </div>
                </>
            )}

            {state.isOpen && (
                <div
                    className={`chatbot-widget ${isExiting ? 'chatbot-exit' : 'chatbot-enter'}`}
                    role="dialog"
                    aria-label="Trợ lý AI Dịch Vụ Công"
                    aria-modal="false"
                    id="chatbot-widget"
                >
                    <ChatHeader
                        title="Trợ lý AI DVC"
                        subtitle={smartbotService.getBackendInfo()}
                        onClear={handleClear}
                        onClose={handleClose}
                    />
                    {!state.isMinimized && (
                        <>
                            <ChatWindow messages={state.messages} isLoading={state.isLoading} />
                            <ChatInput
                                onSend={sendMessage}
                                disabled={isTextInputDisabled}
                                isProcessing={isTextInputProcessing}
                                onCancel={cancelAssistantResponse}
                            />
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export const ChatbotFAB: React.FC = () => {
    const { state, dispatch, resumeRealtimeWithVoice, cancelNavigation } = useChatbot();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const callStatusLabel = getCallStatusLabel(state.callStatus, state.callStatusText);
    const isRealtime = state.conversationState === 'REALTIME';
    const isInputRailVisible = !state.isOpen && !state.isCallMode;

    const handleCallToggle = () => {
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

        if (isOffline && !isRealtime && !state.isListening) {
            notifyConnectivityFallback({ playAudio: true });
            return;
        }

        if (state.requiresUserAction) {
            if (state.pendingNavigation) {
                cancelNavigation();
            } else {
                dispatch({ type: 'SET_REQUIRES_USER_ACTION', payload: { action: false } });
                resumeRealtimeWithVoice('Hủy');
            }
            if (!isRealtime) {
                dispatch({ type: 'SET_CALL_MODE', payload: true });
                dispatch({
                    type: 'SET_CALL_STATUS',
                    payload: { status: 'connecting', text: 'Đang bắt đầu trò chuyện realtime...' },
                });
            }
            return;
        }

        if (isRealtime || state.isListening) {
            dispatch({ type: 'SET_CALL_MODE', payload: false });
            dispatch({ type: 'SET_CALL_STATUS', payload: { status: 'idle', text: null } });
            return;
        }

        if (!user) {
            setShowAuthModal(true);
            return;
        }

        void preloadConnectivityFallbackAudio();
        dispatch({ type: 'CLOSE' });
        
        dispatch({ type: 'SET_CALL_MODE', payload: true });
        dispatch({
            type: 'SET_CALL_STATUS',
            payload: { status: 'connecting', text: 'Đang bắt đầu trò chuyện realtime...' },
        });
    };

    const buttonLabel = isRealtime
        ? 'Tắt trò chuyện realtime bằng giọng nói'
        : 'Bắt đầu trò chuyện realtime bằng giọng nói';

    return (
        <>
            <div
                className={[
                    'realtime-voice-control',
                    isRealtime ? 'realtime-voice-control--active' : '',
                    isInputRailVisible ? 'realtime-voice-control--input-rail-visible' : '',
                    `realtime-voice-control--${state.callStatus}`,
                ].filter(Boolean).join(' ')}
                data-conversation-state={state.conversationState}
            >
                {isRealtime && (
                    <div className="realtime-voice-rings" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                )}

                <button
                    className="realtime-voice-button"
                    type="button"
                    id="realtime-voice-button"
                    onClick={handleCallToggle}
                    aria-label={buttonLabel}
                    aria-pressed={isRealtime}
                    aria-describedby="realtime-voice-status"
                    title={buttonLabel}
                >
                    <span className="realtime-voice-icon" aria-hidden="true">
                        {isRealtime ? <MicOff size={30} /> : <Mic size={26} />}
                    </span>
                    {isRealtime && (
                        <span className="realtime-voice-equalizer" aria-hidden="true">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <span key={index} style={{ animationDelay: `${index * 90}ms` }} />
                            ))}
                        </span>
                    )}
                </button>

                <div
                    className="realtime-voice-status"
                    id="realtime-voice-status"
                    role="status"
                    aria-live="polite"
                >
                    {isRealtime ? callStatusLabel : 'Gọi AI realtime'}
                </div>
            </div>

            {showAuthModal && (
                <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
                    <div
                        className="auth-modal-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-modal-title"
                    >
                        <div className="auth-modal-header">
                            <div className="auth-modal-icon">
                                <Mic size={24} />
                            </div>
                            <div>
                                <h3 id="auth-modal-title" className="auth-modal-title">
                                    Yêu cầu đăng nhập
                                </h3>
                                <p className="auth-modal-desc">
                                    Vui lòng đăng nhập để tiếp tục sử dụng tính năng gọi giọng nói realtime với Trợ lý AI.
                                </p>
                            </div>
                        </div>

                        <div className="auth-modal-actions">
                            <button
                                type="button"
                                onClick={() => setShowAuthModal(false)}
                                className="auth-modal-btn auth-modal-btn--cancel"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAuthModal(false);
                                    navigate('/dang-nhap', { state: { from: location.pathname } });
                                }}
                                className="auth-modal-btn auth-modal-btn--primary"
                            >
                                Đăng nhập
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotWidget;
