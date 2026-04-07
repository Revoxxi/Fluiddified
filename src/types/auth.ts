export type Role = 'owner' | 'user' | 'guest'

export const RoleHierarchy: Record<Role, number> = {
  guest: 0,
  user: 1,
  owner: 2
}

export interface Permission {
  id: string
  name: string
  minRole: Role
}

export const Permissions = {
  PRINTER_CONTROL: { id: 'printer.control', name: 'Printer Control', minRole: 'user' },
  PRINTER_EMERGENCY: { id: 'printer.emergency', name: 'Emergency Stop', minRole: 'user' },
  PRINTER_HOME: { id: 'printer.home', name: 'Home Axes', minRole: 'user' },
  PRINTER_MOVE: { id: 'printer.move', name: 'Move Toolhead', minRole: 'user' },

  TEMP_SET: { id: 'temp.set', name: 'Set Temperatures', minRole: 'user' },
  TEMP_VIEW: { id: 'temp.view', name: 'View Temperatures', minRole: 'guest' },

  MACRO_RUN: { id: 'macro.run', name: 'Run Macros', minRole: 'user' },
  MACRO_EDIT: { id: 'macro.edit', name: 'Edit Macros', minRole: 'owner' },

  FILE_UPLOAD: { id: 'file.upload', name: 'Upload Files', minRole: 'user' },
  FILE_DELETE: { id: 'file.delete', name: 'Delete Files', minRole: 'owner' },
  FILE_EDIT: { id: 'file.edit', name: 'Edit Config Files', minRole: 'owner' },
  /** Read-only listing (e.g. dashboard jobs card); mutations still require upload/delete/edit. */
  FILE_VIEW: { id: 'file.view', name: 'View Files', minRole: 'guest' },

  PRINT_START: { id: 'print.start', name: 'Start Print', minRole: 'user' },
  PRINT_PAUSE: { id: 'print.pause', name: 'Pause/Resume Print', minRole: 'user' },
  PRINT_CANCEL: { id: 'print.cancel', name: 'Cancel Print', minRole: 'user' },

  CAMERA_VIEW: { id: 'camera.view', name: 'View Camera', minRole: 'guest' },

  CONSOLE_SEND: { id: 'console.send', name: 'Send Console Commands', minRole: 'owner' },
  CONSOLE_VIEW: { id: 'console.view', name: 'View Console', minRole: 'owner' },

  SYSTEM_RESTART: { id: 'system.restart', name: 'Restart Services', minRole: 'owner' },
  SYSTEM_UPDATE: { id: 'system.update', name: 'Update Software', minRole: 'owner' },
  SYSTEM_POWER: { id: 'system.power', name: 'Power Devices', minRole: 'owner' },

  SETTINGS_VIEW: { id: 'settings.view', name: 'View Settings', minRole: 'owner' },
  SETTINGS_MODIFY: { id: 'settings.modify', name: 'Modify Settings', minRole: 'owner' },

  USER_MANAGE: { id: 'user.manage', name: 'Manage Users', minRole: 'owner' },

  JOB_QUEUE_MANAGE: { id: 'job.queue', name: 'Manage Job Queue', minRole: 'user' },

  HISTORY_VIEW: { id: 'history.view', name: 'View Print History', minRole: 'guest' },

  DASHBOARD_VIEW: { id: 'dashboard.view', name: 'View Dashboard', minRole: 'guest' },
  DASHBOARD_LAYOUT: { id: 'dashboard.layout', name: 'Edit Dashboard Layout', minRole: 'user' },

  OUTPUT_VIEW: { id: 'output.view', name: 'View Fans/Pins/LEDs', minRole: 'guest' },
  OUTPUT_CONTROL: { id: 'output.control', name: 'Control Fans/Pins/LEDs', minRole: 'user' },

  LIMITS_VIEW: { id: 'limits.view', name: 'View Printer Limits', minRole: 'guest' },
  LIMITS_SET: { id: 'limits.set', name: 'Set Printer Limits', minRole: 'user' },

  RETRACT_VIEW: { id: 'retract.view', name: 'View Retraction', minRole: 'guest' },
  RETRACT_SET: { id: 'retract.set', name: 'Set Retraction', minRole: 'user' },

  MESH_VIEW: { id: 'mesh.view', name: 'View Bed Mesh', minRole: 'guest' },
  MESH_CALIBRATE: { id: 'mesh.calibrate', name: 'Calibrate Bed Mesh', minRole: 'user' },

  GCODE_PREVIEW: { id: 'gcode.preview', name: 'GCode Preview', minRole: 'guest' },

  MMU_VIEW: { id: 'mmu.view', name: 'View MMU/AFC Status', minRole: 'guest' },
  MMU_CONTROL: { id: 'mmu.control', name: 'MMU Operations', minRole: 'user' },
  SPOOLMAN_VIEW: { id: 'spoolman.view', name: 'View Spool Info', minRole: 'guest' },
  SPOOLMAN_CHANGE: { id: 'spoolman.change', name: 'Change Spool', minRole: 'user' },

  UI_PERSIST: { id: 'ui.persist', name: 'Save UI Preferences', minRole: 'user' }
} as const satisfies Record<string, Permission>

export type UserRoleMap = Record<string, Role>
