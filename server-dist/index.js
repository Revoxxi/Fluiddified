import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './proxyConfig';
import { authHook } from './auth';
import { registerProxyRoutes, registerSetProxyBackendRoute } from './proxy';
import { registerWsProxy } from './wsProxy';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function validateMoonrakerConfig(moonrakerHost, moonrakerPort, moonrakerApiKey) {
    try {
        const headers = {};
        if (moonrakerApiKey) {
            headers['X-Api-Key'] = moonrakerApiKey;
        }
        const res = await fetch(`http://${moonrakerHost}:${moonrakerPort}/server/config`, { headers });
        const data = await res.json();
        const authConfig = data.result?.config?.authorization;
        if (!authConfig) {
            console.warn('[WARN] Moonraker authorization section not found');
            return;
        }
        const trusted = authConfig.trusted_clients ?? [];
        const dangerous = trusted.some((cidr) => cidr === '0.0.0.0/0' || cidr === '::/0');
        if (dangerous) {
            console.error('[SECURITY] Moonraker trusted_clients includes 0.0.0.0/0 — ' +
                'this bypasses all proxy auth! Set trusted_clients to only ' +
                '127.0.0.1 in moonraker.conf [authorization] section.');
        }
        if (!authConfig.force_logins) {
            console.warn('[WARN] Moonraker force_logins is not enabled. Recommended ' +
                'for internet exposure: set force_logins: True in moonraker.conf');
        }
        console.log('[startup] Moonraker config validated');
    }
    catch {
        console.warn('[WARN] Could not validate Moonraker config — is Moonraker running?');
    }
}
async function start() {
    const config = loadConfig();
    const app = Fastify({
        logger: {
            level: 'info'
        }
    });
    await app.register(rateLimit, {
        max: config.rateLimitPerMinute,
        timeWindow: '1 minute'
    });
    await app.register(fastifyWebsocket);
    app.addHook('onRequest', authHook(config));
    app.addHook('onSend', async (_req, reply, payload) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '1; mode=block');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        return payload;
    });
    app.setErrorHandler((error, _req, reply) => {
        app.log.error(error);
        const statusCode = error.statusCode ?? 500;
        reply.status(statusCode).send({
            error: statusCode >= 500 ? 'Internal server error' : error.message
        });
    });
    registerSetProxyBackendRoute(app, config);
    registerWsProxy(app);
    await registerProxyRoutes(app);
    const distPath = path.join(__dirname, '..', 'dist');
    await app.register(fastifyStatic, {
        root: distPath,
        wildcard: false
    });
    app.setNotFoundHandler((req, reply) => {
        const accept = req.headers.accept ?? '';
        if (accept.includes('text/html')) {
            return reply.sendFile('index.html');
        }
        reply.status(404).send({ error: 'Not found' });
    });
    app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));
    app.addHook('onClose', () => {
        console.log('[server] Shutting down gracefully');
    });
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
        process.on(signal, async () => {
            console.log(`[server] Received ${signal}, shutting down...`);
            await app.close();
            process.exit(0);
        });
    }
    for (const b of config.instances) {
        await validateMoonrakerConfig(b.moonrakerHost, b.moonrakerPort, b.moonrakerApiKey);
    }
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`[server] Fluiddified proxy running on port ${config.port}`);
    for (const b of config.instances) {
        console.log(`[server] Backend ${b.id}: Moonraker ${b.moonrakerHost}:${b.moonrakerPort}` +
            (b.moonrakerApiKey ? ', Moonraker service API key: set' : '') +
            (b.cameraEnabled ? `, camera ${b.cameraHost}:${b.cameraPort}` : ' (camera off)'));
    }
}
start().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map