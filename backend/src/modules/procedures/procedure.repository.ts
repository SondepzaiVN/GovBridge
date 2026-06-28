import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';
import type { Procedure, ProcedureStore } from './procedure.types.js';

export class ProcedureRepository {
  private readonly store: JsonFileStore<ProcedureStore>;

  constructor(dataDirectory: string) {
    this.store = new JsonFileStore(path.join(dataDirectory, 'procedures.json'), {
      schemaVersion: 1,
      procedures: [],
    });
  }

  async findAll(): Promise<Procedure[]> {
    const data = await this.store.read();
    return data.procedures;
  }

  async findById(id: string): Promise<Procedure | null> {
    const procedures = await this.findAll();
    return procedures.find((procedure) => procedure.id === id) ?? null;
  }

  async findByRoute(route: string): Promise<Procedure | null> {
    const procedures = await this.findAll();
    const normalizedRoute = route.replace(/\/buoc-\d+\/?$/, '');
    return procedures.find((procedure) => procedure.route === normalizedRoute) ?? null;
  }
}
