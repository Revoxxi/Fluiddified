import { jwtDecode } from 'jwt-decode';
import { hasMinRole } from './roles';
import { resolveProxyBackend } from './instanceRouting';
const roleCache = new Map();
const ROLE_CACHE_TTL = 30_000;
export async function fetchRoles(host, port, moonrakerApiKey) {
    const cacheKey = `${host}:${port}:${moonrakerApiKey ? '1' : '0'}`;
    const now = Date.now();
    const cached = roleCache.get(cacheKey);
    if (cached && now - cached.time < ROLE_CACHE_TTL) {
        return cached.roles;
    }
    try {
        const headers = {};
        if (moonrakerApiKey) {
            headers['X-Api-Key'] = moonrakerApiKey;
        }
        const res = await fetch(`http://${host}:${port}/server/database/item?namespace=fluidd&key=auth`, { headers });
        const data = await res.json();
        const roles = data.result?.value?.roles ?? {};
        roleCache.set(cacheKey, { roles, time: now });
        return roles;
    }
    catch {
        console.warn(`[auth] Could not fetch roles from Moonraker DB at ${host}:${port}`);
        return {};
    }
}
export function invalidateRoleCache() {
    roleCache.clear();
}
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer '))
        return authHeader.slice(7);
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('token');
}
const STATIC_EXT = /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webmanifest|json)(?:\?|$)/i;
const PUBLIC_PATHS = [
    '/access/login',
    '/access/refresh_jwt'
];
function isPublicPath(url) {
    return PUBLIC_PATHS.some(p => url.startsWith(p));
}
const SET_PROXY_PATH = '/__fluiddified/set-proxy-backend';
export function authHook(config) {
    return async (req, reply) => {
        const path = req.url.split('?')[0];
        req.proxyBackend = resolveProxyBackend(req, config);
        if (path === SET_PROXY_PATH && req.method === 'POST')
            return;
        if (path === '/health')
            return;
        if (isPublicPath(path))
            return;
        if (STATIC_EXT.test(path))
            return;
        const token = extractToken(req);
        if (!token) {
            const accept = req.headers.accept ?? '';
            if (accept.includes('text/html')) {
                return reply.redirect('/#/login');
            }
            return reply.status(401).send({ error: 'Authentication required' });
        }
        try {
            const decoded = jwtDecode(token);
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                return reply.status(401).send({ error: 'Token expired' });
            }
            req.jwtUser = decoded;
            const b = req.proxyBackend;
            const roles = await fetchRoles(b.moonrakerHost, b.moonrakerPort, b.moonrakerApiKey);
            req.userRole = roles[decoded.username] ?? 'user';
        }
        catch {
            return reply.status(401).send({ error: 'Invalid token' });
        }
    };
}
export function roleGuard(minRole) {
    return (req, reply, done) => {
        const currentRole = req.userRole ?? 'guest';
        if (!hasMinRole(currentRole, minRole)) {
            reply.status(403).send({ error: 'Insufficient permissions' });
            return;
        }
        done();
    };
}
//# sourceMappingURL=auth.js.map