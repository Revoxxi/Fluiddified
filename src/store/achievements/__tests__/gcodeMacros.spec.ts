import { describe, expect, it } from 'vitest'
import { resolveUserVisibleMacroName } from '@/store/achievements/gcodeMacros'
import type { RootState } from '@/store/types'

function mockRoot (gcodeMacroKeys: string[]): RootState {
  const klippy: Record<string, unknown> = {}
  for (const k of gcodeMacroKeys) {
    klippy[k] = {}
  }
  return {
    printer: {
      printer: klippy
    }
  } as unknown as RootState
}

describe('resolveUserVisibleMacroName', () => {
  it('resolves user macro by case-insensitive match', () => {
    const root = mockRoot(['gcode_macro MY_PRINT_START'])
    expect(resolveUserVisibleMacroName(root, 'my_print_start')).toBe('MY_PRINT_START')
  })

  it('returns null for unknown command token', () => {
    const root = mockRoot(['gcode_macro PAUSE'])
    expect(resolveUserVisibleMacroName(root, 'NOT_A_MACRO')).toBeNull()
  })

  it('returns null for internal _macros', () => {
    const root = mockRoot(['gcode_macro _CLIENT_LINEAR_MOVE'])
    expect(resolveUserVisibleMacroName(root, '_CLIENT_LINEAR_MOVE')).toBeNull()
  })
})
