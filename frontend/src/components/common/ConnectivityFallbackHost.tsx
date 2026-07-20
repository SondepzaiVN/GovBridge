import React from 'react';
import { WifiOff, X } from 'lucide-react';
import {
    notifyConnectivityFallback,
    preloadConnectivityFallbackAudio,
    subscribeConnectivityFallback,
    type ConnectivityFallbackNotice,
} from '../../utils/connectivityFallback';
import { useChatbot } from '../../contexts/ChatbotContext';

export const ConnectivityFallbackHost: React.FC = () => {
    const [notice, setNotice] = React.useState<ConnectivityFallbackNotice | null>(null);
    const { state } = useChatbot();
    const isCallModeRef = React.useRef(state.isCallMode);

    React.useEffect(() => {
        isCallModeRef.current = state.isCallMode;
    }, [state.isCallMode]);

    React.useEffect(() => subscribeConnectivityFallback(setNotice), []);

    React.useEffect(() => {
        void preloadConnectivityFallbackAudio();
    }, []);

    React.useEffect(() => {
        const handleOffline = () => {
            notifyConnectivityFallback({
                title: 'Thiết bị đang mất kết nối',
                message: 'GovBridge phát hiện thiết bị đã mất mạng hoặc Wi-Fi. Bạn vui lòng kiểm tra kết nối rồi thử lại sau.',
                actionLabel: 'Đã hiểu',
                playAudio: isCallModeRef.current,
            });
        };

        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, []);

    if (!notice) return null;

    return (
        <div
            className="connectivity-fallback-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) setNotice(null);
            }}
        >
            <section
                className="connectivity-fallback-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="connectivity-fallback-title"
            >
                <button
                    type="button"
                    className="connectivity-fallback-close"
                    aria-label="Đóng thông báo"
                    onClick={() => setNotice(null)}
                >
                    <X size={18} />
                </button>
                <div className="connectivity-fallback-icon" aria-hidden="true">
                    <WifiOff size={28} />
                </div>
                <h2 id="connectivity-fallback-title">{notice.title}</h2>
                <p>{notice.message}</p>
                <div className="connectivity-fallback-actions">
                    <button type="button" onClick={() => setNotice(null)}>
                        {notice.actionLabel}
                    </button>
                </div>
            </section>
        </div>
    );
};
