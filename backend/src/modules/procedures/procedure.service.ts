import { NotFoundError } from '../../common/errors/app-error.js';
import { normalizeText } from '../../common/utils/normalize-text.js';
import { ProcedureRepository } from './procedure.repository.js';
import type { Procedure, ProcedureSummary } from './procedure.types.js';

interface ListProcedureFilters {
  search?: string;
  category?: string;
  includeFields: boolean;
}

export class ProcedureService {
  constructor(private readonly repository: ProcedureRepository) {}

  async list(filters: ListProcedureFilters): Promise<Array<Procedure | ProcedureSummary>> {
    let procedures = await this.repository.findAll();

    if (filters.category) {
      const category = normalizeText(filters.category);
      procedures = procedures.filter((procedure) => normalizeText(procedure.category) === category);
    }

    if (filters.search) {
      const search = normalizeText(filters.search);
      procedures = procedures.filter((procedure) => {
        const searchable = [
          procedure.name,
          procedure.shortName,
          procedure.description,
          procedure.category,
          ...procedure.keywords,
        ].map(normalizeText);
        return searchable.some((value) => value.includes(search));
      });
    }

    if (filters.includeFields) return procedures;

    return procedures.map(({ fields, ...procedure }) => ({
      ...procedure,
      fieldCount: fields.length,
      stepCount: Math.max(1, ...fields.map((field) => field.step ?? 1)),
    }));
  }

  async getById(id: string): Promise<Procedure> {
    const procedure = await this.repository.findById(id);
    if (!procedure) throw new NotFoundError('Không tìm thấy thủ tục "' + id + '".');
    return procedure;
  }
}
