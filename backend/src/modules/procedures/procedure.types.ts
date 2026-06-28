export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'file'
  | 'textarea'
  | 'phone';

export interface ProcedureFieldOption {
  value: string;
  label: string;
}

export interface ProcedureField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  step?: number;
  placeholder?: string;
  options?: ProcedureFieldOption[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
  cccdKey?: string;
}

export interface Procedure {
  id: string;
  name: string;
  shortName: string;
  description: string;
  route: string;
  icon: string;
  category: string;
  processingTime: string;
  fee: string;
  fields: ProcedureField[];
  requiredDocs: string[];
  steps: string[];
  keywords: string[];
}

export interface ProcedureStore {
  schemaVersion: number;
  procedures: Procedure[];
}

export type ProcedureSummary = Omit<Procedure, 'fields'> & {
  fieldCount: number;
  stepCount: number;
};
