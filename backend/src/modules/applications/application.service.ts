import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import type { ProcedureRepository } from '../procedures/procedure.repository.js';
import type { ApplicationRepository } from './application.repository.js';
import type { ApplicationRecord, SubmitApplicationInput } from './application.types.js';
import { validateApplicationData } from './application-validator.js';

const createApplicationId = (): string => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'HS-' + day + '-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
};

export class ApplicationService {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly procedures: ProcedureRepository,
  ) {}

  async submit(input: SubmitApplicationInput): Promise<ApplicationRecord> {
    const procedure = await this.procedures.findById(input.serviceId);
    if (!procedure) throw new NotFoundError('Không tìm thấy thủ tục "' + input.serviceId + '".');

    const validationDetails = validateApplicationData(procedure, input.data);
    if (validationDetails.length > 0) {
      throw new ValidationError('Hồ sơ chưa hợp lệ.', validationDetails);
    }

    const application: ApplicationRecord = {
      id: createApplicationId(),
      serviceId: input.serviceId,
      status: 'RECEIVED',
      data: input.data,
      receivedAt: new Date().toISOString(),
      schemaVersion: 1,
      ...(input.submittedAt ? { clientSubmittedAt: input.submittedAt } : {}),
    };

    return this.applications.insert(application);
  }

  async getById(id: string): Promise<ApplicationRecord> {
    const application = await this.applications.findById(id);
    if (!application) throw new NotFoundError('Không tìm thấy hồ sơ "' + id + '".');
    return application;
  }
}
