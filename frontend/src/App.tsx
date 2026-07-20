import React, { Suspense, lazy, useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ChatbotProvider } from './contexts/ChatbotContext';
import { FormProvider, useForm } from './contexts/FormContext';
import { AuthProvider } from './contexts/AuthContext';
import ChatbotWidget, { ChatbotFAB } from './components/chatbot/ChatbotWidget';
import UIHighlighter from './components/overlay/UIHighlighter';
import Header from './components/layout/Header';
import RequireRole from './components/auth/RequireRole';
import RequireAuth from './components/auth/RequireAuth';
import SplashScreen from './components/layout/SplashScreen';
import { ExternalProcessingNoticeHost } from './components/common/ExternalProcessingNoticeHost';
import { ConnectivityFallbackHost } from './components/common/ConnectivityFallbackHost';
import './index.css';

// Lazy-load pages
const HomePage = lazy(() => import('./components/pages/HomePage'));
const KhaiSinhPage = lazy(() => import('./components/pages/KhaiSinhPage'));
const DangKyThuongTruPage = lazy(() => import('./components/pages/DangKyThuongTruPage'));
const DangKyTamTruPage = lazy(() => import('./components/pages/DangKyTamTruPage'));
const CCCDPage = lazy(() => import('./components/pages/CCCDPage'));
const KetHonPage = lazy(() => import('./components/pages/KetHonPage'));
const LienThongKhaiSinhPage = lazy(() => import('./components/pages/LienThongKhaiSinhPage'));
const LienThongKhaiTuPage = lazy(() => import('./components/pages/LienThongKhaiTuPage'));
const XacNhanCuTruPage = lazy(() => import('./components/pages/XacNhanCuTruPage'));
const LoginPage = lazy(() => import('./components/pages/LoginPage'));
const CitizenDashboardPage = lazy(() => import('./components/pages/CitizenDashboardPage'));
const OfficerDashboardPage = lazy(() => import('./components/pages/OfficerDashboardPage'));

// Loading fallback
const PageLoader = () => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            flexDirection: 'column',
            gap: 16,
            color: 'var(--text-secondary)',
        }}
    >
        <div
            style={{
                width: 40,
                height: 40,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }}
        />
        <span style={{ fontSize: '0.875rem' }}>Đang tải...</span>
    </div>
);

// ============================================================
// Inner App (needs router context)
// ============================================================
const AppInner: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { fillFields, formState, pageContext } = useForm();
    const isAuthenticationPage = location.pathname === '/dang-nhap';
    const isOfficerPage = location.pathname === '/can-bo';

    const handleNavigate = (route: string) => {
        navigate(route);
    };

    const handleFillForm = (fields: Record<string, string>) => {
        fillFields(fields);
    };

    return (
        <ChatbotProvider
            onNavigate={handleNavigate}
            onFillForm={handleFillForm}
            currentRoute={location.pathname}
            formValues={formState.values}
            pageContext={pageContext}
        >
            {!isAuthenticationPage && (
                <>
                    <UIHighlighter />
                    {!isOfficerPage && (
                        <>
                            <ChatbotFAB />
                            <ChatbotWidget />
                        </>
                    )}
                    <Header />
                    <ExternalProcessingNoticeHost />
                    <ConnectivityFallbackHost />
                </>
            )}

            <main>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/dang-nhap" element={<LoginPage />} />

                        {/* ── Trang thủ tục: yêu cầu đăng nhập ── */}
                        <Route path="/khai-sinh" element={<RequireAuth><KhaiSinhPage /></RequireAuth>} />
                        <Route path="/ho-khau" element={<RequireAuth><DangKyThuongTruPage /></RequireAuth>} />
                        <Route path="/dang-ky-thuong-tru" element={<RequireAuth><DangKyThuongTruPage /></RequireAuth>} />
                        <Route path="/tam-tru" element={<RequireAuth><DangKyTamTruPage /></RequireAuth>} />
                        <Route path="/dang-ky-tam-tru" element={<RequireAuth><DangKyTamTruPage /></RequireAuth>} />
                        <Route path="/cccd" element={<RequireAuth><CCCDPage /></RequireAuth>} />
                        <Route path="/ket-hon" element={<RequireAuth><KetHonPage /></RequireAuth>} />
                        <Route path="/lien-thong-khai-sinh" element={<RequireAuth><LienThongKhaiSinhPage /></RequireAuth>} />
                        <Route path="/lien-thong-khai-sinh/:stepSlug" element={<RequireAuth><LienThongKhaiSinhPage /></RequireAuth>} />
                        <Route path="/lien-thong-khai-tu" element={<RequireAuth><LienThongKhaiTuPage /></RequireAuth>} />
                        <Route path="/xac-nhan-cu-tru" element={<RequireAuth><XacNhanCuTruPage /></RequireAuth>} />

                        {/* ── Dashboard: yêu cầu đúng role ── */}
                        <Route
                            path="/nguoi-dan"
                            element={<RequireRole role="nguoi-dan"><CitizenDashboardPage /></RequireRole>}
                        />
                        <Route
                            path="/can-bo"
                            element={<RequireRole role="can-bo"><OfficerDashboardPage /></RequireRole>}
                        />
                        {/* Fallback */}
                        <Route path="*" element={<HomePage />} />
                    </Routes>
                </Suspense>
            </main>
        </ChatbotProvider>
    );
};

// ============================================================
// Root App
// ============================================================
const App: React.FC = () => {
    const [splashDone, setSplashDone] = useState(false);

    return (
        <>
            {!splashDone && <SplashScreen onContinue={() => setSplashDone(true)} />}
            <Router>
                <AuthProvider>
                    <FormProvider>
                        <AppInner />
                    </FormProvider>
                </AuthProvider>
            </Router>
        </>
    );
};

export default App;
