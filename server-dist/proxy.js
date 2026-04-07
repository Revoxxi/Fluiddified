import replyFrom from '@fastify/reply-from';
import { roleGuard } from './auth';
import { PROXY_BACKEND_COOKIE } from './instanceRouting';
function moonrakerBase(req) {
    const b = req.proxyBackend;
    return `http://${b.moonrakerHost}:${b.moonrakerPort}`;
}
async function forwardMoonraker(req, reply) {
    return reply.from(`${moonrakerBase(req)}${req.url}`);
}
export function registerSetProxyBackendRoute(app, config) {
    app.post('/__fluiddified/set-proxy-backend', async (req, reply) => {
        const body = req.body;
        const backendId = body?.backendId;
        if (typeof backendId !== 'string' || !config.instances.some((i) => i.id === backendId)) {
            return reply.status(400).send({ error: 'Invalid backend id' });
        }
        const secure = process.env.FLUIDDIFIED_SECURE_COOKIES === 'true';
        const cookie = [
            `${PROXY_BACKEND_COOKIE}=${encodeURIComponent(backendId)}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            ...(secure ? ['Secure'] : [])
        ].join('; ');
        reply.header('Set-Cookie', cookie);
        return { ok: true };
    });
}
export async function registerProxyRoutes(app, _config) {
    await app.register(replyFrom);
    app.all('/access', forwardMoonraker);
    app.all('/access/*', forwardMoonraker);
    const moonrakerPrefixes = ['/api', '/printer', '/server', '/machine'];
    for (const prefix of moonrakerPrefixes) {
        app.all(prefix, { preHandler: roleGuard('user') }, forwardMoonraker);
        app.all(`${prefix}/*`, { preHandler: roleGuard('user') }, forwardMoonraker);
    }
    const cameraGuard = roleGuard('guest');
    app.all('/webcam', { preHandler: cameraGuard }, async (req, reply) => {
        const b = req.proxyBackend;
        if (!b.cameraEnabled) {
            return reply.status(404).send({ error: 'Camera disabled for this backend' });
        }
        return reply.from(`http://${b.cameraHost}:${b.cameraPort}${req.url}`);
    });
    app.all('/webcam/*', { preHandler: cameraGuard }, async (req, reply) => {
        const b = req.proxyBackend;
        if (!b.cameraEnabled) {
            return reply.status(404).send({ error: 'Camera disabled for this backend' });
        }
        return reply.from(`http://${b.cameraHost}:${b.cameraPort}${req.url}`);
    });
}
//# sourceMappingURL=proxy.js.map