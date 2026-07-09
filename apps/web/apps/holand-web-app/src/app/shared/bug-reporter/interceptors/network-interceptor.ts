export interface NetworkLogEntry {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  timing: {
    start: number;
    end?: number;
    duration?: number;
  };
  timestamp: number;
  error?: string;
}

export type NetworkCallback = (log: NetworkLogEntry) => void;

export interface NetworkInterceptorOptions {
  maskPii?: boolean;
}

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-auth-token', 'x-api-key', 'set-cookie'];
const SENSITIVE_BODY_KEYS = ['password', 'token', 'secret', 'credit_card', 'ssn', 'api_key', 'access_token'];

let originalFetch: typeof fetch | null = null;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
let networkInterceptorActive = false;

const MAX_BODY_SIZE = 10 * 1024;

function truncateBody(body: unknown): string | undefined {
  if (!body) return undefined;
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  return str.length > MAX_BODY_SIZE ? str.slice(0, MAX_BODY_SIZE) + '...' : str;
}

export function maskSensitiveData(data: unknown, maskEnabled: boolean): unknown {
  if (!maskEnabled || data == null) return data;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(maskSensitiveData(parsed, true));
    } catch {
      return data.replace(/("(?:password|token|secret|api_key|access_token)"\s*:\s*")[^"]*(")/gi, '$1***$2');
    }
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, maskEnabled));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_BODY_KEYS.some((k) => lowerKey.includes(k))) {
        result[key] = '***';
      } else {
        result[key] = maskSensitiveData(value, maskEnabled);
      }
    }
    return result;
  }

  return data;
}

function maskHeaders(headers: Record<string, string> | undefined, maskEnabled: boolean): Record<string, string> | undefined {
  if (!headers || !maskEnabled) return headers;
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '***' : value;
  }
  return masked;
}

export function startNetworkInterception(
  onLog: NetworkCallback,
  options: NetworkInterceptorOptions = {}
): () => void {
  if (networkInterceptorActive) {
    return () => undefined;
  }
  networkInterceptorActive = true;

  const maskPii = options.maskPii ?? true;

  originalFetch = window.fetch.bind(window);
  originalXHROpen = XMLHttpRequest.prototype.open;
  originalXHRSend = XMLHttpRequest.prototype.send;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    const start = Date.now();

    const entry: NetworkLogEntry = {
      method,
      url,
      timing: { start },
      timestamp: start,
    };

    if (init?.body) {
      entry.requestBody = truncateBody(maskSensitiveData(init.body, maskPii));
    }

    try {
      const response = await originalFetch!(input, init);
      const end = Date.now();
      entry.status = response.status;
      entry.statusText = response.statusText;
      entry.timing.end = end;
      entry.timing.duration = end - start;

      const clonedResponse = response.clone();
      try {
        const text = await clonedResponse.text();
        entry.responseBody = truncateBody(maskSensitiveData(text, maskPii));
      } catch {
        /* ignore */
      }

      onLog(entry);
      return response;
    } catch (err) {
      const end = Date.now();
      entry.timing.end = end;
      entry.timing.duration = end - start;
      entry.error = err instanceof Error ? err.message : String(err);
      onLog(entry);
      throw err;
    }
  };

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    const urlStr = typeof url === 'string' ? url : url.href;
    const entry: NetworkLogEntry = {
      method,
      url: urlStr,
      timing: { start: Date.now() },
      timestamp: Date.now(),
    };

    (this as XMLHttpRequest & { __bugReportEntry?: NetworkLogEntry }).__bugReportEntry = entry;

    this.addEventListener('loadend', () => {
      const end = Date.now();
      entry.status = this.status;
      entry.statusText = this.statusText;
      entry.timing.end = end;
      entry.timing.duration = end - entry.timing.start;

      if (this.responseType === '' || this.responseType === 'text') {
        entry.responseBody = truncateBody(maskSensitiveData(this.responseText, maskPii));
      }

      onLog(entry);
    });

    this.addEventListener('error', () => {
      const end = Date.now();
      entry.timing.end = end;
      entry.timing.duration = end - entry.timing.start;
      entry.error = 'Network request failed';
      onLog(entry);
    });

    return originalXHROpen!.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const entry = (this as XMLHttpRequest & { __bugReportEntry?: NetworkLogEntry }).__bugReportEntry;
    if (entry && body) {
      entry.requestBody = truncateBody(maskSensitiveData(body, maskPii));
    }
    return originalXHRSend!.call(this, body);
  };

  return () => {
    if (!networkInterceptorActive) return;
    networkInterceptorActive = false;
    if (originalFetch) window.fetch = originalFetch;
    if (originalXHROpen) XMLHttpRequest.prototype.open = originalXHROpen;
    if (originalXHRSend) XMLHttpRequest.prototype.send = originalXHRSend;
    originalFetch = null;
    originalXHROpen = null;
    originalXHRSend = null;
  };
}
