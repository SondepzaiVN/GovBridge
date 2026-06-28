import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';
import type { ApplicationRecord, ApplicationStore } from './application.types.js';

export class ApplicationRepository {
  private readonly store: JsonFileStore<ApplicationStore>;

  constructor(dataDirectory: string) {
    this.store = new JsonFileStore(path.join(dataDirectory, 'applications.json'), {
      schemaVersion: 1,
      applications: [],
    });
  }

  async insert(application: ApplicationRecord): Promise<ApplicationRecord> {
    return this.store.update((data) => {
      data.applications.push(application);
      return application;
    });
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const data = await this.store.read();
    return data.applications.find((application) => application.id === id) ?? null;
  }
}
