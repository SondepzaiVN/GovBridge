import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    Eye,
    EyeOff,
    HelpCircle,
    LoaderCircle,
    LockKeyhole,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../services/authService';

type LoginMethod = 'vneid' | 'dvc' | 'officer' | 'register';
type FormErrors = Partial<Record<'agency' | 'username' | 'password' | 'fullName' | 'citizenId' | 'credentials', string>>;

const citizenNamePattern = /^[\p{L} ]+$/u;

const getPostLoginRoute = (role: UserRole, previousRoute?: string) =>
    role === 'can-bo' ? '/can-bo' : previousRoute ?? '/';

const getMethodLabel = (method: LoginMethod, role: UserRole) => {
    if (method === 'register') return 'Đăng ký tài khoản công dân';
    if (role === 'can-bo') return 'Đăng nhập cán bộ';
    if (method === 'vneid') return 'Đăng nhập VNeID';
    return 'Đăng nhập tài khoản GovBridge';
};

const LoginPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, login, registerCitizenAccount } = useAuth();
    const searchParams = new URLSearchParams(location.search);
    const methodParam = searchParams.get('method');
    const method: LoginMethod | null =
        methodParam === 'vneid' || methodParam === 'dvc' || methodParam === 'officer' || methodParam === 'register'
            ? methodParam
            : null;
    const role: UserRole = method === 'officer' || searchParams.get('role') === 'can-bo' ? 'can-bo' : 'nguoi-dan';
    const [agency] = useState('Cần Thơ');
    const [fullName, setFullName] = useState('');
    const [citizenId, setCitizenId] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    let from = localStorage.getItem('redirect_after_login') || undefined;
    if (from?.startsWith('/dang-nhap')) {
        from = undefined;
    }

    React.useEffect(() => {
        if (user && !isSubmitting && !successMessage) {
            navigate(getPostLoginRoute(user.role, from), { replace: true });
            localStorage.removeItem('redirect_after_login');
        }
    }, [user, navigate, from, isSubmitting, successMessage]);

    const openMethod = (nextMethod: LoginMethod) => {
        const nextRole = nextMethod === 'officer' ? 'can-bo' : 'nguoi-dan';
        setErrors({});
        setSuccessMessage('');
        navigate(`/dang-nhap?role=${nextRole}&method=${nextMethod}`, { state: location.state });
    };

    const returnToChooser = () => {
        setErrors({});
        setSuccessMessage('');
        navigate('/dang-nhap', { replace: true, state: location.state });
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextErrors: FormErrors = {};
        const isRegister = method === 'register';

        if (role === 'can-bo' && !agency.trim()) nextErrors.agency = 'Vui lòng chọn đơn vị/cơ quan.';
        if (isRegister && !fullName.trim()) {
            nextErrors.fullName = 'Vui lòng nhập họ tên.';
        } else if (isRegister && !citizenNamePattern.test(fullName.trim())) {
            nextErrors.fullName = 'Họ tên chỉ được gồm chữ cái và khoảng trắng.';
        }
        if (isRegister && !citizenId.trim()) {
            nextErrors.citizenId = 'Vui lòng nhập số CCCD/mã định danh.';
        } else if (isRegister && citizenId.trim() && !/^(?:\d{9}|\d{12})$/.test(citizenId.trim())) {
            nextErrors.citizenId = 'CCCD phải có 9 hoặc 12 chữ số.';
        }
        const normalizedUsername = username.trim();
        if (!isRegister && !normalizedUsername) {
            nextErrors.username = role === 'can-bo' ? 'Vui lòng nhập mã cán bộ.' : 'Vui lòng nhập số CCCD/mã định danh.';
        }
        if (!password) nextErrors.password = 'Vui lòng nhập mật khẩu.';
        if (!isRegister && password && password.length < 6) {
            nextErrors.password = 'Mật khẩu cần tối thiểu 6 ký tự.';
        }
        if (isRegister && password && password.length < 8) {
            nextErrors.password = 'Mật khẩu đăng ký cần tối thiểu 8 ký tự.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setErrors({});
        setIsSubmitting(true);
        window.setTimeout(() => {
            void (async () => {
                const authenticated = method === 'register'
                    ? await registerCitizenAccount({
                        password,
                        name: fullName,
                        citizenId: citizenId.trim(),
                    })
                    : await login(role, username, password, agency);
                setIsSubmitting(false);
                if (!authenticated) {
                    setErrors({ credentials: 'Tài khoản hoặc mật khẩu không đúng.' });
                    return;
                }
                setSuccessMessage(
                    method === 'register'
                        ? 'Đăng ký thành công. Đang chuyển hướng...'
                        : 'Đăng nhập thành công. Đang chuyển hướng...',
                );
                window.setTimeout(() => {
                    navigate(getPostLoginRoute(role, from), { replace: true });
                    localStorage.removeItem('redirect_after_login');
                }, 700);
            })().catch((error) => {
                setIsSubmitting(false);
                setErrors({
                    credentials: error instanceof Error
                        ? error.message
                        : 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
                });
            });
        }, 450);
    };

    if (!method) {
        return (
            <div className="login-ref-chooser">
                <button type="button" className="login-ref-home" onClick={() => navigate('/')}>
                    <ArrowLeft size={17} /> Về trang chủ
                </button>

                <header className="login-ref-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src="/logo_Gov_Bridge.jpg" alt="GovBridge" />
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#b91c1c', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>GovBridge</h1>
                </header>

                <main className="login-ref-selector" aria-labelledby="login-selector-title">
                    <h1 id="login-selector-title">Đăng nhập</h1>
                    <div className="login-ref-account-groups">
                        <section className="login-ref-account-group" aria-labelledby="citizen-login-title">
                            <h2 id="citizen-login-title">Công dân</h2>
                            <div className="login-ref-methods two-methods">
                                <button type="button" className="login-ref-method" onClick={() => openMethod('vneid')}>
                                    <img src="/logo_Gov_Bridge.jpg" alt="GovBridge" />
                                    <span>Tài khoản Định danh điện tử (VNeID)</span>
                                </button>
                                <button type="button" className="login-ref-method" onClick={() => openMethod('dvc')}>
                                    <img src="/logo_Gov_Bridge.jpg" alt="GovBridge" />
                                    <span>Tài khoản do hệ thống GovBridge cấp</span>
                                </button>
                            </div>
                        </section>

                        <section className={`login-ref-account-group${role === 'can-bo' ? ' preferred' : ''}`} aria-labelledby="officer-login-title">
                            <h2 id="officer-login-title">Cán bộ</h2>
                            <div className="login-ref-methods">
                                <button type="button" className="login-ref-method" onClick={() => openMethod('officer')}>
                                    <img src="/logo_Gov_Bridge.jpg" alt="GovBridge" />
                                    <span>Tài khoản cán bộ, cơ quan xử lý hồ sơ</span>
                                </button>
                            </div>
                        </section>
                    </div>

                    <aside className="login-ref-notice">
                        <strong>Thông báo từ hệ thống:</strong>
                        <p>Khi đăng nhập, thông tin cá nhân được đồng bộ từ tài khoản định danh sang hệ thống để phục vụ giải quyết thủ tục hành chính.</p>
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

    const isRegister = method === 'register';
    const formTitle = getMethodLabel(method, role);
    const testUsername = role === 'can-bo' ? 'officer' : '000000000001';

    return (
        <div className="login-ref-auth-page">
            <button type="button" className="login-ref-back" onClick={returnToChooser}>
                <ArrowLeft size={18} /> Chọn phương thức khác
            </button>

            <div className="login-ref-vneid-brand">
                <div className="login-ref-gov-brand">
                    <strong>{role === 'can-bo' ? 'Hệ thống cán bộ GovBridge' : 'Hệ thống công dân GovBridge'}</strong>
                </div>
            </div>

            <main className={`login-ref-auth-card${role === 'can-bo' ? ' officer' : ''}${isRegister ? ' register' : ''}`}>
                <div className="login-ref-form-pane">
                    <div className="login-ref-form-heading">
                        <span>{isRegister ? 'Tài khoản riêng tư, hồ sơ riêng tư' : 'Xác thực tài khoản'}</span>
                        <h1>{formTitle}</h1>
                        <p>
                            {isRegister
                                ? 'Tạo tài khoản công dân để hồ sơ được gắn với đúng người nộp và không bị hiển thị cho tài khoản khác.'
                                : 'Đăng nhập để tiếp tục thực hiện thủ tục và theo dõi hồ sơ của bạn.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                        {role === 'can-bo' && (
                            <div className="login-ref-field-block">
                                <label htmlFor="login-ref-agency" className="sr-only">Đơn vị / Cơ quan</label>
                                <div className={`login-ref-input${errors.agency ? ' invalid' : ''}`}>
                                    <Building2 size={23} />
                                    <input id="login-ref-agency" value={agency} readOnly disabled placeholder="Đơn vị / Cơ quan" />
                                </div>
                                {errors.agency && <p className="login-ref-error">{errors.agency}</p>}
                            </div>
                        )}

                        {isRegister && (
                            <>
                                <div className="login-ref-field-block">
                                    <label htmlFor="login-ref-full-name" className="sr-only">Họ tên</label>
                                    <div className={`login-ref-input${errors.fullName ? ' invalid' : ''}`}>
                                        <UserRound size={23} />
                                        <input id="login-ref-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Họ tên công dân" autoComplete="name" />
                                    </div>
                                    {errors.fullName && <p className="login-ref-error">{errors.fullName}</p>}
                                </div>
                                <div className="login-ref-field-block">
                                    <label htmlFor="login-ref-citizen-id" className="sr-only">Số CCCD / mã định danh</label>
                                    <div className={`login-ref-input${errors.citizenId ? ' invalid' : ''}`}>
                                        <ShieldCheck size={23} />
                                        <input id="login-ref-citizen-id" value={citizenId} onChange={(event) => setCitizenId(event.target.value)} placeholder="Số CCCD/mã định danh" autoComplete="off" />
                                    </div>
                                    {errors.citizenId && <p className="login-ref-error">{errors.citizenId}</p>}
                                </div>
                            </>
                        )}

                        {!isRegister && (
                            <div className="login-ref-field-block">
                                <label htmlFor="login-ref-username" className="sr-only">{role === 'can-bo' ? 'Mã cán bộ' : 'Số CCCD / mã định danh'}</label>
                                <div className={`login-ref-input${errors.username ? ' invalid' : ''}`}>
                                    <UserRound size={23} />
                                    <input
                                        id="login-ref-username"
                                        value={username}
                                        onChange={(event) => setUsername(event.target.value)}
                                        placeholder={role === 'can-bo' ? 'Mã cán bộ' : 'Số CCCD/mã định danh'}
                                        autoComplete="username"
                                    />
                                </div>
                                {errors.username && <p className="login-ref-error">{errors.username}</p>}
                            </div>
                        )}

                        <div className="login-ref-field-block">
                            <label htmlFor="login-ref-password" className="sr-only">Mật khẩu</label>
                            <div className={`login-ref-input${errors.password ? ' invalid' : ''}`}>
                                <LockKeyhole size={23} />
                                <input id="login-ref-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" autoComplete={isRegister ? 'new-password' : 'current-password'} />
                                <button type="button" className="login-ref-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>
                            {errors.password && <p className="login-ref-error">{errors.password}</p>}
                        </div>

                        {errors.credentials && <div className="login-ref-message error" role="alert">{errors.credentials}</div>}
                        {successMessage && <div className="login-ref-message success" role="status"><BadgeCheck size={18} /> {successMessage}</div>}

                        <button type="submit" className="login-ref-submit" disabled={isSubmitting}>
                            {isSubmitting
                                ? <><LoaderCircle className="auth-spinner" size={19} /> Đang xử lý...</>
                                : isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}
                        </button>

                        <div className="login-ref-form-footer">
                            {!isRegister && (
                                <button type="button" className="login-ref-secondary-action" onClick={() => openMethod('register')}>
                                    Chưa có tài khoản? Đăng ký tài khoản công dân
                                </button>
                            )}
                            {isRegister && (
                                <button type="button" className="login-ref-secondary-action" onClick={() => openMethod('dvc')}>
                                    Đã có tài khoản? Quay lại đăng nhập
                                </button>
                            )}
                            {!isRegister && (
                                <p className="login-ref-demo">{role === 'can-bo' ? 'Tài khoản thử nghiệm' : 'CCCD thử nghiệm'}: <strong>{testUsername}</strong> / <strong>123456</strong></p>
                            )}
                        </div>
                    </form>
                </div>

                <aside className="login-ref-side-pane">
                    <img src="/logo_Gov_Bridge.jpg" alt="GovBridge" />
                    <p>
                        {role === 'can-bo'
                            ? 'Dành cho cán bộ tiếp nhận và xử lý hồ sơ hành chính.'
                            : isRegister
                                ? 'Mỗi tài khoản công dân có vùng hồ sơ riêng, được kiểm soát bằng xác thực và phân quyền.'
                                : 'Xác thực bằng tài khoản GovBridge để tiếp tục sử dụng dịch vụ công.'}
                    </p>
                </aside>
            </main>

            {!isRegister && (
                <div className="login-test-credentials-popup" role="note" aria-label="Tài khoản test">
                    <span>{role === 'can-bo' ? 'Tài khoản test' : 'CCCD test'}: <strong>{testUsername}</strong></span>
                    <span>Mật khẩu test: <strong>123456</strong></span>
                </div>
            )}

            <button type="button" className="login-ref-guide" aria-label="Hướng dẫn đăng ký tài khoản"><HelpCircle size={30} /></button>
        </div>
    );
};

export default LoginPage;
