export type UserRole = 'nguoi-dan' | 'can-bo' | 'admin';

export type AuthUser = {
    id: string;
    name: string;
    role: UserRole;
    username: string;
    agency?: string;
    agencyId?: string;
};

type LoginCredentials = {
    username: string;
    password: string;
    agency?: string;
};

type AuthApiResult = {
    user: AuthUser;
    token: string;
    expiresAt: string;
};

type AuthApiError = {
    code?: string;
    message?: string;
};

const AUTH_STORAGE_KEY = 'govbridge-auth-user';
const AUTH_TOKEN_STORAGE_KEY = 'govbridge-auth-token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:3000/api');

const isAuthUser = (value: unknown): value is AuthUser => {
    if (!value || typeof value !== 'object') return false;
    const user = value as Partial<AuthUser>;
    return Boolean(
        user.id
        && user.name
        && user.username
        && (user.role === 'nguoi-dan' || user.role === 'can-bo' || user.role === 'admin'),
    );
};

const getFriendlyAuthError = (response: Response, error?: AuthApiError): string => {
    if (error?.code === 'USERNAME_EXISTS' || error?.message === 'Ten dang nhap da duoc su dung.') {
        return 'Tên đăng nhập đã được sử dụng.';
    }

    if (response.status === 401 || error?.code === 'UNAUTHORIZED') {
        return 'Tài khoản hoặc mật khẩu không đúng.';
    }

    if (error?.code === 'INVALID_REQUEST') {
        return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại tài khoản và mật khẩu.';
    }

    if (error?.message === 'Tai khoan hoac mat khau khong dung.') {
        return 'Tài khoản hoặc mật khẩu không đúng.';
    }

    return error?.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
};

const persistAuth = (result: AuthApiResult): AuthUser => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
    localStorage.setItem(`${AUTH_TOKEN_STORAGE_KEY}:expiresAt`, result.expiresAt);
    return result.user;
};

export const getAuthToken = (): string | null => {
    try {
        const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        const expiresAt = localStorage.getItem(`${AUTH_TOKEN_STORAGE_KEY}:expiresAt`);
        if (!token) return null;
        if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
            clearCurrentUser();
            return null;
        }
        return token;
    } catch {
        return null;
    }
};

export const withAuthHeaders = (headers?: HeadersInit): Headers => {
    const nextHeaders = new Headers(headers);
    const token = getAuthToken();
    if (token && !nextHeaders.has('Authorization')) {
        nextHeaders.set('Authorization', `Bearer ${token}`);
    }
    return nextHeaders;
};

export const getCurrentUser = (): AuthUser | null => {
    try {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!storedUser || !getAuthToken()) return null;
        const user: unknown = JSON.parse(storedUser);
        return isAuthUser(user) ? user : null;
    } catch {
        clearCurrentUser();
        return null;
    }
};

const readAuthResult = async (response: Response): Promise<AuthApiResult> => {
    const payload = await response.json().catch(() => null) as {
        success?: boolean;
        data?: AuthApiResult;
        error?: AuthApiError;
    } | null;

    if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(getFriendlyAuthError(response, payload?.error));
    }
    return payload.data;
};

export const loginWithPassword = async (
    role: UserRole,
    credentials: LoginCredentials,
): Promise<AuthUser | null> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role,
            username: credentials.username.trim(),
            password: credentials.password,
        }),
    });
    return persistAuth(await readAuthResult(response));
};

export const registerCitizen = async (input: {
    username: string;
    password: string;
    name: string;
    citizenId?: string;
}): Promise<AuthUser> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    return persistAuth(await readAuthResult(response));
};

export const loginCitizenWithProvider = async (): Promise<AuthUser> =>
    loginWithPassword('nguoi-dan', { username: 'citizen', password: '123456' }) as Promise<AuthUser>;

export const clearCurrentUser = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(`${AUTH_TOKEN_STORAGE_KEY}:expiresAt`);
};
