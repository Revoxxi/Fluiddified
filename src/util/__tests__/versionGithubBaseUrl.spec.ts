import { describe, expect, it } from 'vitest'
import { getGithubRepoBaseUrl } from '@/util/versionGithubBaseUrl'
import type { VersionInfo } from '@/store/version/types'

describe('getGithubRepoBaseUrl', () => {
  it('uses owner/repo when Moonraker splits repo config correctly', () => {
    const c = {
      configured_type: 'web' as const,
      name: 'fluiddified',
      owner: 'revoxxi',
      repo_name: 'fluiddified',
      channel: 'stable' as const,
      channel_invalid: false,
      debug_enabled: false,
      last_error: '',
      version: '1.0.0',
      remote_version: '1.0.1',
      rollback_version: '',
      is_valid: true,
      anomalies: [],
      warnings: [],
      info_tags: []
    } satisfies VersionInfo
    expect(getGithubRepoBaseUrl(c)).toBe('https://github.com/revoxxi/fluiddified')
  })

  it('fixes web client when owner matches block name (moonraker quirk)', () => {
    const c = {
      configured_type: 'web' as const,
      name: 'fluiddified',
      owner: 'fluiddified',
      repo_name: 'fluiddified',
      channel: 'stable' as const,
      channel_invalid: false,
      debug_enabled: false,
      last_error: '',
      version: '1.0.0',
      remote_version: '1.0.1',
      rollback_version: '',
      is_valid: true,
      anomalies: [],
      warnings: [],
      info_tags: []
    } satisfies VersionInfo
    expect(getGithubRepoBaseUrl(c)).toBe('https://github.com/revoxxi/fluiddified')
  })

  it('splits owner/repo when repo_name carries full slug', () => {
    const c = {
      configured_type: 'web' as const,
      name: 'fluiddified',
      owner: 'fluiddified',
      repo_name: 'revoxxi/fluiddified',
      channel: 'stable' as const,
      channel_invalid: false,
      debug_enabled: false,
      last_error: '',
      version: '1.0.0',
      remote_version: '1.0.1',
      rollback_version: '',
      is_valid: true,
      anomalies: [],
      warnings: [],
      info_tags: []
    } satisfies VersionInfo
    expect(getGithubRepoBaseUrl(c)).toBe('https://github.com/revoxxi/fluiddified')
  })

  it('prefers remote_url when set', () => {
    const c = {
      configured_type: 'git_repo' as const,
      name: 'klipper',
      owner: 'Klipper3D',
      repo_name: 'klipper',
      remote_url: 'https://github.com/custom/klipper',
      detected_type: '',
      channel: 'stable' as const,
      channel_invalid: false,
      debug_enabled: false,
      is_valid: true,
      version: 'v0.12.0',
      remote_version: 'v0.12.0',
      rollback_version: '',
      full_version_string: '',
      remote_hash: '',
      current_hash: '',
      remote_alias: '',
      recovery_url: '',
      branch: 'master',
      is_dirty: false,
      corrupt: false,
      pristine: true,
      detached: false,
      git_messages: [],
      anomalies: [],
      warnings: [],
      commits_behind: [],
      commits_behind_count: 0,
      info_tags: []
    } satisfies VersionInfo
    expect(getGithubRepoBaseUrl(c)).toBe('https://github.com/custom/klipper')
  })
})
