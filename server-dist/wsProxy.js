import WebSocket from 'ws';
import { isGuestAllowedMessage } from './wsFilter';
export function registerWsProxy(app) {
    app.get('/websocket', { websocket: true }, (socket, req) => {
        const role = req.userRole ?? 'guest';
        const b = req.proxyBackend;
        const moonrakerUrl = `ws://${b.moonrakerHost}:${b.moonrakerPort}/websocket`;
        const key = b.moonrakerApiKey;
        const upstream = key
            ? new WebSocket(moonrakerUrl, { headers: { 'X-Api-Key': key } })
            : new WebSocket(moonrakerUrl);
        upstream.on('open', () => {
            console.log(`[ws] Upstream ${b.id} (${b.moonrakerHost}:${b.moonrakerPort}) for ${req.jwtUser?.username ?? 'unknown'} (${role})`);
        });
        upstream.on('message', (data) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(data.toString());
            }
        });
        socket.on('message', (data) => {
            const message = data.toString();
            if (role === 'guest') {
                if (!isGuestAllowedMessage(message))
                    return;
            }
            if (upstream.readyState === WebSocket.OPEN) {
                upstream.send(message);
            }
        });
        upstream.on('close', () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        });
        upstream.on('error', (err) => {
            console.error('[ws] Upstream error:', err.message);
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        });
        socket.on('close', () => {
            if (upstream.readyState === WebSocket.OPEN) {
                upstream.close();
            }
        });
        socket.on('error', (err) => {
            console.error('[ws] Client error:', err.message);
            if (upstream.readyState === WebSocket.OPEN) {
                upstream.close();
            }
        });
    });
}
//# sourceMappingURL=wsProxy.js.map