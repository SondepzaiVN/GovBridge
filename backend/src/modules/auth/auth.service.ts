import { AppError, UnauthorizedError } from '../../common/errors/app-error.js';
import { verifyPassword, type AuthRepositoryPort } from './auth.repository.js';
import type { AuthenticatedUser, PublicAuthUser, UserRole } from './auth.types.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export class AuthService {
  constructor(private readonly repository: AuthRepositoryPort) {}

  async registerCitizen(input: {
    username: string;
    password: string;
    name: string;
    citizenId?: string;
  }): Promise<{ user: PublicAuthUser; token: string; expiresAt: string }> {
    try {
      const user = await this.repository.createCitizen(input);
      const session = await this.repository.createSession(user.id, SESSION_TTL_MS);
      return { user, ...session };
    } catch (error) {
      if (error instanceof Error && error.message === 'USERNAME_EXISTS') {
        throw new AppError(409, 'USERNAME_EXISTS', 'Tên đăng nhập đã được sử dụng.');
      }
      throw error;
    }
  }

  async login(input: {
    role: UserRole;
    username: string;
    password: string;
  }): Promise<{ user: PublicAuthUser; token: string; expiresAt: string }> {
    const user = await this.repository.findUserByUsername(input.username);
    if (!user || user.role !== input.role || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedError('Tài khoản hoặc mật khẩu không đúng.');
    }
    const session = await this.repository.createSession(user.id, SESSION_TTL_MS);
    return { user: this.repository.toPublicUser(user), ...session };
  }

  async authenticateToken(token: string): Promise<AuthenticatedUser> {
    const result = await this.repository.findSessionByToken(token);
    if (!result) throw new UnauthorizedError();
    return {
      ...this.repository.toPublicUser(result.user),
      sessionTokenHash: result.session.tokenHash,
    };
  }

  async logout(user: AuthenticatedUser): Promise<{ deleted: boolean }> {
    return { deleted: await this.repository.deleteSession(user.sessionTokenHash) };
  }
}
