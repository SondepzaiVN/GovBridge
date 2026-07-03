import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../api/client';

// ─── Warm-up: fire-and-forget API pings while splash is shown ────────────────
const warmUpBackend = () => {
    void fetch(`${API_BASE_URL}/health`, { method: 'GET' }).catch(() => undefined);
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface SplashScreenProps {
    onContinue: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => setVisible(true), 60);
        warmUpBackend();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleContinue = () => {
        setExiting(true);
        timerRef.current = setTimeout(onContinue, 520);
    };

    return (
        <>
            <style>{`
                @keyframes splash-shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                @keyframes splash-float {
                    0%, 100% { transform: translateY(0px); }
                    50%       { transform: translateY(-6px); }
                }
                @keyframes splash-pulse-ring {
                    0%   { transform: scale(0.92); opacity: 0.55; }
                    70%  { transform: scale(1.1);  opacity: 0;    }
                    100% { transform: scale(0.92); opacity: 0;    }
                }
                @keyframes splash-fade-up {
                    from { opacity: 0; transform: translateY(22px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes splash-badge-in {
                    from { opacity: 0; transform: scale(0.85) translateY(8px); }
                    to   { opacity: 1; transform: scale(1)    translateY(0);   }
                }
                @keyframes splash-divider-grow {
                    from { width: 0; opacity: 0; }
                    to   { width: 56px; opacity: 1; }
                }

                /* ── Backdrop: trắng kem với orb cam/đỏ cực nhạt ── */
                .splash-root {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background:
                        radial-gradient(ellipse 70% 55% at 8%  5%,  rgba(200,68,26,0.12) 0%, transparent 60%),
                        radial-gradient(ellipse 55% 45% at 92% 92%, rgba(218,33,40,0.10) 0%, transparent 55%),
                        radial-gradient(ellipse 40% 35% at 75% 15%, rgba(232,119,34,0.07) 0%, transparent 50%),
                        #faf7f5;
                    opacity: 0;
                    transition: opacity 0.45s ease;
                    overflow: hidden;
                }
                .splash-root.splash-visible  { opacity: 1; }
                .splash-root.splash-exiting  {
                    opacity: 0;
                    transform: scale(1.02);
                    transition: opacity 0.5s ease, transform 0.5s ease;
                }

                /* Orb trang trí — mờ nhẹ */
                .splash-orb {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    filter: blur(90px);
                }
                .splash-orb-1 {
                    width: 500px; height: 500px;
                    background: radial-gradient(circle, rgba(200,68,26,0.16) 0%, transparent 70%);
                    top: -180px; left: -120px;
                }
                .splash-orb-2 {
                    width: 400px; height: 400px;
                    background: radial-gradient(circle, rgba(218,33,40,0.12) 0%, transparent 70%);
                    bottom: -130px; right: -90px;
                }
                .splash-orb-3 {
                    width: 280px; height: 280px;
                    background: radial-gradient(circle, rgba(232,119,34,0.10) 0%, transparent 70%);
                    top: 30%; right: 8%;
                }

                /* ── Card trắng tinh ── */
                .splash-card {
                    position: relative;
                    background: #ffffff;
                    border: 1px solid rgba(200,68,26,0.16);
                    border-radius: 24px;
                    padding: 56px 52px 48px;
                    max-width: 560px;
                    width: 100%;
                    text-align: center;
                    box-shadow:
                        0 2px 4px  rgba(200,68,26,0.06),
                        0 12px 40px rgba(200,68,26,0.11),
                        0 40px 80px rgba(0,0,0,0.06);
                }

                /* Thanh màu trên card */
                .splash-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 5px;
                    border-radius: 24px 24px 0 0;
                    background: linear-gradient(90deg, #da2128 0%, #c8441a 50%, #e87722 100%);
                }

                /* ── Logos ── */
                .splash-logos {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 22px;
                    margin-bottom: 34px;
                    animation: splash-fade-up 0.6s ease 0.1s both;
                }
                .splash-logo-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .splash-logo-ring {
                    position: absolute;
                    inset: -7px;
                    border-radius: 50%;
                    border: 2px solid rgba(200,68,26,0.38);
                    animation: splash-pulse-ring 2.4s ease-out infinite;
                }
                .splash-logo-main {
                    width: 76px;
                    height: 76px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 3px solid rgba(200,68,26,0.18);
                    box-shadow:
                        0 4px 14px rgba(200,68,26,0.18),
                        0 1px 3px rgba(0,0,0,0.07);
                    animation: splash-float 3.8s ease-in-out infinite;
                }
                .splash-logo-sep {
                    width: 1.5px;
                    height: 54px;
                    background: linear-gradient(to bottom, transparent, rgba(200,68,26,0.22), transparent);
                    flex-shrink: 0;
                }
                .splash-logo-hack {
                    height: 54px;
                    width: auto;
                    max-width: 164px;
                    object-fit: contain;
                    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12));
                    opacity: 0.95;
                }

                /* ── Divider ── */
                .splash-divider {
                    width: 56px;
                    height: 3px;
                    background: linear-gradient(90deg, #da2128, #c8441a, #e87722);
                    border-radius: 99px;
                    margin: 0 auto 26px;
                    animation: splash-divider-grow 0.7s ease 0.35s both;
                }

                /* ── Text ── */
                .splash-eyebrow {
                    font-size: 0.6875rem;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: #c8441a;
                    margin-bottom: 12px;
                    animation: splash-fade-up 0.6s ease 0.2s both;
                }
                .splash-title {
                    font-size: 1.625rem;
                    font-weight: 800;
                    line-height: 1.3;
                    color: #1a1a2e;
                    margin-bottom: 10px;
                    animation: splash-fade-up 0.6s ease 0.28s both;
                }
                .splash-subtitle {
                    font-size: 0.875rem;
                    color: #7a8baa;
                    margin-bottom: 28px;
                    animation: splash-fade-up 0.6s ease 0.34s both;
                }

                /* ── Notice badge ── */
                .splash-notice {
                    background: linear-gradient(135deg, #fff6f2 0%, #fff9f7 100%);
                    border: 1.5px solid rgba(200,68,26,0.22);
                    border-radius: 14px;
                    padding: 20px 24px;
                    margin-bottom: 34px;
                    text-align: left;
                    animation: splash-badge-in 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.42s both;
                    box-shadow:
                        0 2px 10px rgba(200,68,26,0.07),
                        0 0 0 1px rgba(200,68,26,0.04) inset;
                }
                .splash-notice-label {
                    font-size: 0.6875rem;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: #c8441a;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 7px;
                }
                .splash-notice-label::before {
                    content: '';
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #c8441a;
                    flex-shrink: 0;
                }
                .splash-notice-text {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #1a1a2e;
                    line-height: 1.6;
                }
                .splash-notice-detail {
                    font-size: 0.8125rem;
                    color: #7a8baa;
                    margin-top: 8px;
                    line-height: 1.55;
                }

                /* ── CTA: đỏ cam, chữ trắng ── */
                .splash-btn {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 15px 48px;
                    border: none;
                    border-radius: 9999px;
                    font-family: inherit;
                    font-size: 0.9375rem;
                    font-weight: 700;
                    cursor: pointer;
                    letter-spacing: 0.025em;
                    background: linear-gradient(135deg, #da2128 0%, #c8441a 55%, #e05520 100%);
                    background-size: 200% auto;
                    color: #ffffff;
                    box-shadow:
                        0 3px 6px  rgba(200,68,26,0.22),
                        0 8px 24px rgba(200,68,26,0.32),
                        0 1px 0   rgba(255,255,255,0.18) inset;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background-position 0.4s ease;
                    animation: splash-fade-up 0.6s ease 0.55s both;
                    overflow: hidden;
                }
                .splash-btn::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: linear-gradient(
                        135deg,
                        transparent 30%,
                        rgba(255,255,255,0.14) 50%,
                        transparent 70%
                    );
                    background-size: 200% auto;
                    animation: splash-shimmer 2.6s linear infinite;
                }
                .splash-btn:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow:
                        0 6px 10px  rgba(200,68,26,0.26),
                        0 18px 44px rgba(200,68,26,0.42),
                        0 1px 0    rgba(255,255,255,0.2) inset;
                    background-position: right center;
                }
                .splash-btn:active {
                    transform: translateY(0) scale(0.98);
                    box-shadow:
                        0 2px 6px rgba(200,68,26,0.2),
                        0 4px 12px rgba(200,68,26,0.25);
                }
                .splash-btn-arrow {
                    font-size: 1.1rem;
                    transition: transform 0.2s ease;
                }
                .splash-btn:hover .splash-btn-arrow {
                    transform: translateX(5px);
                }

                /* ── Footer ── */
                .splash-footer {
                    margin-top: 22px;
                    font-size: 0.75rem;
                    color: #b0bdd0;
                    animation: splash-fade-up 0.6s ease 0.65s both;
                }

                @media (max-width: 480px) {
                    .splash-card {
                        padding: 44px 28px 38px;
                        border-radius: 20px;
                    }
                    .splash-logo-main { width: 62px; height: 62px; }
                    .splash-title     { font-size: 1.375rem; }
                    .splash-btn       { padding: 14px 36px; }
                }
            `}</style>

            <div
                className={[
                    'splash-root',
                    visible  ? 'splash-visible'  : '',
                    exiting  ? 'splash-exiting'  : '',
                ].filter(Boolean).join(' ')}
                role="dialog"
                aria-modal="true"
                aria-label="Thông báo hệ thống demo"
            >
                {/* Orb trang trí */}
                <div className="splash-orb splash-orb-1" aria-hidden="true" />
                <div className="splash-orb splash-orb-2" aria-hidden="true" />
                <div className="splash-orb splash-orb-3" aria-hidden="true" />

                <div className="splash-card">
                    {/* Logos */}
                    <div className="splash-logos">
                        <div className="splash-logo-wrap">
                            <div className="splash-logo-ring" aria-hidden="true" />
                            <img
                                src="/logo_Gov_Bridge.jpg"
                                alt="Gov Bridge"
                                className="splash-logo-main"
                            />
                        </div>
                        <div className="splash-logo-sep" aria-hidden="true" />
                        <img
                            src="/logo-HackAIThon.png"
                            alt="Vietnamese Student HackAIthon 2026"
                            className="splash-logo-hack"
                        />
                    </div>

                    {/* Tiêu đề */}
                    <p className="splash-eyebrow">Cổng Dịch Vụ Công AI · GovBridge</p>
                    <h1 className="splash-title">Chào mừng bạn đến với<br />GovBridge AI</h1>
                    <p className="splash-subtitle">Trợ lý AI hỗ trợ thủ tục hành chính công</p>

                    <div className="splash-divider" aria-hidden="true" />

                    {/* Thông báo */}
                    <div className="splash-notice" role="note">
                        <p className="splash-notice-label">Lưu ý quan trọng</p>
                        <p className="splash-notice-text">
                            Hệ thống chỉ mang tính chất minh họa để demo MVP cuộc thi{' '}
                            <strong style={{ color: '#c8441a' }}>Vietnamese Student HackAIthon 2026</strong>.
                        </p>
                        <p className="splash-notice-detail">
                            Dữ liệu, biểu mẫu và kết quả xử lý không có giá trị pháp lý.
                            Vui lòng không sử dụng cho mục đích thực tế.
                        </p>
                    </div>

                    {/* CTA */}
                    <button
                        id="splash-continue-btn"
                        type="button"
                        className="splash-btn"
                        onClick={handleContinue}
                    >
                        Tôi đã hiểu, tiếp tục vào web
                        <span className="splash-btn-arrow" aria-hidden="true">→</span>
                    </button>

                    <p className="splash-footer">
                        © 2026 GovBridge · Vietnamese Student HackAIthon
                    </p>
                </div>
            </div>
        </>
    );
};

export default SplashScreen;
