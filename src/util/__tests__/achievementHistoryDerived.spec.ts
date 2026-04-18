import { describe, expect, it } from 'vitest'
import type { HistoryItem } from '@/store/history/types'
import {
  computeConsecutiveSuccesses,
  computeDailyStreakFromCompletedJobs,
  countDistinctMonthsWithPrint,
  countDistinctSeasonsWithPrint,
  countQueueCompletedJobs,
  deriveAchievementStatsFromHistory,
  parseJobEndTime
} from '@/util/achievementHistoryDerived'

function job (partial: Partial<HistoryItem> & Pick<HistoryItem, 'job_id' | 'status'>): HistoryItem {
  return {
    exists: true,
    filename: 'x.gcode',
    filament_used: 0,
    print_duration: 0,
    total_duration: 0,
    start_time: 0,
    end_time: null,
    ...partial
  } as HistoryItem
}

describe('achievementHistoryDerived', () => {
  it('computes consecutive successes from most recent jobs', () => {
    const jobs: HistoryItem[] = [
      job({ job_id: 'a', status: 'completed', end_time: 300, print_duration: 10 }),
      job({ job_id: 'b', status: 'completed', end_time: 200, print_duration: 10 }),
      job({ job_id: 'c', status: 'error', end_time: 100, print_duration: 10 })
    ]
    expect(computeConsecutiveSuccesses(jobs)).toBe(2)
  })

  it('daily streak counts consecutive calendar days ending on last print day', () => {
    // Two local days with completed prints, consecutive
    const day1 = new Date(2026, 3, 10, 12, 0, 0).getTime() / 1000
    const day2 = new Date(2026, 3, 11, 12, 0, 0).getTime() / 1000
    const jobs: HistoryItem[] = [
      job({ job_id: 'a', status: 'completed', end_time: day2, print_duration: 10 }),
      job({ job_id: 'b', status: 'completed', end_time: day1, print_duration: 10 })
    ]
    expect(computeDailyStreakFromCompletedJobs(jobs)).toBe(2)
  })

  it('deriveAchievementStatsFromHistory is stable for identical job lists', () => {
    const jobs: HistoryItem[] = [
      job({
        job_id: 'a',
        status: 'completed',
        start_time: 100,
        end_time: 200,
        print_duration: 50,
        metadata: { filament_weight_total: 12 } as HistoryItem['metadata']
      })
    ]
    const d1 = deriveAchievementStatsFromHistory(jobs)
    const d2 = deriveAchievementStatsFromHistory(jobs)
    expect(d1).toEqual(d2)
    expect(d1.consecutiveSuccesses).toBe(1)
    expect(d1.totalPrintWeightGrams).toBe(12)
    expect(parseJobEndTime(jobs[0])).toBe(200)
  })

  it('counts queue jobs from auxiliary_data', () => {
    const t = new Date(2026, 5, 1).getTime() / 1000
    const jobs: HistoryItem[] = [
      job({
        job_id: 'q1',
        status: 'completed',
        end_time: t,
        auxiliary_data: [{ provider: 'job_queue', name: 'time_in_queue', value: 12, description: '', units: 's' }]
      }),
      job({ job_id: 'x', status: 'completed', end_time: t, auxiliary_data: [] })
    ]
    expect(countQueueCompletedJobs(jobs)).toBe(1)
  })

  it('counts distinct months and seasons', () => {
    const jobs: HistoryItem[] = [
      job({ job_id: 'a', status: 'completed', end_time: new Date(2026, 0, 15).getTime() / 1000 }),
      job({ job_id: 'b', status: 'completed', end_time: new Date(2026, 1, 10).getTime() / 1000 }),
      job({ job_id: 'c', status: 'completed', end_time: new Date(2026, 5, 10).getTime() / 1000 })
    ]
    expect(countDistinctMonthsWithPrint(jobs)).toBe(3)
    expect(countDistinctSeasonsWithPrint(jobs)).toBe(2)
  })
})
