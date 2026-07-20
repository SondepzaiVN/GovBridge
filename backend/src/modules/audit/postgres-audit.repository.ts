import { randomBytes } from 'node:crypto';
import type { PostgresDatabase } from '../../storage/postgres.js';
import type { AuditRecordInput, AuditRepositoryPort } from './audit.repository.js';

const createAuditId = (): string => `audit-${randomBytes(12).toString('hex')}`;

export class PostgresAuditRepository implements AuditRepositoryPort {
  constructor(private readonly database: PostgresDatabase) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.database.query(`
      insert into audit_logs (
        id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6::inet, $7, $8::jsonb)
    `, [
      createAuditId(),
      input.actorUserId ?? null,
      input.action,
      input.resourceType,
      input.resourceId,
      input.request?.ip ?? null,
      input.request?.header('user-agent') ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]);
  }
}
