export type UserRole = 'nguoi-dan' | 'can-bo';

export type AuthUser = {
    id: string;
    name: string;
    role: UserRole;
    username: string;
    agency?: string;
};

type LoginCredentials = {
    username: string;
    password: string;
    agency?: string;
};

const AUTH_STORAGE_KEY = 'govbridge-auth-user';

const MOCK_USERS = {
    'nguoi-dan': {
        id: 'citizen-001',
        username: 'citizen',
        password: '123456',
        name: 'Nguyễn Văn A',
        role: 'nguoi-dan',
    },
    'can-bo': {
        id: 'officer-001',
        username: 'officer',
        password: '123456',
        name: 'Trần Văn B',
        role: 'can-bo',
        agency: 'Công an phường demo',
    },
} as const;

const isAuthUser = (value: unknown): value is AuthUser => {
    if (!value || typeof value !== 'object') return false;
    const user = value as Partial<AuthUser>;
    return Boolean(
        user.id
        && user.name
        && user.username
        && (user.role === 'nguoi-dan' || user.role === 'can-bo'),
    );
};

export const getCurrentUser = (): AuthUser | null => {
    try {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!storedUser) return null;
        const user: unknown = JSON.parse(storedUser);
        return isAuthUser(user) ? user : null;
    } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
};

export const loginWithPassword = (
    role: UserRole,
    credentials: LoginCredentials,
): AuthUser | null => {
    const mockUser = MOCK_USERS[role];
    if (credentials.username.trim() !== mockUser.username || credentials.password !== mockUser.password) {
        return null;
    }

    const user: AuthUser = {
        id: mockUser.id,
        name: mockUser.name,
        role: mockUser.role,
        username: mockUser.username,
        ...(role === 'can-bo' ? { agency: credentials.agency?.trim() || MOCK_USERS['can-bo'].agency } : {}),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
};

export const loginCitizenWithProvider = (): AuthUser => {
    const mockUser = MOCK_USERS['nguoi-dan'];
    const user: AuthUser = {
        id: mockUser.id,
        name: mockUser.name,
        role: mockUser.role,
        username: mockUser.username,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
};

export const clearCurrentUser = () => localStorage.removeItem(AUTH_STORAGE_KEY);
