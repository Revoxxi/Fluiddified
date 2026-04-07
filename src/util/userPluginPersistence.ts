import { Globals } from '@/globals'

const KEY = Globals.LOCAL_USER_PLUGINS_STATE_KEY

export interface UserZipStored {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  defaultEnabled?: boolean
  defaultCollapsed?: boolean
  defaultContainer?: 1 | 2 | 3 | 4
  defaultPosition?: number
  minRole?: 'guest' | 'user' | 'owner'
  tags?: string[]
  scriptBase64: string
}

export interface UserPluginStateFile {
  v: 1
  removedExternalIds: string[]
  userZips: UserZipStored[]
}

const empty = (): UserPluginStateFile => ({
  v: 1,
  removedExternalIds: [],
  userZips: []
})

export function readUserPluginState (): UserPluginStateFile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return empty()
    }
    const p = JSON.parse(raw) as UserPluginStateFile
    if (p.v !== 1 || !Array.isArray(p.removedExternalIds) || !Array.isArray(p.userZips)) {
      return empty()
    }
    return p
  } catch {
    return empty()
  }
}

export function writeUserPluginState (s: UserPluginStateFile): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function getRemovedExternalPluginIds (): Set<string> {
  return new Set(readUserPluginState().removedExternalIds)
}

export function addRemovedExternalPluginId (id: string): void {
  const s = readUserPluginState()
  if (!s.removedExternalIds.includes(id)) {
    s.removedExternalIds.push(id)
  }
  writeUserPluginState(s)
}

export function upsertUserZip (entry: UserZipStored): void {
  const s = readUserPluginState()
  s.userZips = s.userZips.filter(z => z.id !== entry.id)
  s.userZips.push(entry)
  writeUserPluginState(s)
}

export function deleteUserZip (id: string): void {
  const s = readUserPluginState()
  s.userZips = s.userZips.filter(z => z.id !== id)
  writeUserPluginState(s)
}

export function isUserZipPluginId (id: string): boolean {
  return readUserPluginState().userZips.some(z => z.id === id)
}
