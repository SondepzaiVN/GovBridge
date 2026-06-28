import { apiClient } from './client';

export interface SubmitApplicationPayload {
  serviceId: string;
  submittedAt: string;
  data: Record<string, string>;
}

export interface ApplicationRecord {
  id: string;
  serviceId: string;
  status: 'RECEIVED';
  data: Record<string, string>;
  receivedAt: string;
  clientSubmittedAt?: string;
  schemaVersion: number;
}

export const applicationService = {
  submit: (payload: SubmitApplicationPayload): Promise<ApplicationRecord> =>
    apiClient<ApplicationRecord>('/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
