export const CONNECTIVITY_FALLBACK_MESSAGE =
    'Hiện GovBridge chưa kết nối được tới máy chủ. Có thể mạng hoặc Wi-Fi đang gián đoạn. Bạn vui lòng kiểm tra kết nối rồi thử lại sau.';

export const CONNECTIVITY_FALLBACK_AUDIO_URL = '/audio/network-fallback.wav';

export interface ConnectivityFallbackNotice {
    id: string;
    title: string;
    message: string;
    actionLabel: string;
}

interface NotifyConnectivityFallbackOptions {
    title?: string;
    message?: string;
    actionLabel?: string;
    playAudio?: boolean;
}

type ConnectivityFallbackListener = (notice: ConnectivityFallbackNotice) => void;

const listeners = new Set<ConnectivityFallbackListener>();
let pendingNotice: ConnectivityFallbackNotice | null = null;
let lastNoticeAt = 0;
let activeFallbackAudio: HTMLAudioElement | null = null;
let cachedFallbackAudioUrl: string | null = null;
let preloadFallbackAudioPromise: Promise<string | null> | null = null;
let fallbackSuppressedUntil = 0;

export const suppressConnectivityFallback = (durationMs = 2_000) => {
    fallbackSuppressedUntil = Math.max(fallbackSuppressedUntil, Date.now() + durationMs);
};

const isConnectivityFallbackSuppressed = () => Date.now() < fallbackSuppressedUntil;

export const subscribeConnectivityFallback = (listener: ConnectivityFallbackListener) => {
    listeners.add(listener);
    if (pendingNotice) {
        listener(pendingNotice);
        pendingNotice = null;
    }
    return () => {
        listeners.delete(listener);
    };
};

export const isLikelyConnectivityError = (error: unknown): boolean => {
    if (isConnectivityFallbackSuppressed()) return false;
    if (!(error instanceof Error)) return false;

    const normalized = `${error.name} ${error.message}`.toLowerCase();
    if (
        error.name === 'AbortError'
        || normalized.includes('aborterror')
        || normalized.includes('user aborted')
        || normalized.includes('signal is aborted')
    ) {
        return false;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

    return [
        'failed to fetch',
        'networkerror',
        'network request failed',
        'load failed',
        'connection',
        'timeout',
    ].some((pattern) => normalized.includes(pattern));
};

export const preloadConnectivityFallbackAudio = (): Promise<string | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (cachedFallbackAudioUrl) return Promise.resolve(cachedFallbackAudioUrl);
    if (preloadFallbackAudioPromise) return preloadFallbackAudioPromise;

    preloadFallbackAudioPromise = fetch(CONNECTIVITY_FALLBACK_AUDIO_URL, { cache: 'force-cache' })
        .then((response) => {
            if (!response.ok) throw new Error('Cannot preload connectivity fallback audio.');
            return response.blob();
        })
        .then((blob) => {
            cachedFallbackAudioUrl = URL.createObjectURL(blob);
            return cachedFallbackAudioUrl;
        })
        .catch(() => null)
        .finally(() => {
            preloadFallbackAudioPromise = null;
        });

    return preloadFallbackAudioPromise;
};

export const playConnectivityFallbackAudio = async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    activeFallbackAudio?.pause();
    window.speechSynthesis.cancel();
    const audioUrl = cachedFallbackAudioUrl ?? await preloadConnectivityFallbackAudio();
    if (!audioUrl) return;

    activeFallbackAudio = new Audio(audioUrl);
    activeFallbackAudio.preload = 'auto';

    try {
        await activeFallbackAudio.play();
    } catch (error) {
        console.warn('[ConnectivityFallback] Cannot play cached fallback audio.', error);
    }
};

export const notifyConnectivityFallback = (options: NotifyConnectivityFallbackOptions = {}) => {
    if (typeof window === 'undefined') return;
    if (isConnectivityFallbackSuppressed()) return;

    const now = Date.now();
    if (now - lastNoticeAt < 1_500) {
        if (options.playAudio) void playConnectivityFallbackAudio();
        return;
    }
    lastNoticeAt = now;

    const notice: ConnectivityFallbackNotice = {
        id: `connectivity-${now}`,
        title: options.title ?? 'Kết nối đang gián đoạn',
        message: options.message ?? CONNECTIVITY_FALLBACK_MESSAGE,
        actionLabel: options.actionLabel ?? 'Đã hiểu',
    };

    if (listeners.size === 0) {
        pendingNotice = notice;
    } else {
        listeners.forEach((listener) => listener(notice));
    }

    if (options.playAudio) void playConnectivityFallbackAudio();
};
