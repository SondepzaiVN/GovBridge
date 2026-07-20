import type { Request } from 'express';

export interface AuditRecordInput {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  request?: Request;
  metadata?: Record<string, unknown>;
}

export interface AuditRepositoryPort {
  record(input: AuditRecordInput): Promise<void>;
}

export class NoopAuditRepository implements AuditRepositoryPort {
  async record(_input: AuditRecordInput): Promise<void> {
    return undefined;
  }
}
