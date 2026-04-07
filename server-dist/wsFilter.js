const GUEST_ALLOWED_METHODS = new Set([
    'server.info',
    'server.config',
    'server.temperature_store',
    'server.gcode_store',
    'server.history.list',
    'server.history.totals',
    'server.files.list',
    'server.files.metadata',
    'server.files.get_directory',
    'server.database.get_item',
    'server.announcements.list',
    'server.job_queue.status',
    'server.webcams.list',
    'server.webcams.get_item',
    'server.spoolman.get_spool_id',
    'printer.info',
    'printer.objects.list',
    'printer.objects.query',
    'printer.objects.subscribe',
    'machine.system_info',
    'machine.proc_stats'
]);
export function isGuestAllowedMessage(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed.method && GUEST_ALLOWED_METHODS.has(parsed.method)) {
            return true;
        }
        // Allow RPC responses (have id but no method) — these are replies to
        // previously allowed requests
        if (parsed.id != null && !parsed.method)
            return true;
        return false;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=wsFilter.js.map