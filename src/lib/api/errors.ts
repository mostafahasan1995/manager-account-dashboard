/**
 * One error type for everything the API can do to us, so every screen can handle failure the same
 * way and every toast can show the correlation id the backend logged the failure under.
 */

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string | null;
  retryAfterSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly correlationId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.correlationId = init.correlationId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** The per-field messages a 400 carries, when it carries any. */
  get fieldErrors(): string[] {
    const details = this.details;
    if (typeof details !== 'object' || details === null) return [];
    const fields = (details as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) return [];
    return fields.filter((field): field is string => typeof field === 'string');
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** 5xx and network failures: worth retrying. A 4xx is not — it will fail identically. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

/** Raised when the browser could not reach the API at all (DNS, CORS, offline, connection reset). */
export const NETWORK_ERROR_CODE = 'NETWORK_UNREACHABLE';

export function networkError(baseUrl: string, cause?: unknown): ApiError {
  return new ApiError({
    status: 0,
    code: NETWORK_ERROR_CODE,
    message: `Could not reach the API at ${baseUrl}. Check that the backend is running and that this origin is allowed by its CORS configuration.`,
    details: cause instanceof Error ? { cause: cause.message } : undefined,
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The message to actually put in front of a person. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    const fields = error.fieldErrors;
    return fields.length > 0 ? `${error.message} (${fields.join('; ')})` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
