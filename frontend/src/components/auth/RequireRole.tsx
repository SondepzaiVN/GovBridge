import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../services/authService';

type RequireRoleProps = React.PropsWithChildren<{
    role: UserRole;
}>;

const getDashboardRoute = (role: UserRole) => role === 'can-bo' ? '/can-bo' : '/nguoi-dan';

const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to={`/dang-nhap?role=${role}`} replace state={{ from: location.pathname }} />;
    }

    if (user.role !== role) {
        return <Navigate to={getDashboardRoute(user.role)} replace />;
    }

    return children;
};

export default RequireRole;
