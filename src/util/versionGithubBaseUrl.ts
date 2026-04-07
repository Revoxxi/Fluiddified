import { Globals } from '@/globals'
import type { VersionInfo } from '@/store/version/types'

function parseGithubRepoRoot (url: string): { owner: string, repo: string } | null {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/#]+)/i.exec(url.trim())
  if (m == null) {
    return null
  }
  const repo = m[2].replace(/\.git$/i, '')
  return { owner: m[1], repo }
}

/**
 * GitHub repo root for version / release links.
 * Moonraker sometimes reports `owner` == `repo_name` == the update_manager block
 * name for web clients (e.g. fluiddified/fluiddified instead of revoxxi/fluiddified).
 */
export function getGithubRepoBaseUrl (component: VersionInfo): string {
  if (
    'remote_url' in component &&
    typeof component.remote_url === 'string' &&
    component.remote_url.length > 0 &&
    component.remote_url !== '?'
  ) {
    return component.remote_url.replace(/\/$/, '')
  }

  if (!('owner' in component)) {
    return ''
  }

  let owner = component.owner
  let repo = component.repo_name || component.name

  if (repo.includes('/')) {
    const idx = repo.indexOf('/')
    owner = repo.slice(0, idx)
    repo = repo.slice(idx + 1)
    return `https://github.com/${owner}/${repo}`
  }

  const slug = component.repo_name || component.name
  const flakyHosted =
    (component.configured_type === 'web' || component.configured_type === 'zip') &&
    component.owner === slug

  if (flakyHosted) {
    const parsed = parseGithubRepoRoot(Globals.GITHUB_REPO)
    if (parsed != null) {
      owner = parsed.owner
      repo = parsed.repo
    }
  }

  return `https://github.com/${owner}/${repo}`
}
