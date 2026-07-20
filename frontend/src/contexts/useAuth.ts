import { createContext, useContext } from 'react';
import type { AuthUser, UserRole } from '../services/authService';

export type AuthContextValue = {
    user: AuthUser | null;
    login: (role: UserRole, loginIdentifier: string, password: string, agency?: string) => Promise<boolean>;
    registerCitizenAccount: (input: {
        password: string;
        name: string;
        citizenId: string;
    }) => Promise<boolean>;
    loginWithCitizenProvider: () => Promise<void>;
    logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider.');
    return context;
};
