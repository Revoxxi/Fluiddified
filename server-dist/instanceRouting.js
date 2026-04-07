export const PROXY_BACKEND_COOKIE = 'fluiddified_proxy';
export function parseCookieValue(cookieHeader, name) {
    if (!cookieHeader)
        return null;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const trimmed = part.trim();
        const eq = trimmed.indexOf('=');
        if (eq === -1)
            continue;
        const k = trimmed.slice(0, eq).trim();
        if (k !== name)
            continue;
        try {
            return decodeURIComponent(trimmed.slice(eq + 1).trim());
        }
        catch {
            return trimmed.slice(eq + 1).trim();
        }
    }
    return null;
}
export function resolveProxyBackend(req, config) {
    const fromCookie = parseCookieValue(req.headers.cookie, PROXY_BACKEND_COOKIE);
    if (fromCookie) {
        const found = config.instances.find((i) => i.id === fromCookie);
        if (found)
            return found;
    }
    return config.instances[0];
}
//# sourceMappingURL=instanceRouting.js.map