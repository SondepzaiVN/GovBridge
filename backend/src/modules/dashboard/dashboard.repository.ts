import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DashboardApplication = Record<string, any>;

export type DashboardStore = {
  applications: DashboardApplication[];
};

export class DashboardRepository {
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

  async insert(application: DashboardApplication): Promise<DashboardApplication> {
    return this.store.update((data) => {
      const clientSubmissionId = typeof application.clientSubmissionId === 'string'
        ? application.clientSubmissionId.trim()
        : '';
      if (clientSubmissionId) {
        const existing = data.applications.find((app) => app.clientSubmissionId === clientSubmissionId);
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
}
