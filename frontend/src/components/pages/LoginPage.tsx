import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    Eye,
    EyeOff,
    HelpCircle,
    LoaderCircle,
    LockKeyhole,
    UserRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../services/authService';

type LoginMethod = 'vneid' | 'dvc' | 'officer';
type FormErrors = Partial<Record<'agency' | 'username' | 'password' | 'credentials', string>>;

const getDashboardRoute = (role: UserRole) => role === 'can-bo' ? '/can-bo' : '/nguoi-dan';

const LoginPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const searchParams = new URLSearchParams(location.search);
    const methodParam = searchParams.get('method');
    const method: LoginMethod | null = methodParam === 'vneid' || methodParam === 'dvc' || methodParam === 'officer'
        ? methodParam
        : null;
    const role: UserRole = method === 'officer' || searchParams.get('role') === 'can-bo' ? 'can-bo' : 'nguoi-dan';
    const [agency, setAgency] = useState('Cần Thơ');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Lấy trang muốn vào trước khi bị redirect về đăng nhập
    const from = (location.state as { from?: string } | null)?.from;

    if (user) return <Navigate to={from ?? getDashboardRoute(user.role)} replace />;

    const openMethod = (nextMethod: LoginMethod) => {
        const nextRole = nextMethod === 'officer' ? 'can-bo' : 'nguoi-dan';
        setErrors({});
        setSuccessMessage('');
        navigate(`/dang-nhap?role=${nextRole}&method=${nextMethod}`);
    };

    const returnToChooser = () => {
        setErrors({});
        setSuccessMessage('');
        navigate('/dang-nhap', { replace: true });
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextErrors: FormErrors = {};
        if (role === 'can-bo' && !agency.trim()) nextErrors.agency = 'Vui lòng chọn đơn vị/cơ quan.';
        if (!username.trim()) nextErrors.username = 'Vui lòng nhập tài khoản.';
        if (!password) nextErrors.password = 'Vui lòng nhập mật khẩu.';

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setErrors({});
        setIsSubmitting(true);
        window.setTimeout(() => {
            const authenticated = login(role, username, password, agency);
            setIsSubmitting(false);
            if (!authenticated) {
                setErrors({ credentials: 'Tài khoản hoặc mật khẩu không đúng.' });
                return;
            }
            setSuccessMessage('Đăng nhập thành công. Đang chuyển hướng...');
            // Sau 600ms navigate về trang ban đầu hoặc dashboard
            window.setTimeout(() => {
                navigate(from ?? getDashboardRoute(role), { replace: true });
            }, 700);
        }, 650);
    };

    if (!method) {
        return (
            <div className="login-ref-chooser">
                <button type="button" className="login-ref-home" onClick={() => navigate('/')}>
                    <ArrowLeft size={17} /> Về trang chủ
                </button>

                <header className="login-ref-brand">
                    <img src="/quoc_huy.png" alt="Quốc huy Việt Nam" />
                    <img className="login-ref-brand-heading" src="/auth/dvc-heading.svg" alt="Cổng Dịch vụ công Quốc gia - Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi" />
                </header>

                <main className="login-ref-selector" aria-labelledby="login-selector-title">
                    <h1 id="login-selector-title">Đăng nhập</h1>
                    <div className="login-ref-account-groups">
                        <section className="login-ref-account-group" aria-labelledby="citizen-login-title">
                            <h2 id="citizen-login-title">Công dân</h2>
                            <div className="login-ref-methods two-methods">
                                <button type="button" className="login-ref-method" onClick={() => openMethod('vneid')}>
                                    <img src="/auth/logo-vneid.png" alt="VNeID" />
                                    <span>Tài khoản Định danh điện tử (VNeID)</span>
                                </button>
                                <button type="button" className="login-ref-method" onClick={() => openMethod('dvc')}>
                                    <img src="/quoc_huy.png" alt="Cổng Dịch vụ công Quốc gia" />
                                    <span>Tài khoản cấp bởi Cổng dịch vụ công quốc gia</span>
                                </button>
                            </div>
                        </section>

                        <section className={`login-ref-account-group${role === 'can-bo' ? ' preferred' : ''}`} aria-labelledby="officer-login-title">
                            <h2 id="officer-login-title">Cán bộ</h2>
                            <div className="login-ref-methods">
                                <button type="button" className="login-ref-method" onClick={() => openMethod('officer')}>
                                    <img src="/quoc_huy.png" alt="Tài khoản cán bộ" />
                                    <span>Tài khoản cán bộ, cơ quan xử lý hồ sơ</span>
                                </button>
                            </div>
                        </section>
                    </div>

                    <aside className="login-ref-notice">
                        <strong>Thông báo từ hệ thống:</strong>
                        <p>Khi đăng nhập, các thông tin cá nhân được đồng bộ từ tài khoản định danh sang hệ thống để phục vụ giải quyết thủ tục hành chính.</p>
                    </aside>
                </main>

                <footer className="login-ref-footer">
                    <span>Cơ quan chủ quản: Văn phòng Chính phủ</span>
                    <span>www.dichvucong.gov.vn</span>
                    <span>Tổng đài hỗ trợ: 18001096</span>
                    <span>Email: dichvucong@chinhphu.vn</span>
                </footer>
            </div>
        );
    }

    const isVneid = method === 'vneid';
    const formTitle = role === 'can-bo'
        ? 'Đăng nhập cán bộ'
        : isVneid ? 'Đăng nhập VNeID' : 'Đăng nhập tài khoản DVC';

    return (
        <div className="login-ref-auth-page">
            <button type="button" className="login-ref-back" onClick={returnToChooser}>
                <ArrowLeft size={18} /> Chọn phương thức khác
            </button>

            <div className="login-ref-vneid-brand">
                {isVneid ? (
                    <img src="/auth/logo-full-vneid.png" alt="Bộ Công an - Trung tâm dữ liệu Quốc gia về dân cư" />
                ) : (
                    <div className="login-ref-gov-brand">
                        <img src="/quoc_huy.png" alt="Quốc huy Việt Nam" />
                        <strong>{role === 'can-bo' ? 'Hệ thống cán bộ' : 'Cổng Dịch vụ công Quốc gia'}</strong>
                    </div>
                )}
            </div>

            <main className={`login-ref-auth-card${role === 'can-bo' ? ' officer' : ''}`}>
                <div className="login-ref-form-pane">
                    <h1>{formTitle}</h1>
                    <form onSubmit={handleSubmit} noValidate>
                        {role === 'can-bo' && (
                            <div className="login-ref-field-block">
                                <label htmlFor="login-ref-agency" className="sr-only">Đơn vị / Cơ quan</label>
                                <div className={`login-ref-input${errors.agency ? ' invalid' : ''}`}>
                                    <Building2 size={23} />
                                    <input id="login-ref-agency" value="Cần Thơ" readOnly disabled style={{ cursor: 'not-allowed', opacity: 0.85, fontWeight: 600 }} placeholder="Đơn vị / Cơ quan" />
                                </div>
                                {errors.agency && <p className="login-ref-error">{errors.agency}</p>}
                            </div>
                        )}

                        <div className="login-ref-field-block">
                            <label htmlFor="login-ref-username" className="sr-only">{isVneid ? 'Số định danh cá nhân' : 'Tài khoản đăng nhập'}</label>
                            <div className={`login-ref-input${errors.username ? ' invalid' : ''}`}>
                                <UserRound size={23} />
                                <input id="login-ref-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={isVneid ? 'Số định danh cá nhân' : role === 'can-bo' ? 'Mã cán bộ hoặc email công vụ' : 'Tên đăng nhập / CCCD / Email'} autoComplete="username" />
                            </div>
                            {errors.username && <p className="login-ref-error">{errors.username}</p>}
                        </div>

                        <div className="login-ref-field-block">
                            <label htmlFor="login-ref-password" className="sr-only">Mật khẩu</label>
                            <div className={`login-ref-input${errors.password ? ' invalid' : ''}`}>
                                <LockKeyhole size={23} />
                                <input id="login-ref-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" autoComplete="current-password" />
                                <button type="button" className="login-ref-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>
                            {errors.password && <p className="login-ref-error">{errors.password}</p>}
                        </div>

                        {errors.credentials && <div className="login-ref-message error" role="alert">{errors.credentials}</div>}
                        {successMessage && <div className="login-ref-message success" role="status"><BadgeCheck size={18} /> {successMessage}</div>}

                        <button type="submit" className="login-ref-submit" disabled={isSubmitting}>
                            {isSubmitting ? <><LoaderCircle className="auth-spinner" size={19} /> Đang đăng nhập...</> : 'Đăng nhập'}
                        </button>

                        <p className="login-ref-help">Trường hợp không đăng nhập được, vui lòng <button type="button">xem hướng dẫn</button></p>
                        <p className="login-ref-demo">Tài khoản thử nghiệm: <strong>{role === 'can-bo' ? 'officer' : 'citizen'}</strong> / <strong>123456</strong></p>
                    </form>
                </div>

                <aside className="login-ref-side-pane">
                    {isVneid ? (
                        <>
                            <div className="login-ref-qr" aria-label="Mã QR đăng nhập mô phỏng"><span>MÔ PHỎNG</span></div>
                            <p>Hoặc quét mã QR bằng ứng dụng VNeID để đăng nhập.</p>
                        </>
                    ) : (
                        <>
                            <img src="/quoc_huy.png" alt="Quốc huy Việt Nam" />
                            <p>{role === 'can-bo' ? 'Dành cho cán bộ tiếp nhận và xử lý hồ sơ hành chính.' : 'Xác thực bằng tài khoản Cổng Dịch vụ công Quốc gia.'}</p>
                        </>
                    )}
                </aside>
            </main>

            <button type="button" className="login-ref-guide" aria-label="Hướng dẫn đăng ký tài khoản"><HelpCircle size={30} /></button>
        </div>
    );
};

export default LoginPage;
