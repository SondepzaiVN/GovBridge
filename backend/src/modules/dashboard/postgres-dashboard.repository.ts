import { randomBytes } from 'node:crypto';
import type { PostgresDatabase } from '../../storage/postgres.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type {
  DashboardApplication,
  DashboardRepositoryPort,
  DashboardUploadRecord,
} from './dashboard.repository.js';

interface ApplicationRow {
  id: string;
  owner_user_id: string;
  service_id: string;
  status: string;
  data_json: DashboardApplication;
  submitted_at: Date | string;
  updated_at: Date | string;
}

const createId = (prefix: string): string => `${prefix}-${randomBytes(8).toString('hex')}`;

const toApplication = (row: ApplicationRow): DashboardApplication => ({
  ...row.data_json,
  id: row.data_json.id ?? row.id,
  ownerUserId: row.data_json.ownerUserId ?? row.owner_user_id,
  serviceId: row.data_json.serviceId ?? row.service_id,
  status: row.data_json.status ?? row.status,
});

const getServiceId = (application: DashboardApplication): string => {
  const serviceId = application.serviceId ?? application.procedure ?? application.procedureName ?? 'dashboard';
  return typeof serviceId === 'string' ? serviceId.slice(0, 200) : 'dashboard';
};

const getStatus = (application: DashboardApplication): string => {
  const status = application.status ?? application.statusLabel ?? 'Cho tiep nhan';
  return typeof status === 'string' ? status.slice(0, 100) : 'Cho tiep nhan';
};

export class PostgresDashboardRepository implements DashboardRepositoryPort {
  constructor(private readonly database: PostgresDatabase) {}

  async findAll(): Promise<DashboardApplication[]> {
    const result = await this.database.query<ApplicationRow>(`
      select id, owner_user_id, service_id, status, data_json, submitted_at, updated_at
      from applications
      order by submitted_at desc
    `);
    return result.rows.map(toApplication);
  }

  async findByOwner(ownerUserId: string): Promise<DashboardApplication[]> {
    const result = await this.database.query<ApplicationRow>(`
      select id, owner_user_id, service_id, status, data_json, submitted_at, updated_at
      from applications
      where owner_user_id = $1
      order by submitted_at desc
    `, [ownerUserId]);
    return result.rows.map(toApplication);
  }

  async insert(application: DashboardApplication): Promise<DashboardApplication> {
    const ownerUserId = String(application.ownerUserId ?? '');
    const clientSubmissionId = typeof application.clientSubmissionId === 'string'
      ? application.clientSubmissionId.trim()
      : '';

    if (clientSubmissionId) {
      const existing = await this.database.query<ApplicationRow>(`
        select id, owner_user_id, service_id, status, data_json, submitted_at, updated_at
        from applications
        where owner_user_id = $1 and data_json ->> 'clientSubmissionId' = $2
        limit 1
      `, [ownerUserId, clientSubmissionId]);
      if (existing.rows[0]) return toApplication(existing.rows[0]);
    }

    const id = String(application.id ?? application.applicationCode ?? createId('GOV'));
    const serviceId = getServiceId(application);
    const status = getStatus(application);
    const dataJson = {
      ...application,
      id,
      ownerUserId,
      serviceId,
      status,
    };
    const result = await this.database.query<ApplicationRow>(`
      insert into applications (id, owner_user_id, service_id, status, data_json)
      values ($1, $2, $3, $4, $5::jsonb)
      returning id, owner_user_id, service_id, status, data_json, submitted_at, updated_at
    `, [id, ownerUserId, serviceId, status, JSON.stringify(dataJson)]);
    return toApplication(result.rows[0]!);
  }

  async update(id: string, updates: Partial<DashboardApplication>): Promise<DashboardApplication | null> {
    const result = await this.database.query<ApplicationRow>(`
      update applications
      set
        data_json = data_json || $2::jsonb,
        status = coalesce($3, status),
        updated_at = now()
      where id = $1
      returning id, owner_user_id, service_id, status, data_json, submitted_at, updated_at
    `, [
      id,
      JSON.stringify(updates),
      typeof updates.status === 'string' ? updates.status : null,
    ]);
    return result.rows[0] ? toApplication(result.rows[0]) : null;
  }

  async recordUpload(upload: DashboardUploadRecord): Promise<void> {
    await this.database.query(`
      insert into attachments (
        id,
        owner_user_id,
        storage_key,
        original_name,
        mime_type,
        size_bytes
      )
      values ($1, $2, $3, $4, 'application/octet-stream', 0)
      on conflict (storage_key) do nothing
    `, [
      createId('att'),
      upload.ownerUserId,
      upload.storageKey,
      upload.originalName,
    ]);
  }

  async canReadAttachment(storageKey: string, user: AuthenticatedUser): Promise<boolean> {
    if (user.role === 'can-bo' || user.role === 'admin') return true;
    const result = await this.database.query<{ allowed: boolean }>(`
      select exists (
        select 1
        from attachments
        where storage_key = $1 and owner_user_id = $2
      ) as allowed
    `, [storageKey, user.id]);
    return Boolean(result.rows[0]?.allowed);
  }
}
