/**
 * HTTP client cho NestJS API (apps/api).
 *
 * Hỗ trợ cả Client Components ('use client') và Server Components / Route Handlers:
 * - `apiClient.*`: dùng trong Client Components — browser tự gửi cookie qua `credentials: 'include'`.
 * - `apiServerClient.*`: dùng trong Server Components — manually forward cookie header
 *   từ incoming request (Next.js `cookies()` helper).
 *
 * Response shape thống nhất với BE ResponseInterceptor:
 *   { success: true, data, meta? } | { success: false, error: { code, message, details? } }
 */

const DEFAULT_BASE = 'http://localhost:4000/api/v1';
const DEFAULT_RELATIVE = '/api/v1';

type ApiSuccess<T> = { success: true; data: T; meta?: unknown };
type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type RequestOptions = {
  /** Extra cookies to forward (server-side). */
  cookieHeader?: string;
  /** Body for non-GET methods. JSON-stringified automatically. */
  body?: unknown;
  /** Query string params (record). */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Next.js fetch options (revalidate, tags, etc.). */
  next?: { revalidate?: number | false; tags?: string[] };
  /** Pass-through cache option. */
  cache?: RequestCache;
};

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use relative path so requests go through Next.js rewrite.
    // This works behind any tunnel/reverse-proxy without CORS issues.
    return DEFAULT_RELATIVE;
  }
  // Server-side (Server Components, Route Handlers): call NestJS directly.
  // API_INTERNAL_URL is preferred; falls back to NEXT_PUBLIC_API_URL.
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = getBaseUrl();
  const combined = `${base}${path}`;

  const applyQuery = (u: string) => {
    if (!query) return u;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${u}?${qs}` : u;
  };

  // Absolute URL (server-side)
  if (combined.startsWith('http')) {
    const url = new URL(combined);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  // Relative URL (browser via rewrite)
  return applyQuery(combined);
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.cookieHeader) headers['Cookie'] = opts.cookieHeader;

  const init: RequestInit & { next?: RequestOptions['next'] } = {
    method,
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache,
  };
  if (opts.next) init.next = opts.next;

  const res = await fetch(buildUrl(path, opts.query), init);

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('INVALID_JSON', `Invalid JSON response from ${path}`, res.status);
  }

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, res.status, body.error.details);
  }
  return body.data;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};

/**
 * Server-side variant — auto forward cookies từ Next.js cookies() helper.
 * Usage trong Server Component:
 *   const user = await apiServerClient(await cookies()).get<User>('/me');
 */
export function apiServerClient(cookieStore: { toString(): string }) {
  const cookieHeader = cookieStore.toString();
  return {
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>('GET', path, { ...opts, cookieHeader }),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, { ...opts, body, cookieHeader }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, { ...opts, body, cookieHeader }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PUT', path, { ...opts, body, cookieHeader }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>('DELETE', path, { ...opts, cookieHeader }),
  };
}
