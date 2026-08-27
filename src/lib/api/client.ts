import type { z } from 'zod';

import { config } from '@/config';
import type { CursorPaginated, Paginated } from '@/types/api';
import { cursorMetaSchema, pageMetaSchema } from '@/types/api';

import { ApiError, networkError } from './errors';

/**
 * The single place this app talks to the backend.
 *
 * It owns four things nobody else should have to think about:
 *   1. the response envelope (`{ success, data, error, meta }`) — features receive `data`;
 *   2. the bearer token, the tenant header and the correlation id;
 *   3. turning any failure — HTTP, envelope, or network — into one `ApiError`;
 *   4. page metadata, which the backend puts in `meta` rather than in `data`.
 *
 * Auth is injected rather than imported, so this module has no dependency on React or on the auth
 * store — which is what lets every test drive it directly.
 */

export type TokenProvider = () => string | null;
export type UnauthorizedHandler = (error: ApiError) => void;
export type TenantProvider = () => string | null;

interface ClientHooks {
  getToken: TokenProvider;
  getTenantId: TenantProvider;
  onUnauthorized: UnauthorizedHandler;
}

const hooks: ClientHooks = {
  getToken: () => null,
  getTenantId: () => null,
  onUnauthorized: () => undefined,
};

/** Wired once, at app start, by the auth provider. */
export function configureApiClient(next: Partial<ClientHooks>): void {
  Object.assign(hooks, next);
}

/** Test helper: puts the hooks back to their inert defaults. */
export function resetApiClient(): void {
  hooks.getToken = () => null;
  hooks.getTenantId = () => null;
  hooks.onUnauthorized = () => undefined;
}

export type QueryValue =
  string | number | boolean | readonly string[] | readonly number[] | null | undefined;

/**
 * `{ status: ['SUBMITTED','UNDER_REVIEW'], limit: 20, unclaimedOnly: undefined }`
 *   -> `?status=SUBMITTED,UNDER_REVIEW&limit=20`
 *
 * Arrays are comma-joined because that is what the backend's `@Transform(toStatusArray)` parses,
 * and `undefined` is dropped rather than sent as the string "undefined" — which would fail
 * validation with `forbidNonWhitelisted` on the other side.
 */
export function buildQuery(params: Record<string, QueryValue> | undefined): string {
  if (params === undefined) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

export interface RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: TBody;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Sent as `Idempotency-Key`. The backend replays the original result for a repeated key. */
  idempotencyKey?: string;
  /** Skip the bearer header — only the two public routes (`/health/*`, login) use this. */
  anonymous?: boolean;
  /** Return the parsed body even on a non-2xx. Terminus readiness answers 503 with a real body. */
  acceptErrorBody?: boolean;
}

interface Envelope {
  success?: unknown;
  data?: unknown;
  error?: unknown;
  meta?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function readCorrelationId(response: Response, meta: unknown): string | null {
  const header = response.headers.get('x-correlation-id');
  if (header !== null && header.length > 0) return header;
  if (isRecord(meta) && typeof meta.correlationId === 'string') return meta.correlationId;
  return null;
}

function readRetryAfter(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

function buildHeaders(options: RequestOptions, hasBody: boolean): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (hasBody) headers.set('Content-Type', 'application/json');

  if (options.anonymous !== true) {
    const token = hooks.getToken();
    if (token !== null && token.length > 0) headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.idempotencyKey !== undefined) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  // Off by default. See docs/API-CONTRACT.md section 5 — the backend does not read this yet.
  if (config.tenantHeaderEnabled) {
    const tenantId = hooks.getTenantId();
    if (tenantId !== null && tenantId.length > 0) headers.set('X-Tenant-Id', tenantId);
  }

  return headers;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A proxy error page, a gateway timeout, an HTML 502. Surface the text, not a parse error.
    return { __raw: text };
  }
}

function errorFromEnvelope(response: Response, payload: unknown): ApiError {
  const envelope = isRecord(payload) ? (payload as Envelope) : {};
  const error = isRecord(envelope.error) ? envelope.error : null;

  const code = typeof error?.code === 'string' ? error.code : `HTTP_${response.status}`;
  const message =
    typeof error?.message === 'string'
      ? error.message
      : response.statusText || `Request failed with status ${response.status}`;

  return new ApiError({
    status: response.status,
    code,
    message,
    details: error?.details,
    correlationId: readCorrelationId(response, envelope.meta),
    retryAfterSeconds: readRetryAfter(response),
  });
}

/** Raw request: returns the whole envelope so paginated callers can read `meta`. */
async function requestEnvelope(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: unknown; meta: unknown; response: Response }> {
  const { method = 'GET', body, query, signal } = options;
  const url = `${config.apiBaseUrl}${path}${buildQuery(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: buildHeaders(options, body !== undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (cause) {
    // An aborted request is the caller's own doing (a superseded query, an unmounted screen).
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw networkError(config.apiBaseUrl, cause);
  }

  const payload = await readJson(response);

  if (!response.ok && options.acceptErrorBody !== true) {
    const error = errorFromEnvelope(response, payload);
    // A 401 means the token is gone or expired. Tell the auth layer once, from here, so no screen
    // has to remember to — and so a stale token cannot sit in storage producing 401s forever.
    if (error.isUnauthenticated) hooks.onUnauthorized(error);
    throw error;
  }

  const envelope = isRecord(payload) ? (payload as Envelope) : {};
  // `data` is present on every enveloped response; a body without it (terminus, a raw 503 page) is
  // returned as-is so the caller still sees what the server actually said.
  const data = 'data' in envelope ? envelope.data : payload;
  return { data, meta: envelope.meta, response };
}

/**
 * Validate a response against its schema.
 *
 * Deliberately NOT `schema.parse`: a backend that adds an unexpected shape must not blank the
 * screen a cashier is working in. Drift is loud in the console and in tests, and the raw value
 * still reaches the UI, where a missing optional renders as an em dash rather than as a crash.
 */
export function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  console.warn(
    `[api] ${label} did not match the expected shape. The backend contract may have changed.`,
    result.error.issues,
  );
  return value as T;
}

export async function request<T>(
  schema: z.ZodType<T>,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { data } = await requestEnvelope(path, options);
  return parseResponse(schema, data, `${options.method ?? 'GET'} ${path}`);
}

/** For endpoints that answer 204 / an empty body. */
export async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await requestEnvelope(path, options);
}

/** Offset-paginated: `data` is the rows, `meta` carries `{ total, limit, offset, hasMore }`. */
export async function requestPage<T>(
  schema: z.ZodType<T>,
  path: string,
  options: RequestOptions = {},
): Promise<Paginated<T>> {
  const { data, meta } = await requestEnvelope(path, options);
  const rows = Array.isArray(data) ? data : [];
  const label = `GET ${path}`;
  return {
    data: rows.map((row) => parseResponse(schema, row, label)),
    meta: parseResponse(pageMetaSchema, meta, `${label} meta`),
  };
}

/** Cursor-paginated: `meta` carries `{ limit, nextCursor, hasMore }`. */
export async function requestCursorPage<T>(
  schema: z.ZodType<T>,
  path: string,
  options: RequestOptions = {},
): Promise<CursorPaginated<T>> {
  const { data, meta } = await requestEnvelope(path, options);
  const rows = Array.isArray(data) ? data : [];
  const label = `GET ${path}`;
  return {
    data: rows.map((row) => parseResponse(schema, row, label)),
    meta: parseResponse(cursorMetaSchema, meta, `${label} meta`),
  };
}

/**
 * Fetch a protected binary (a deposit proof image) as an object URL.
 *
 * `<img src>` cannot carry an Authorization header, and the proof route is bearer-protected, so the
 * bytes are fetched here and handed to the DOM as a blob URL. The caller MUST revoke it — every
 * component that uses this does so in its cleanup.
 */
export async function fetchBlobUrl(path: string, signal?: AbortSignal): Promise<string> {
  const token = hooks.getToken();
  const headers = new Headers();
  if (token !== null && token.length > 0) headers.set('Authorization', `Bearer ${token}`);
  if (config.tenantHeaderEnabled) {
    const tenantId = hooks.getTenantId();
    if (tenantId !== null && tenantId.length > 0) headers.set('X-Tenant-Id', tenantId);
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      headers,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw networkError(config.apiBaseUrl, cause);
  }

  if (!response.ok) {
    const error = errorFromEnvelope(response, await readJson(response));
    if (error.isUnauthenticated) hooks.onUnauthorized(error);
    throw error;
  }

  return URL.createObjectURL(await response.blob());
}

export const api = {
  get: <T>(schema: z.ZodType<T>, path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request(schema, path, { ...options, method: 'GET' }),

  post: <T>(schema: z.ZodType<T>, path: string, options?: Omit<RequestOptions, 'method'>) =>
    request(schema, path, { ...options, method: 'POST' }),

  patch: <T>(schema: z.ZodType<T>, path: string, options?: Omit<RequestOptions, 'method'>) =>
    request(schema, path, { ...options, method: 'PATCH' }),

  delete: <T>(schema: z.ZodType<T>, path: string, options?: Omit<RequestOptions, 'method'>) =>
    request(schema, path, { ...options, method: 'DELETE' }),

  page: requestPage,
  cursorPage: requestCursorPage,
  void: requestVoid,
  blobUrl: fetchBlobUrl,
};
