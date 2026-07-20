import { randomBytes } from 'node:crypto';
import type { PostgresDatabase } from '../../storage/postgres.js';
import {
  hashCitizenId,
  hashPassword,
  normalizeUsername,
  sha256,
  toPublicUser,
  type AuthRepositoryPort,
} from './auth.repository.js';
import type { AuthSession, AuthUser, PublicAuthUser } from './auth.types.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: AuthUser['role'];
  citizen_id_hash: string | null;
  created_at: Date | string;
  agency_id: string | null;
  agency_name: string | null;
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  session_created_at: Date | string;
  expires_at: Date | string;
}

const TOKEN_BYTES = 32;

const createId = (prefix: string): string => `${prefix}-${randomBytes(8).toString('hex')}`;

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toAuthUser = (row: UserRow): AuthUser => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  name: row.full_name,
  role: row.role,
  createdAt: toIso(row.created_at),
  ...(row.citizen_id_hash ? { citizenIdHash: row.citizen_id_hash } : {}),
  ...(row.agency_name ? { agency: row.agency_name } : {}),
  ...(row.agency_id ? { agencyId: row.agency_id } : {}),
});

const toAuthSession = (row: SessionRow): AuthSession => ({
  tokenHash: row.token_hash,
  userId: row.user_id,
  createdAt: toIso(row.session_created_at),
  expiresAt: toIso(row.expires_at),
});

export class PostgresAuthRepository implements AuthRepositoryPort {
  constructor(private readonly database: PostgresDatabase) {}

  async findUserByUsername(username: string): Promise<AuthUser | null> {
    await this.ensureDemoUsers();
    const result = await this.database.query<UserRow>(`
      select
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.role,
        u.citizen_id_hash,
        u.created_at,
        op.agency_id,
        a.name as agency_name
      from users u
      left join officer_profiles op on op.user_id = u.id
      left join agencies a on a.id = op.agency_id
      where u.username = $1
        or u.citizen_id_hash = $2
      limit 1
    `, [
      normalizeUsername(username),
      /^(?:\d{9}|\d{12})$/.test(username.trim()) ? hashCitizenId(username.trim()) : null,
    ]);
    return result.rows[0] ? toAuthUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    await this.ensureDemoUsers();
    const result = await this.database.query<UserRow>(`
      select
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.role,
        u.citizen_id_hash,
        u.created_at,
        op.agency_id,
        a.name as agency_name
      from users u
      left join officer_profiles op on op.user_id = u.id
      left join agencies a on a.id = op.agency_id
      where u.id = $1
      limit 1
    `, [id]);
    return result.rows[0] ? toAuthUser(result.rows[0]) : null;
  }

  async createCitizen(input: {
    password: string;
    name: string;
    citizenId: string;
  }): Promise<PublicAuthUser> {
    await this.ensureDemoUsers();
    const id = createId('citizen');
    const citizenId = input.citizenId.trim();
    const internalUsername = createId('citizen');
    try {
      const result = await this.database.query<UserRow>(`
        insert into users (
          id,
          username,
          password_hash,
          full_name,
          role,
          citizen_id_hash
        )
        values ($1, $2, $3, $4, 'nguoi-dan', $5)
        returning
          id,
          username,
          password_hash,
          full_name,
          role,
          citizen_id_hash,
          created_at,
          null::text as agency_id,
          null::text as agency_name
      `, [
        id,
        internalUsername,
        hashPassword(input.password),
        input.name.trim(),
        hashCitizenId(citizenId),
      ]);
      return toPublicUser(toAuthUser(result.rows[0]!));
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        const constraint = 'constraint' in error ? String(error.constraint ?? '') : '';
        if (constraint.includes('citizen_id_hash')) {
          throw new Error('CITIZEN_ID_EXISTS');
        }
        throw new Error('CITIZEN_ID_EXISTS');
      }
      throw error;
    }
  }

  async createSession(userId: string, ttlMs: number): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = sha256(token);
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs).toISOString();
    await this.database.query(
      'delete from auth_sessions where expires_at <= now()',
    );
    await this.database.query(`
      insert into auth_sessions (token_hash, user_id, expires_at)
      values ($1, $2, $3)
    `, [tokenHash, userId, expiresAt]);
    return { token, expiresAt };
  }

  async findSessionByToken(token: string): Promise<{ session: AuthSession; user: AuthUser } | null> {
    await this.ensureDemoUsers();
    const tokenHash = sha256(token);
    const result = await this.database.query<UserRow & SessionRow>(`
      select
        s.token_hash,
        s.user_id,
        s.created_at as session_created_at,
        s.expires_at,
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.role,
        u.citizen_id_hash,
        u.created_at as created_at,
        op.agency_id,
        a.name as agency_name
      from auth_sessions s
      join users u on u.id = s.user_id
      left join officer_profiles op on op.user_id = u.id
      left join agencies a on a.id = op.agency_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1
    `, [tokenHash]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      session: toAuthSession(row),
      user: toAuthUser(row),
    };
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    const result = await this.database.query(
      'delete from auth_sessions where token_hash = $1',
      [tokenHash],
    );
    return (result.rowCount ?? 0) > 0;
  }

  public toPublicUser(user: AuthUser): PublicAuthUser {
    return toPublicUser(user);
  }

  private async ensureDemoUsers(): Promise<void> {
    await this.database.query(`
      insert into agencies (id, name)
      values ('agency-demo', 'Cong an phuong demo')
      on conflict (id) do nothing
    `);
    await this.database.query(`
      insert into users (
        id,
        username,
        password_hash,
        full_name,
        role,
        citizen_id_hash
      )
      values
        ('citizen-001', 'citizen', $1, 'Nguyen Van A', 'nguoi-dan', $2),
        ('officer-001', 'officer', $3, 'Tran Van B', 'can-bo', null)
      on conflict (id) do nothing
    `, [
      hashPassword('123456'),
      hashCitizenId('000000000001'),
      hashPassword('123456'),
    ]);
    await this.database.query(`
      insert into officer_profiles (user_id, agency_id, position)
      values ('officer-001', 'agency-demo', 'Can bo xu ly demo')
      on conflict (user_id) do nothing
    `);
  }
}
