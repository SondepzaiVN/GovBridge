import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DashboardApplication = Record<string, any>;

export interface DashboardUploadRecord {
  storageKey: string;
  ownerUserId: string;
  originalName: string;
  createdAt: string;
}

export type DashboardStore = {
  applications: DashboardApplication[];
  uploads?: DashboardUploadRecord[];
};

export interface DashboardRepositoryPort {
  findAll(): Promise<DashboardApplication[]>;
  findByOwner(ownerUserId: string): Promise<DashboardApplication[]>;
  insert(application: DashboardApplication): Promise<DashboardApplication>;
  update(id: string, updates: Partial<DashboardApplication>): Promise<DashboardApplication | null>;
  recordUpload(upload: DashboardUploadRecord): Promise<void>;
  canReadAttachment(storageKey: string, user: AuthenticatedUser): Promise<boolean>;
}

export class DashboardRepository implements DashboardRepositoryPort {
  private readonly store: JsonFileStore<DashboardStore>;

  constructor(dataDirectory: string) {
    this.store = new JsonFileStore(path.join(dataDirectory, 'dashboard-applications.json'), {
      applications: [],
    });
  }

  async findAll(): Promise<DashboardApplication[]> {
    const data = await this.store.read();
    return data.applications;
  }

  async findByOwner(ownerUserId: string): Promise<DashboardApplication[]> {
    const data = await this.store.read();
    return data.applications.filter((application) => application.ownerUserId === ownerUserId);
  }

  async insert(application: DashboardApplication): Promise<DashboardApplication> {
    return this.store.update((data) => {
      const clientSubmissionId = typeof application.clientSubmissionId === 'string'
        ? application.clientSubmissionId.trim()
        : '';
      if (clientSubmissionId) {
        const existing = data.applications.find((app) =>
          app.clientSubmissionId === clientSubmissionId
          && app.ownerUserId === application.ownerUserId
        );
        if (existing) return existing;
      }

      // Thêm lên đầu mảng để hồ sơ mới nhất luôn hiện đầu tiên
      data.applications.unshift(application);
      return application;
    });
  }

  async update(id: string, updates: Partial<DashboardApplication>): Promise<DashboardApplication | null> {
    return this.store.update((data) => {
      const index = data.applications.findIndex((app) => app.id === id);
      if (index === -1) return null;
      
      const updated = { ...data.applications[index], ...updates };
      data.applications[index] = updated;
      return updated;
    });
  }

  async recordUpload(upload: DashboardUploadRecord): Promise<void> {
    await this.store.update((data) => {
      data.uploads ??= [];
      data.uploads.push(upload);
    });
  }

  async canReadAttachment(storageKey: string, user: AuthenticatedUser): Promise<boolean> {
    if (user.role === 'can-bo' || user.role === 'admin') return true;
    const data = await this.store.read();
    const uploadOwner = (data.uploads ?? []).find((upload) => upload.storageKey === storageKey)?.ownerUserId;
    if (uploadOwner === user.id) return true;

    return data.applications.some((application) =>
      application.ownerUserId === user.id
      && Array.isArray(application.attachments)
      && application.attachments.some((attachment: unknown) => (
        typeof attachment === 'object'
        && attachment !== null
        && (attachment as { storageKey?: unknown }).storageKey === storageKey
      )),
    );
  }
}
