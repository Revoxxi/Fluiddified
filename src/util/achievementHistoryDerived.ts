import type { AchievementStats } from '@/types/achievement'
import type { HistoryItem } from '@/store/history/types'

/** Local date key YYYY-M-D, matching achievement `getDateKey` semantics */
export function getDateKeyFromSeconds (tsSec: number): string {
  const d = new Date(tsSec * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseJobEndTime (job: HistoryItem): number {
  if (job.end_time == null) return 0
  return typeof job.end_time === 'string' ? parseFloat(job.end_time) : job.end_time
}

function gramsFromCompletedJob (job: HistoryItem): number {
  const w = job.metadata?.filament_weight_total
  return typeof w === 'number' && w > 0 ? w : 0
}

/** Sunday-anchored key for weekend-warrior style tracking (matches achievements actions). */
function getWeekendKey (ts: number): string {
  const d = new Date(ts * 1000)
  const sun = new Date(d)
  sun.setDate(d.getDate() - d.getDay())
  return getDateKeyFromSeconds(sun.getTime() / 1000)
}

/** Monday-anchored calendar week key (local), matches achievements actions */
export function getWeekAnchorDateKey (tsSec: number): string {
  const d = new Date(tsSec * 1000)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(mon.getDate() + mondayOffset)
  return getDateKeyFromSeconds(mon.getTime() / 1000)
}

/**
 * Count consecutive `completed` jobs from the most recently finished job backward.
 * Deterministic for a given history list — safe with multiple browser tabs.
 */
export function computeConsecutiveSuccesses (jobs: HistoryItem[]): number {
  const sorted = [...jobs]
    .filter(j => parseJobEndTime(j) > 0)
    .sort((a, b) => parseJobEndTime(b) - parseJobEndTime(a))
  let count = 0
  for (const j of sorted) {
    if (j.status === 'completed') count++
    else break
  }
  return count
}

function parseDateKeyLocal (key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Longest run of consecutive calendar days ending on the most recent day that had a completed print.
 */
export function computeDailyStreakFromCompletedJobs (jobs: HistoryItem[]): number {
  const dayKeys = new Set<string>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et <= 0) continue
    dayKeys.add(getDateKeyFromSeconds(et))
  }
  if (dayKeys.size === 0) return 0

  let maxTs = 0
  for (const k of dayKeys) {
    const t = parseDateKeyLocal(k).getTime()
    if (t > maxTs) maxTs = t
  }

  let streak = 0
  let cursor = new Date(maxTs)
  while (true) {
    const key = getDateKeyFromSeconds(cursor.getTime() / 1000)
    if (dayKeys.has(key)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function computeDistinctDaysPrintedKeys (jobs: HistoryItem[]): string[] {
  const dayKeys = new Set<string>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et <= 0) continue
    dayKeys.add(getDateKeyFromSeconds(et))
  }
  return [...dayKeys].sort((a, b) => parseDateKeyLocal(a).getTime() - parseDateKeyLocal(b).getTime())
}

export function computeWeekendsPrintedKeys (jobs: HistoryItem[]): string[] {
  const keys = new Set<string>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const st = j.start_time ?? 0
    if (st <= 0) continue
    const startDay = new Date(st * 1000).getDay()
    if (startDay === 0 || startDay === 6) {
      keys.add(getWeekendKey(st))
    }
  }
  return [...keys].sort()
}

export function computeWeeksWithPrintKeys (jobs: HistoryItem[]): string[] {
  const keys = new Set<string>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et <= 0) continue
    keys.add(getWeekAnchorDateKey(et))
  }
  return [...keys].sort()
}

export function computeTotalPrintWeightGrams (jobs: HistoryItem[]): number {
  let sum = 0
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    sum += gramsFromCompletedJob(j)
  }
  return sum
}

export function computeFailedJobCount (jobs: HistoryItem[]): number {
  return jobs.filter(j => j.status === 'cancelled' || j.status === 'error').length
}

export function countPrintsOnDateKey (jobs: HistoryItem[], dateKey: string): number {
  return jobs.filter(j =>
    j.status === 'completed' &&
    parseJobEndTime(j) > 0 &&
    getDateKeyFromSeconds(parseJobEndTime(j)) === dateKey
  ).length
}

/** Moonraker job_queue plugin records queue time in job `auxiliary_data`. */
export function isCompletedJobFromQueue (job: HistoryItem): boolean {
  if (job.status !== 'completed') return false
  const aux = job.auxiliary_data
  if (!aux?.length) return false
  return aux.some(a => {
    const p = String(a.provider ?? '').toLowerCase()
    const n = String(a.name ?? '').toLowerCase()
    return p.includes('job_queue') || n === 'time_in_queue' || n.includes('queue')
  })
}

export function countQueueCompletedJobs (jobs: HistoryItem[]): number {
  return jobs.filter(j => isCompletedJobFromQueue(j)).length
}

/** Distinct calendar months (YYYY-MM) with ≥1 completed print, local time. */
export function countDistinctMonthsWithPrint (jobs: HistoryItem[]): number {
  const months = new Set<string>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et <= 0) continue
    const d = new Date(et * 1000)
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months.size
}

/** Northern-season index 0–3 from completed job end (spring Mar–May, summer Jun–Aug, fall Sep–Nov, winter Dec–Feb). */
function seasonIndexFromMonth (month0: number): number {
  const m = month0 + 1
  if (m >= 3 && m <= 5) return 0
  if (m >= 6 && m <= 8) return 1
  if (m >= 9 && m <= 11) return 2
  return 3
}

/** How many of the four seasons have at least one completed print (any year). */
export function countDistinctSeasonsWithPrint (jobs: HistoryItem[]): number {
  const s = new Set<number>()
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et <= 0) continue
    const d = new Date(et * 1000)
    s.add(seasonIndexFromMonth(d.getMonth()))
  }
  return s.size
}

/** Most recent completed job end time (seconds), or 0 */
export function computeLatestCompletedEndTime (jobs: HistoryItem[]): number {
  let max = 0
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const et = parseJobEndTime(j)
    if (et > max) max = et
  }
  return max
}

/** Date key of the most recent completed print, or null */
export function computeLatestCompletedDayKey (jobs: HistoryItem[]): string | null {
  const t = computeLatestCompletedEndTime(jobs)
  return t > 0 ? getDateKeyFromSeconds(t) : null
}

/**
 * Stats derived from Moonraker history so multiple clients agree and events are not double-counted.
 */
export function deriveAchievementStatsFromHistory (
  jobs: HistoryItem[]
): Pick<
AchievementStats,
| 'consecutiveSuccesses'
| 'totalPrintWeightGrams'
| 'distinctDaysPrinted'
| 'weekendsPrinted'
| 'weeksWithPrint'
| 'dailyStreak'
| 'failedPrintCount'
| 'lastPrintEndTime'
| 'lastPrintDate'
> {
  return {
    consecutiveSuccesses: computeConsecutiveSuccesses(jobs),
    totalPrintWeightGrams: computeTotalPrintWeightGrams(jobs),
    distinctDaysPrinted: computeDistinctDaysPrintedKeys(jobs),
    weekendsPrinted: computeWeekendsPrintedKeys(jobs),
    weeksWithPrint: computeWeeksWithPrintKeys(jobs),
    dailyStreak: computeDailyStreakFromCompletedJobs(jobs),
    failedPrintCount: computeFailedJobCount(jobs),
    lastPrintEndTime: computeLatestCompletedEndTime(jobs),
    lastPrintDate: computeLatestCompletedDayKey(jobs)
  }
}
