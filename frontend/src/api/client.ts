export const API_BASE_URL = 'http://localhost:3000/api';

interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      code?: string;
      message: string;
    }>;
  };
  requestId: string;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ApiFailure['error']['details'];
  public readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details: ApiFailure['error']['details'] = [],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

/**
 * Generic API client. It unwraps the backend response envelope and preserves
 * structured validation errors for form pages.
 */
export const apiClient = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => null) as ApiSuccess<T> | ApiFailure | null;

    if (!response.ok || !payload || payload.success === false) {
      const failure = payload && payload.success === false ? payload : null;
      throw new ApiClientError(
        failure?.error.message || `API request failed with status ${response.status}`,
        response.status,
        failure?.error.code,
        failure?.error.details,
        failure?.requestId,
      );
    }

    return payload.data;
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      console.error(`[API Client] Error calling ${url}:`, error);
    }
    throw error;
  }
};
