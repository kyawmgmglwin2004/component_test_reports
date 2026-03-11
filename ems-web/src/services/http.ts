// src/services/http.ts
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Base URL for your API Gateway (stage URL).
 * Example: https://xxxxxx.execute-api.ap-northeast-1.amazonaws.com
 */
const BASE = (import.meta.env.VITE_API_BASE_URL || '').toString().trim();

/**
 * Global timeout for all requests (ms).
 */
const DEFAULT_TIMEOUT_MS = 15_000;

const CONFIG = {
  tokenSource:
    ((import.meta.env.VITE_API_TOKEN_SOURCE as 'id' | 'access' | undefined) ??
      'id') as 'id' | 'access',
  authHeaderPrefix:
    import.meta.env.VITE_API_AUTH_BEARER === 'true' ? 'Bearer ' : '',
};

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = status;
    this.data = data;
  }
}


function normalizeMessage(candidate: unknown, fallback: string): string {
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  return fallback;
}

function buildUrl(pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${BASE}${pathOrUrl}`;
}

function isJsonContentType(headers: Headers): boolean {
  const ct = headers.get('content-type') || headers.get('Content-Type') || '';
  return ct.toLowerCase().includes('application/json');
}

async function readJsonOrText(
  res: Response
): Promise<{ json?: unknown; text?: string }> {
  const raw = await res.text().catch(() => '');
  if (!raw) return {};
  if (isJsonContentType(res.headers)) {
    try {
      return { json: JSON.parse(raw), text: raw };
    } catch {
      // keep text if JSON parse fails
    }
  }
  return { text: raw };
}

async function authHeaders(
  method: string,
  init?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(init);

  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    !headers.has('Content-Type') &&
    !headers.has('content-type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const { tokens } = await fetchAuthSession();
  const token =
    CONFIG.tokenSource === 'access'
      ? tokens?.accessToken?.toString()
      : tokens?.idToken?.toString();

  if (token) {
    headers.set('Authorization', `${CONFIG.authHeaderPrefix}${token}`);
  }

  return headers;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const hasAbortTimeout = typeof (AbortSignal as unknown as { timeout?: unknown }).timeout === 'function';
  if (hasAbortTimeout) {
    const signal = (AbortSignal as unknown as { timeout: (n: number) => AbortSignal }).timeout(ms);
    return fetch(input, { ...init, signal });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}


async function coreGet<T>(
  pathOrUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<T> {
  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: await authHeaders('GET', init?.headers),
        ...init,
      },
      timeoutMs
    );

    const { json, text } = await readJsonOrText(res);

    if (!res.ok) {
      const raw =
        (json &&
          typeof json === 'object' &&
          'message' in (json as object) &&
          (json as Record<string, unknown>).message) ||
        (json &&
          typeof json === 'object' &&
          'error' in (json as object) &&
          (json as Record<string, unknown>).error) ||
        text;
      const message = normalizeMessage(raw, `HTTP ${res.status}`);
      throw new HttpError(res.status, message, json ?? text);
    }

    if (json !== undefined) return json as T;

    if (text) {
      try {
        return JSON.parse(text) as T;
      } catch {
        // swallow
      }
    }

    return {} as T;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  }
}

async function corePost<T>(
  pathOrUrl: string,
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<T> {
  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: await authHeaders('POST', init?.headers),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        ...init,
      },
      timeoutMs
    );

    const { json, text } = await readJsonOrText(res);

    if (!res.ok) {
      const raw =
        (json &&
          typeof json === 'object' &&
          'message' in (json as object) &&
          (json as Record<string, unknown>).message) ||
        (json &&
          typeof json === 'object' &&
          'error' in (json as object) &&
          (json as Record<string, unknown>).error) ||
        text;
      const message = normalizeMessage(raw, `HTTP ${res.status}`);
      throw new HttpError(res.status, message, json ?? text);
    }

    return (json ?? ({} as T)) as T;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  }
}

async function corePut<T>(
  pathOrUrl: string,
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<T> {
  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'PUT',
        headers: await authHeaders('PUT', init?.headers),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        ...init,
      },
      timeoutMs
    );

    const { json, text } = await readJsonOrText(res);

    if (!res.ok) {
      const raw =
        (json &&
          typeof json === 'object' &&
          'message' in (json as object) &&
          (json as Record<string, unknown>).message) ||
        (json &&
          typeof json === 'object' &&
          'error' in (json as object) &&
          (json as Record<string, unknown>).error) ||
        text;
      const message = normalizeMessage(raw, `HTTP ${res.status}`);
      throw new HttpError(res.status, message, json ?? text);
    }

    return (json ?? ({} as T)) as T;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  }
}

async function coreDelete<T = unknown>(
  pathOrUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<{ data: T; status: number; headers: Headers }> {
  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'DELETE',
        headers: await authHeaders('DELETE', init?.headers),
        ...init,
      },
      timeoutMs
    );

    const { json, text } = await readJsonOrText(res);

    if (!res.ok) {
      const raw =
        (json &&
          typeof json === 'object' &&
          'message' in (json as object) &&
          (json as Record<string, unknown>).message) ||
        (json &&
          typeof json === 'object' &&
          'error' in (json as object) &&
          (json as Record<string, unknown>).error) ||
        text;
      const message = normalizeMessage(raw, `HTTP ${res.status}`);
      throw new HttpError(res.status, message, json ?? text);
    }

    const data = (json ?? ({} as T)) as T;
    return { data, status: res.status, headers: res.headers };
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  }
}

async function corePostBlob(
  pathOrUrl: string,
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<{ data: Blob; status: number; headers: Headers }> {
  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: await authHeaders('POST', init?.headers),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        ...init,
      },
      timeoutMs
    );

    if (!res.ok) {
      let message: string | undefined;
      try {
        const ct =
          res.headers.get('content-type') ||
          res.headers.get('Content-Type') ||
          '';
        if (ct.toLowerCase().includes('application/json')) {
          const err = (await res.json()) as {
            code?: unknown;
            message?: unknown;
            error?: unknown;
          };
          message =
            (err?.code === 'E0006'
              ? 'CSVダウンロード対象の施設が選択されていません。'
              : (err?.message as string)) ||
            (err?.error as string) ||
            (err?.code as string);
        } else {
          message = await res.text();
        }
      } catch {
        // ignore parse errors
      }
      throw new HttpError(res.status, normalizeMessage(message, `HTTP ${res.status}`));
    }

    const blob = await res.blob();
    return { data: blob, status: res.status, headers: res.headers };
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  }
}


export function apiGet<T>(path: string): Promise<T>;
export function apiGet<T>(path: string, init: RequestInit): Promise<T>;
export function apiGet<T>(
  path: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<T>;
export function apiGet<T>(
  path: string,
  arg2?: number | RequestInit,
  arg3?: RequestInit
): Promise<T> {
  if (typeof arg2 === 'number') return coreGet<T>(path, arg2, arg3);
  return coreGet<T>(path, DEFAULT_TIMEOUT_MS, arg2);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T>;
export function apiPost<T>(
  path: string,
  body: unknown,
  init: RequestInit
): Promise<T>;
export function apiPost<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
  init?: RequestInit
): Promise<T>;
export function apiPost<T>(
  path: string,
  body?: unknown,
  arg3?: number | RequestInit,
  arg4?: RequestInit
): Promise<T> {
  if (typeof arg3 === 'number') return corePost<T>(path, body, arg3, arg4);
  return corePost<T>(path, body, DEFAULT_TIMEOUT_MS, arg3);
}

export function apiPut<T>(path: string, body?: unknown): Promise<T>;
export function apiPut<T>(
  path: string,
  body: unknown,
  init: RequestInit
): Promise<T>;
export function apiPut<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
  init?: RequestInit
): Promise<T>;
export function apiPut<T>(
  path: string,
  body?: unknown,
  arg3?: number | RequestInit,
  arg4?: RequestInit
): Promise<T> {
  if (typeof arg3 === 'number') return corePut<T>(path, body, arg3, arg4);
  return corePut<T>(path, body, DEFAULT_TIMEOUT_MS, arg3);
}

export function apiDelete<T = unknown>(
  path: string
): Promise<{ data: T; status: number; headers: Headers }>;
export function apiDelete<T = unknown>(
  path: string,
  init: RequestInit
): Promise<{ data: T; status: number; headers: Headers }>;
export function apiDelete<T = unknown>(
  path: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<{ data: T; status: number; headers: Headers }>;
export function apiDelete<T = unknown>(
  path: string,
  arg2?: number | RequestInit,
  arg3?: RequestInit
): Promise<{ data: T; status: number; headers: Headers }> {
  if (typeof arg2 === 'number') return coreDelete<T>(path, arg2, arg3);
  return coreDelete<T>(path, DEFAULT_TIMEOUT_MS, arg2);
}

export function apiPostBlob(
  path: string,
  body?: unknown
): Promise<{ data: Blob; status: number; headers: Headers }>;
export function apiPostBlob(
  path: string,
  body: unknown,
  init: RequestInit
): Promise<{ data: Blob; status: number; headers: Headers }>;
export function apiPostBlob(
  path: string,
  body: unknown,
  timeoutMs: number,
  init?: RequestInit
): Promise<{ data: Blob; status: number; headers: Headers }>;
export function apiPostBlob(
  path: string,
  body?: unknown,
  arg3?: number | RequestInit,
  arg4?: RequestInit
): Promise<{ data: Blob; status: number; headers: Headers }> {
  if (typeof arg3 === 'number') return corePostBlob(path, body, arg3, arg4);
  return corePostBlob(path, body, DEFAULT_TIMEOUT_MS, arg3);
}
