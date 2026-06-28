export type ApplicationStatus = 'RECEIVED';

export interface ApplicationRecord {
  id: string;
  serviceId: string;
  status: ApplicationStatus;
  data: Record<string, string>;
  receivedAt: string;
  clientSubmittedAt?: string;
  schemaVersion: number;
}

export interface ApplicationStore {
  schemaVersion: number;
  applications: ApplicationRecord[];
}

export interface SubmitApplicationInput {
  serviceId: string;
  submittedAt?: string;
  data: Record<string, string>;
}
