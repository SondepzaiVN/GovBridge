import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../services/authService';
import { Lock } from 'lucide-react';

type RequireRoleProps = React.PropsWithChildren<{
    role: UserRole;
}>;

const getDashboardRoute = (role: UserRole) => role === 'can-bo' ? '/can-bo' : '/nguoi-dan';

const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    if (!user) {
        const handleCancel = () => {
            if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
            } else {
                navigate('/', { replace: true });
            }
        };

        const handleLogin = () => {
            navigate(`/dang-nhap?role=${role}`, { replace: true, state: { from: location.pathname } });
        };

        return (
            <div style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div className="auth-modal-overlay" onClick={handleCancel}>
                    <div
                        className="auth-modal-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-modal-title"
                    >
                        <div className="auth-modal-header">
                            <div className="auth-modal-icon">
                                <Lock size={24} />
                            </div>
                            <div>
                                <h3 id="auth-modal-title" className="auth-modal-title">
                                    Yêu cầu đăng nhập
                                </h3>
                                <p className="auth-modal-desc">
                                    Vui lòng đăng nhập tài khoản để tiếp tục truy cập vào khu vực này.
                                </p>
                            </div>
                        </div>

                        <div className="auth-modal-actions">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="auth-modal-btn auth-modal-btn--cancel"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleLogin}
                                className="auth-modal-btn auth-modal-btn--primary"
                            >
                                Đăng nhập
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (user.role !== role) {
        return <Navigate to={getDashboardRoute(user.role)} replace />;
    }

    return children;
};

export default RequireRole;
