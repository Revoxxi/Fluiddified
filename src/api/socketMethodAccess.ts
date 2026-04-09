import type { Role } from '@/types/auth'

/**
 * JSON-RPC methods that must never be role-gated (bootstrap / public auth flow).
 */
export const alwaysAllowSocketMethods = new Set<string>([
  'access.info',
  'access.login',
  'access.refresh_jwt',
  'server.connection.identify'
])

/**
 * Moonraker login account create/delete — checked in `socketActions` with
 * `auth/canManageMoonrakerAccounts` (Fluidd **owner** only). Not related to Moonraker
 * “trusted client” / first-user setup; trusted LAN never grants these from Fluidd RBAC.
 */
export const ownerOnlyMoonrakerAccountSocketMethods = new Set<string>([
  'access.post_user',
  'access.delete_user'
])

/**
 * Minimum Fluidd role for each Moonraker JSON-RPC method (socket).
 * Unlisted methods are denied (see `checkMethodPermission` in `socketActions.ts`).
 *
 * Policy: **guest** = spectator (read/subscribe only where listed); **user** = operator
 * (print, G-code, queue, UI DB prefs); **owner** = host/config/admin mutations.
 */
export const socketMethodMinRole: Record<string, Role> = {
  'access.get_api_key': 'owner',
  'access.get_user': 'guest',
  'access.logout': 'guest',
  'access.oneshot_token': 'guest',
  'access.post_api_key': 'owner',
  'access.user.password': 'user',
  'access.users.list': 'guest',

  'machine.device_power.devices': 'guest',
  'machine.device_power.post_device': 'owner',
  'machine.device_power.status': 'guest',
  'machine.peripherals.canbus': 'owner',
  'machine.peripherals.serial': 'owner',
  'machine.peripherals.usb': 'owner',
  'machine.peripherals.video': 'owner',
  'machine.proc_stats': 'guest',
  'machine.reboot': 'owner',
  'machine.services.restart': 'user',
  'machine.services.start': 'user',
  'machine.services.stop': 'user',
  'machine.shutdown': 'owner',
  'machine.system_info': 'guest',
  'machine.timelapse.get_settings': 'guest',
  'machine.timelapse.lastframeinfo': 'guest',
  /** Capture/render/machine behavior — Fluidd owner only (`views/Timelapse.vue`). */
  'machine.timelapse.post_settings': 'owner',
  'machine.timelapse.render': 'owner',
  'machine.timelapse.saveframes': 'owner',
  'machine.update.client': 'owner',
  'machine.update.full': 'owner',
  'machine.update.klipper': 'owner',
  'machine.update.moonraker': 'owner',
  'machine.update.recover': 'owner',
  'machine.update.refresh': 'guest',
  'machine.update.status': 'guest',
  'machine.update.system': 'owner',

  'printer.emergency_stop': 'user',
  'printer.firmware_restart': 'owner',
  'printer.gcode.help': 'guest',
  'printer.gcode.script': 'user',
  'printer.info': 'guest',
  'printer.objects.list': 'guest',
  'printer.objects.subscribe': 'guest',
  'printer.print.cancel': 'user',
  'printer.print.pause': 'user',
  'printer.print.resume': 'user',
  'printer.print.start': 'user',
  'printer.query_endstops.status': 'user',
  'printer.restart': 'owner',

  'server.analysis.estimate': 'user',
  'server.analysis.process': 'user',
  'server.analysis.status': 'guest',
  'server.announcements.dismiss': 'user',
  'server.announcements.list': 'guest',
  'server.config': 'guest',
  'server.database.compact': 'owner',
  'server.database.delete_backup': 'owner',
  'server.database.delete_item': 'owner',
  'server.database.get_item': 'guest',
  'server.database.list': 'owner',
  'server.database.post_backup': 'owner',
  'server.database.post_item': 'user',
  'server.database.restore': 'owner',
  'server.files.copy': 'owner',
  'server.files.delete_directory': 'owner',
  'server.files.delete_file': 'owner',
  'server.files.get_directory': 'guest',
  'server.files.list': 'guest',
  'server.files.metadata': 'guest',
  'server.files.metascan': 'guest',
  'server.files.move': 'owner',
  'server.files.post_directory': 'owner',
  'server.files.zip': 'owner',
  'server.gcode_store': 'guest',
  'server.history.delete_job': 'owner',
  'server.history.list': 'guest',
  'server.history.reset_totals': 'owner',
  'server.history.totals': 'guest',
  'server.info': 'guest',
  'server.job_queue.delete_job': 'user',
  'server.job_queue.pause': 'user',
  'server.job_queue.post_job': 'user',
  'server.job_queue.start': 'user',
  'server.job_queue.status': 'guest',
  'server.logs.rollover': 'owner',
  'server.restart': 'owner',
  'server.sensors.list': 'guest',
  'server.spoolman.get_spool_id': 'guest',
  'server.spoolman.post_spool_id': 'user',
  'server.spoolman.proxy': 'user',
  'server.temperature_store': 'guest',
  'server.webcams.delete_item': 'owner',
  'server.webcams.list': 'guest',
  'server.webcams.post_item': 'owner'
}
