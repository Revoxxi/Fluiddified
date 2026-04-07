const toInt = (val, fallback) => {
    if (!val)
        return fallback;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : n;
};
function optionalApiKey(raw) {
    if (typeof raw !== 'string')
        return undefined;
    const t = raw.trim();
    return t.length ? t : undefined;
}
function normalizeBackend(raw, index) {
    const id = typeof raw.id === 'string' ? raw.id : null;
    const moonrakerHost = typeof raw.moonrakerHost === 'string' ? raw.moonrakerHost : null;
    const moonrakerPort = typeof raw.moonrakerPort === 'number' ? raw.moonrakerPort : null;
    const moonrakerApiKey = optionalApiKey(raw.moonrakerApiKey) ??
        optionalApiKey(process.env.MOONRAKER_API_KEY ?? process.env.FLUIDDIFIED_MOONRAKER_API_KEY);
    const cameraHost = typeof raw.cameraHost === 'string' ? raw.cameraHost : moonrakerHost;
    const cameraPort = typeof raw.cameraPort === 'number' ? raw.cameraPort : null;
    const cameraEnabled = raw.cameraEnabled !== false;
    if (!id || !moonrakerHost || moonrakerPort == null) {
        console.warn(`[config] Skipping invalid proxy instance at index ${index}`);
        return null;
    }
    return {
        id,
        moonrakerHost,
        moonrakerPort,
        moonrakerApiKey,
        cameraHost: cameraHost ?? moonrakerHost,
        cameraPort: cameraPort ?? toInt(process.env.CAMERA_PORT, 8080),
        cameraEnabled
    };
}
function parseInstancesFromEnv() {
    const json = process.env.FLUIDDIFIED_INSTANCES;
    if (!json?.trim())
        return undefined;
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) {
            console.warn('[config] FLUIDDIFIED_INSTANCES must be a JSON array');
            return undefined;
        }
        const out = [];
        for (let i = 0; i < parsed.length; i++) {
            const row = parsed[i];
            if (!row || typeof row !== 'object')
                continue;
            const b = normalizeBackend(row, i);
            if (b)
                out.push(b);
        }
        return out.length ? out : undefined;
    }
    catch (e) {
        console.warn('[config] Failed to parse FLUIDDIFIED_INSTANCES:', e);
        return undefined;
    }
}
function defaultSingleBackend() {
    const moonrakerApiKey = optionalApiKey(process.env.MOONRAKER_API_KEY ?? process.env.FLUIDDIFIED_MOONRAKER_API_KEY);
    return {
        id: process.env.FLUIDDIFIED_DEFAULT_BACKEND_ID ?? 'default',
        moonrakerHost: process.env.MOONRAKER_HOST ?? '127.0.0.1',
        moonrakerPort: toInt(process.env.MOONRAKER_PORT, 7125),
        moonrakerApiKey,
        cameraHost: process.env.CAMERA_HOST ?? '127.0.0.1',
        cameraPort: toInt(process.env.CAMERA_PORT, 8080),
        cameraEnabled: process.env.CAMERA_ENABLED !== 'false'
    };
}
export function loadConfig() {
    const fromEnv = parseInstancesFromEnv();
    const instances = fromEnv?.length ? fromEnv : [defaultSingleBackend()];
    const ids = new Set();
    for (const b of instances) {
        if (ids.has(b.id)) {
            throw new Error(`Duplicate Fluiddified proxy backend id: ${b.id}`);
        }
        ids.add(b.id);
    }
    return {
        port: toInt(process.env.FLUIDDIFIED_PORT, 4000),
        instances,
        rateLimitPerMinute: toInt(process.env.RATE_LIMIT, 300)
    };
}
//# sourceMappingURL=proxyConfig.js.map