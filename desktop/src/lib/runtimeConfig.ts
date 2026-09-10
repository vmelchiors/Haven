const PUBLIC_API_URL = 'https://haven.vmelchior.tech';
const CONFIGURED_API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined)
  ?? (import.meta.env.PROD ? PUBLIC_API_URL : '')
).trim();

function normalizeOrigin(value?: string): string {
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

export const API_ORIGIN = normalizeOrigin(CONFIGURED_API_URL);

export function apiUrl(path: string): string {
  if (!path.startsWith('/') || !API_ORIGIN) return path;
  return `${API_ORIGIN}${path}`;
}

export function websocketUrl(path: string): string {
  const base = API_ORIGIN || window.location.origin;
  const url = new URL(path, `${base}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Resolves the LiveKit URL returned by the API.
 *
 * Production returns `/` because signaling is reverse-proxied by the public
 * Haven domain. Inside Tauri, window.location points at tauri.localhost, so a
 * normal relative URL would try to connect to the embedded webview itself.
 */
export function mediaServerUrl(value: string, baseOrigin = API_ORIGIN || window.location.origin): string {
  const base = baseOrigin;
  const url = new URL(value || '/', `${base}/`);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  return url.toString();
}

export function assetUrl(value?: string): string | undefined {
  if (!value || !value.startsWith('/')) return value;
  return apiUrl(value);
}

/**
 * The web client deliberately uses relative URLs so Vite/nginx can proxy them.
 * A packaged Tauri app has no reverse proxy, therefore requests for backend
 * resources must be redirected to the API origin injected during the build.
 */
export function installDesktopFetchBridge(): void {
  if (!API_ORIGIN || typeof window === 'undefined') return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      if (input.startsWith('/')) return nativeFetch(apiUrl(input), init);

      try {
        const parsed = new URL(input);
        if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/')) {
          return nativeFetch(apiUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`), init);
        }
      } catch {
        // Let the browser report malformed URLs with its normal error.
      }
    } else if (input instanceof URL && input.origin === window.location.origin) {
      return nativeFetch(apiUrl(`${input.pathname}${input.search}${input.hash}`), init);
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch;
}
