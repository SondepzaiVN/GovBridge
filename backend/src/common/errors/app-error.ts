export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(503, 'PROVIDER_NOT_CONFIGURED', message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string) {
    super(502, 'EXTERNAL_SERVICE_ERROR', message);
  }
}
