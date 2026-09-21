/**
 * The browser's side of this application's API.
 *
 * Every screen reads through here. Two things it does that a bare `fetch`
 * does not:
 *
 * 1. **Turns an error body into an `Error` with the message the server wrote.**
 *    The route handler already produced "Something already uses that slug"; a
 *    client that throws "Request failed with status 409" has thrown that away
 *    and left the form to invent a worse sentence.
 * 2. **Carries `status` on the thrown error**, so React Query can decline to
 *    retry a 403 and a form can put a 422's field messages beside its inputs.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    /** Field-keyed messages from a 422. */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiClientError(
      error?.message ?? `That did not work (${response.status}).`,
      response.status,
      error?.code ?? 'UNKNOWN',
      response.status === 422
        ? (error?.details as Record<string, string> | undefined)
        : undefined,
    );
  }

  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/** A query string from a record, dropping empties so no `?q=&status=`. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
