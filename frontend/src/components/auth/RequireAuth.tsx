import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';

/**
 * Guard chung: yêu cầu đăng nhập (bất kỳ role nào).
 * Nếu chưa đăng nhập → redirect về /dang-nhap và lưu trang hiện tại để quay lại sau.
 */
const RequireAuth: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return (
            <Navigate
                to="/dang-nhap"
                replace
                state={{ from: location.pathname }}
            />
        );
    }

    return children;
};

export default RequireAuth;
