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
 * Only Moonraker owner (JWT) or trusted-LAN client without JWT may create/delete
 * Moonraker login accounts. Enforced together with store getter
 * `auth/canManageMoonrakerAccounts`.
 */
export const ownerOrTrustedLanSocketMethods = new Set<string>([
  'access.post_user',
  'access.delete_user'
])

/**
 * Minimum Fluidd role required for each Moonraker JSON-RPC method (socket).
 * Methods not listed are treated as guest-readable (allowed for all session types).
 */
export const socketMethodMinRole: Record<string, Role> = {
  'printer.print.start': 'user',
  'printer.print.cancel': 'user',
  'printer.print.pause': 'user',
  'printer.print.resume': 'user',
  'printer.gcode.script': 'user',
  'printer.emergency_stop': 'user',
  'printer.restart': 'owner',
  'printer.firmware_restart': 'owner',
  'printer.query_endstops.status': 'user',

  'machine.services.restart': 'user',
  'machine.services.start': 'user',
  'machine.services.stop': 'user',
  'machine.reboot': 'owner',
  'machine.shutdown': 'owner',
  'machine.update.full': 'owner',
  'machine.update.moonraker': 'owner',
  'machine.update.klipper': 'owner',
  'machine.update.client': 'owner',
  'machine.update.system': 'owner',
  'machine.update.recover': 'owner',
  'machine.device_power.post_device': 'owner',
  'machine.timelapse.post_settings': 'user',
  'machine.timelapse.saveframes': 'user',
  'machine.timelapse.render': 'user',
  'machine.peripherals.usb': 'user',
  'machine.peripherals.serial': 'user',
  'machine.peripherals.video': 'user',
  'machine.peripherals.canbus': 'user',

  'server.files.delete_file': 'user',
  'server.files.delete_directory': 'user',
  'server.files.post_directory': 'user',
  'server.files.move': 'user',
  'server.files.copy': 'user',
  'server.files.zip': 'user',
  'server.job_queue.post_job': 'user',
  'server.job_queue.delete_job': 'user',
  'server.job_queue.pause': 'user',
  'server.job_queue.start': 'user',

  'server.database.list': 'owner',
  'server.database.compact': 'owner',
  'server.database.post_backup': 'owner',
  'server.database.restore': 'owner',
  'server.database.delete_backup': 'owner',
  'server.database.post_item': 'user',
  'server.database.delete_item': 'owner',
  'server.restart': 'owner',
  'server.history.delete_job': 'user',
  'server.history.reset_totals': 'owner',
  'server.logs.rollover': 'owner',
  'server.webcams.post_item': 'user',
  'server.webcams.delete_item': 'user',
  'server.analysis.estimate': 'user',
  'server.analysis.process': 'user',

  'access.logout': 'guest',
  'access.oneshot_token': 'user',
  'access.get_user': 'guest',
  'access.users.list': 'guest',
  'access.user.password': 'user',
  'access.get_api_key': 'owner',
  'access.post_api_key': 'owner'
}
