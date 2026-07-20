import React, { useMemo, useState } from 'react';
import {
    clearCurrentUser,
    getCurrentUser,
    loginCitizenWithProvider,
    loginWithPassword,
    registerCitizen,
    type AuthUser,
} from '../services/authService';
import { AuthContext, type AuthContextValue } from './useAuth';

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

    const value = useMemo<AuthContextValue>(() => ({
        user,
        login: async (role, username, password, agency) => {
            const authenticatedUser = await loginWithPassword(role, { username, password, agency });
            setUser(authenticatedUser);
            return Boolean(authenticatedUser);
        },
        registerCitizenAccount: async (input) => {
            const authenticatedUser = await registerCitizen(input);
            setUser(authenticatedUser);
            return Boolean(authenticatedUser);
        },
        loginWithCitizenProvider: async () => setUser(await loginCitizenWithProvider()),
        logout: () => {
            clearCurrentUser();
            setUser(null);
        },
    }), [user]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
