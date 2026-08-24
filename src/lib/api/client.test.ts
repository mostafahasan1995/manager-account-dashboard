import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';

import { api, buildQuery, configureApiClient, parseResponse, request } from './client';
import { ApiError } from './errors';

/**
 * The client is the single point every screen's data passes through, so these tests cover the four
 * things it owns: the envelope, the headers, the failure modes, and pagination metadata. A bug in
 * any of them is a bug in every screen at once.
 */

const url = (path: string) => `${config.apiBaseUrl}${path}`;

const envelope = (data: unknown, meta: Record<string, unknown> = {}) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'test-correlation', timestamp: '2026-08-21T10:00:00.000Z', ...meta },
});

describe('buildQuery', () => {
  it('drops undefined, null and empty values rather than sending them as strings', () => {
    expect(buildQuery({ a: 'x', b: undefined, c: null, d: '' })).toBe('?a=x');
  });

  it('comma-joins arrays, which is what the backend transform parses', () => {
    expect(buildQuery({ status: ['SUBMITTED', 'UNDER_REVIEW'] })).toBe(
      '?status=SUBMITTED%2CUNDER_REVIEW',
    );
  });

  it('omits empty arrays entirely', () => {
    expect(buildQuery({ status: [] })).toBe('');
  });

  it('serialises numbers and booleans', () => {
    expect(buildQuery({ limit: 20, unclaimedOnly: true })).toBe('?limit=20&unclaimedOnly=true');
  });

  it('returns an empty string for no params at all', () => {
    expect(buildQuery(undefined)).toBe('');
    expect(buildQuery({})).toBe('');
  });
});

describe('request', () => {
  const thing = z.object({ id: z.string() });

  it('unwraps data out of the envelope', async () => {
    server.use(http.get(url('/v1/thing'), () => HttpResponse.json(envelope({ id: 'abc' }))));
    await expect(request(thing, '/v1/thing')).resolves.toEqual({ id: 'abc' });
  });

  it('sends the bearer token from the configured provider', async () => {
    configureApiClient({ getToken: () => 'secret-token' });
    let seen: string | null = null;
    server.use(
      http.get(url('/v1/thing'), ({ request: received }) => {
        seen = received.headers.get('authorization');
        return HttpResponse.json(envelope({ id: 'abc' }));
      }),
    );

    await request(thing, '/v1/thing');
    expect(seen).toBe('Bearer secret-token');
  });

  it('omits the bearer header on an anonymous request', async () => {
    configureApiClient({ getToken: () => 'secret-token' });
    let seen: string | null = 'unset';
    server.use(
      http.get(url('/health/live'), ({ request: received }) => {
        seen = received.headers.get('authorization');
        return HttpResponse.json(envelope({ status: 'ok' }));
      }),
    );

    await request(z.object({ status: z.string() }), '/health/live', { anonymous: true });
    expect(seen).toBeNull();
  });

  it('sends an idempotency key when one is given', async () => {
    let seen: string | null = null;
    server.use(
      http.post(url('/v1/thing'), ({ request: received }) => {
        seen = received.headers.get('idempotency-key');
        return HttpResponse.json(envelope({ id: 'abc' }));
      }),
    );

    await request(thing, '/v1/thing', { method: 'POST', idempotencyKey: 'key-1' });
    expect(seen).toBe('key-1');
  });

  it('turns an error envelope into an ApiError carrying the code and correlation id', async () => {
    server.use(
      http.get(url('/v1/thing'), () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'DEPOSIT_NOT_FOUND', message: 'Deposit not found.' },
            meta: { correlationId: 'corr-9', timestamp: '2026-08-21T10:00:00.000Z' },
          },
          { status: 404 },
        ),
      ),
    );

    const error = await request(thing, '/v1/thing').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'DEPOSIT_NOT_FOUND',
      message: 'Deposit not found.',
      correlationId: 'corr-9',
    });
    expect((error as ApiError).isNotFound).toBe(true);
    expect((error as ApiError).isRetryable).toBe(false);
  });

  it('exposes the per-field messages a validation failure carries', async () => {
    server.use(
      http.post(url('/v1/thing'), () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'The request payload is invalid.',
              details: { fields: ['amount must be a decimal string'] },
            },
            meta: { correlationId: 'corr-1', timestamp: '2026-08-21T10:00:00.000Z' },
          },
          { status: 400 },
        ),
      ),
    );

    const error = (await request(thing, '/v1/thing', { method: 'POST' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;
    expect(error.fieldErrors).toEqual(['amount must be a decimal string']);
  });

  it('reports a 429 as retryable and keeps the retry-after header', async () => {
    server.use(
      http.get(url('/v1/thing'), () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'RATE_LIMITED', message: 'Too many requests.' },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 429, headers: { 'retry-after': '30' } },
        ),
      ),
    );

    const error = (await request(thing, '/v1/thing').catch((caught: unknown) => caught)) as ApiError;
    expect(error.isRateLimited).toBe(true);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.isRetryable).toBe(true);
  });

  it('calls the unauthorized hook exactly once on a 401, then throws', async () => {
    const onUnauthorized = vi.fn();
    configureApiClient({ onUnauthorized });
    server.use(
      http.get(url('/v1/thing'), () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHENTICATED', message: 'A bearer access token is required.' },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(request(thing, '/v1/thing')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('turns an unreachable API into a NETWORK_UNREACHABLE ApiError, not a raw TypeError', async () => {
    server.use(http.get(url('/v1/thing'), () => HttpResponse.error()));

    const error = (await request(thing, '/v1/thing').catch((caught: unknown) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK_UNREACHABLE');
    expect(error.status).toBe(0);
    expect(error.isRetryable).toBe(true);
    // The origin is the one fact that separates a blocked request from a dead server, and the
    // browser withholds it — so the message has to carry it.
    expect(error.message).toContain(window.location.origin);
    expect(error.message).toContain('MINI_APP_ORIGIN');
    expect(error.details).toMatchObject({ origin: window.location.origin });
  });

  it('survives a non-JSON body (a proxy error page) without throwing a parse error', async () => {
    server.use(
      http.get(url('/v1/thing'), () =>
        HttpResponse.text('<html>502 Bad Gateway</html>', { status: 502 }),
      ),
    );

    const error = (await request(thing, '/v1/thing').catch((caught: unknown) => caught)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('HTTP_502');
  });

  it('returns the body of a non-2xx when the caller accepts one — terminus answers 503 with data', async () => {
    server.use(
      http.get(url('/health/ready'), () =>
        HttpResponse.json(envelope({ status: 'error', error: { redis: { status: 'down' } } }), {
          status: 503,
        }),
      ),
    );

    const ready = await request(z.object({ status: z.string() }), '/health/ready', {
      anonymous: true,
      acceptErrorBody: true,
    });
    expect(ready.status).toBe('error');
  });
});

describe('pagination', () => {
  it('reads offset page metadata out of meta, where the backend puts it', async () => {
    server.use(
      http.get(url('/v1/rows'), () =>
        HttpResponse.json(
          envelope([{ id: 'a' }, { id: 'b' }], { total: 42, limit: 20, offset: 0, hasMore: true }),
        ),
      ),
    );

    const page = await api.page(z.object({ id: z.string() }), '/v1/rows');
    expect(page.data).toHaveLength(2);
    expect(page.meta).toMatchObject({ total: 42, limit: 20, offset: 0, hasMore: true });
  });

  it('reads cursor page metadata', async () => {
    server.use(
      http.get(url('/v1/rows'), () =>
        HttpResponse.json(envelope([{ id: 'a' }], { limit: 20, nextCursor: 'next', hasMore: true })),
      ),
    );

    const page = await api.cursorPage(z.object({ id: z.string() }), '/v1/rows');
    expect(page.meta.nextCursor).toBe('next');
  });

  it('treats a missing array as an empty page rather than crashing the screen', async () => {
    server.use(http.get(url('/v1/rows'), () => HttpResponse.json(envelope(null))));
    const page = await api.page(z.object({ id: z.string() }), '/v1/rows');
    expect(page.data).toEqual([]);
  });
});

describe('parseResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('returns the parsed value when the shape matches', () => {
    const schema = z.object({ id: z.string() });
    expect(parseResponse(schema, { id: 'a' }, 'test')).toEqual({ id: 'a' });
  });

  it('warns and passes the value through when the backend drifts, rather than blanking the screen', () => {
    const schema = z.object({ id: z.string() });
    const value = { id: 42 };

    expect(parseResponse(schema, value, 'GET /v1/thing')).toBe(value);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET /v1/thing'),
      expect.anything(),
    );
  });
});
