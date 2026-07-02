import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ChatbotProvider } from './contexts/ChatbotContext';
import { FormProvider, useForm } from './contexts/FormContext';
import ChatbotWidget, { ChatbotFAB } from './components/chatbot/ChatbotWidget';
import UIHighlighter from './components/overlay/UIHighlighter';
import Header from './components/layout/Header';
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
    const { fillFields, formState } = useForm();

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
        >
            {/* Global overlay & chatbot */}
            <UIHighlighter />
            <ChatbotFAB />
            <ChatbotWidget />

            {/* App shell */}
            <Header />

            <main>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/khai-sinh" element={<KhaiSinhPage />} />
                        <Route path="/ho-khau" element={<DangKyThuongTruPage />} />
                        <Route path="/dang-ky-thuong-tru" element={<DangKyThuongTruPage />} />
                        <Route path="/tam-tru" element={<DangKyTamTruPage />} />
                        <Route path="/dang-ky-tam-tru" element={<DangKyTamTruPage />} />
                        <Route path="/cccd" element={<CCCDPage />} />
                        <Route path="/ket-hon" element={<KetHonPage />} />
                        <Route path="/lien-thong-khai-sinh" element={<LienThongKhaiSinhPage />} />
                        <Route path="/lien-thong-khai-sinh/:stepSlug" element={<LienThongKhaiSinhPage />} />
                        <Route path="/lien-thong-khai-tu" element={<LienThongKhaiTuPage />} />
                        <Route path="/xac-nhan-cu-tru" element={<XacNhanCuTruPage />} />
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
    return (
        <Router>
            <FormProvider>
                <AppInner />
            </FormProvider>
        </Router>
    );
};

export default App;
