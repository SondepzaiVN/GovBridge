import { createContext, useContext } from 'react';
import type { AuthUser, UserRole } from '../services/authService';

export type AuthContextValue = {
    user: AuthUser | null;
    login: (role: UserRole, username: string, password: string, agency?: string) => boolean;
    loginWithCitizenProvider: () => void;
    logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider.');
    return context;
};
