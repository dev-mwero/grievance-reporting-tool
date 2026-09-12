const BASE = "/api";

/** Error thrown for non-OK API responses, carrying the server message and field errors. */
export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = "ApiClientError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

let authFailedListeners: Array<() => void> = [];

/**
 * Register a callback invoked when a session cannot be refreshed (e.g. the
 * user is signed out). Runs after a failed `/auth/refresh`.
 */
export function onAuthFailure(cb: () => void) {
  authFailedListeners.push(cb);
  return () => {
    authFailedListeners = authFailedListeners.filter((fn) => fn !== cb);
  };
}

function emitAuthFailure() {
  for (const cb of authFailedListeners) cb();
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");

  let res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } else {
      emitAuthFailure();
    }
  }

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: T;
    errors?: Record<string, string[]>;
  };

  if (!res.ok || payload.success === false) {
    throw new ApiClientError(
      res.status,
      payload.message ?? "Request failed",
      payload.errors,
    );
  }

  return payload.data as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: "GET", signal });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/** react-query default queryFn: `queryKey[0]` is the path. */
export async function queryFn<T>({
  signal,
  queryKey,
}: {
  queryKey: readonly unknown[];
  signal?: AbortSignal;
}) {
  const [path, params] = queryKey as [
    string,
    Record<string, string | number | boolean | undefined>?,
  ];
  let url = path;
  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }
  return apiGet<T>(url, signal);
}

/** Parse a form/JSON response `errors` object into a flat display message. */
export function formatApiErrors(
  errors: Record<string, string[]> | undefined,
): string {
  if (!errors) return "";
  return Object.entries(errors)
    .flatMap(([, messages]) => messages)
    .join(" ");
}
