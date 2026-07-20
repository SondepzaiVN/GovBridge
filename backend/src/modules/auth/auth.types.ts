export type UserRole = 'nguoi-dan' | 'can-bo' | 'admin';

export interface AuthUser {
  id: string;
  loginIdentifier: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  agency?: string;
  agencyId?: string;
  citizenIdHash?: string;
  createdAt: string;
}

export interface PublicAuthUser {
  id: string;
  loginIdentifier: string;
  name: string;
  role: UserRole;
  agency?: string;
  agencyId?: string;
}

export interface AuthSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthStore {
  schemaVersion: number;
  users: AuthUser[];
  sessions: AuthSession[];
}

export interface AuthenticatedUser extends PublicAuthUser {
  sessionTokenHash: string;
}
