import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';
import type { AuthSession, AuthStore, AuthUser, PublicAuthUser, UserRole } from './auth.types.js';

const TOKEN_BYTES = 32;
const PASSWORD_KEY_BYTES = 64;

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const hashCitizenId = (citizenId: string): string =>
  sha256(citizenId.replace(/\s+/g, ''));

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('base64url');
  const key = scryptSync(password, salt, PASSWORD_KEY_BYTES).toString('base64url');
  return `scrypt$${salt}$${key}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [algorithm, salt, expectedKey] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedKey) return false;
  const actual = Buffer.from(scryptSync(password, salt, PASSWORD_KEY_BYTES).toString('base64url'));
  const expected = Buffer.from(expectedKey);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const toPublicUser = (user: AuthUser): PublicAuthUser => ({
  id: user.id,
  loginIdentifier: user.loginIdentifier,
  name: user.name,
  role: user.role,
  ...(user.agency ? { agency: user.agency } : {}),
  ...(user.agencyId ? { agencyId: user.agencyId } : {}),
});

export const normalizeLoginIdentifier = (loginIdentifier: string): string =>
  loginIdentifier.trim().toLowerCase();

const createDemoUser = (
  id: string,
  loginIdentifier: string,
  name: string,
  role: UserRole,
  password: string,
  createdAt: string,
  extra: Partial<Pick<AuthUser, 'agency' | 'agencyId' | 'citizenIdHash'>> = {},
): AuthUser => ({
  id,
  loginIdentifier,
  passwordHash: hashPassword(password),
  name,
  role,
  createdAt,
  ...extra,
});

export interface AuthRepositoryPort {
  findUserByLoginIdentifier(loginIdentifier: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createCitizen(input: {
    password: string;
    name: string;
    citizenId: string;
  }): Promise<PublicAuthUser>;
  createSession(userId: string, ttlMs: number): Promise<{ token: string; expiresAt: string }>;
  findSessionByToken(token: string): Promise<{ session: AuthSession; user: AuthUser } | null>;
  deleteSession(tokenHash: string): Promise<boolean>;
  toPublicUser(user: AuthUser): PublicAuthUser;
}

export class AuthRepository implements AuthRepositoryPort {
  private readonly store: JsonFileStore<AuthStore>;

  constructor(dataDirectory: string) {
    this.store = new JsonFileStore(path.join(dataDirectory, 'auth-store.json'), {
      schemaVersion: 1,
      users: [],
      sessions: [],
    });
  }

  async findUserByLoginIdentifier(loginIdentifier: string): Promise<AuthUser | null> {
    await this.ensureDemoUsers();
    const data = await this.store.read();
    const normalizedLoginIdentifier = normalizeLoginIdentifier(loginIdentifier);
    const normalizedCitizenIdHash = /^(?:\d{9}|\d{12})$/.test(normalizedLoginIdentifier)
      ? hashCitizenId(normalizedLoginIdentifier)
      : '';
    return data.users.find((user) =>
      user.loginIdentifier === normalizedLoginIdentifier
      || (normalizedCitizenIdHash && user.citizenIdHash === normalizedCitizenIdHash),
    ) ?? null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    await this.ensureDemoUsers();
    const data = await this.store.read();
    return data.users.find((user) => user.id === id) ?? null;
  }

  async createCitizen(input: {
    password: string;
    name: string;
    citizenId: string;
  }): Promise<PublicAuthUser> {
    await this.ensureDemoUsers();
    const now = new Date().toISOString();
    const citizenIdHash = hashCitizenId(input.citizenId.trim());
    return this.store.update((data) => {
      if (data.users.some((user) => user.citizenIdHash === citizenIdHash)) {
        throw new Error('CITIZEN_ID_EXISTS');
      }
      const user: AuthUser = {
        id: `citizen-${cryptoRandomId()}`,
        loginIdentifier: `citizen-${cryptoRandomId()}`,
        passwordHash: hashPassword(input.password),
        name: input.name.trim(),
        role: 'nguoi-dan',
        createdAt: now,
        citizenIdHash,
      };
      data.users.push(user);
      return toPublicUser(user);
    });
  }

  async createSession(userId: string, ttlMs: number): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = sha256(token);
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs).toISOString();
    await this.store.update((data) => {
      data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > now);
      data.sessions.push({
        tokenHash,
        userId,
        createdAt: new Date(now).toISOString(),
        expiresAt,
      });
    });
    return { token, expiresAt };
  }

  async findSessionByToken(token: string): Promise<{ session: AuthSession; user: AuthUser } | null> {
    await this.ensureDemoUsers();
    const tokenHash = sha256(token);
    const now = Date.now();
    const data = await this.store.read();
    const session = data.sessions.find((item) => item.tokenHash === tokenHash && Date.parse(item.expiresAt) > now);
    if (!session) return null;
    const user = data.users.find((item) => item.id === session.userId);
    return user ? { session, user } : null;
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    return this.store.update((data) => {
      const before = data.sessions.length;
      data.sessions = data.sessions.filter((session) => session.tokenHash !== tokenHash);
      return data.sessions.length !== before;
    });
  }

  public toPublicUser(user: AuthUser): PublicAuthUser {
    return toPublicUser(user);
  }

  private async ensureDemoUsers(): Promise<void> {
    await this.store.update((data) => {
      if (data.users.length > 0) return;
      const now = new Date().toISOString();
      data.users.push(
        createDemoUser('citizen-001', 'citizen', 'Nguyen Van A', 'nguoi-dan', '123456', now, {
          citizenIdHash: hashCitizenId('000000000001'),
        }),
        createDemoUser('officer-001', 'officer', 'Tran Van B', 'can-bo', '123456', now, {
          agency: 'Cong an phuong demo',
          agencyId: 'agency-demo',
        }),
      );
    });
  }
}

const cryptoRandomId = (): string => randomBytes(8).toString('hex');
