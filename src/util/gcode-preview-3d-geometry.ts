import type { ArcMove, Layer, Move, Point3D } from '@/store/gcodePreview/types'

function distance (a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return Math.sqrt(dx ** 2 + dy ** 2)
}

export interface Segment3D {
  x0: number
  y0: number
  z0: number
  x1: number
  y1: number
  z1: number
  extruding: boolean
  tool: number
  /** Source move index in parsed moves (for progress / file-position coloring). */
  moveIndex: number
}

/** Hard cap keeps GPU buffers and main-thread work bounded on large jobs. */
const MAX_DISPLAY_SEGMENTS = 500_000

/** Squared max gap (mm²) between segment end and next start to treat as one continuous chain. */
const CHAIN_GAP_SQ = 0.08 * 0.08

function isArcMove (move: Move): move is ArcMove {
  return 'd' in move
}

function sampleArcSegment (
  start: Point3D,
  move: ArcMove,
  segments: number
): Point3D[] {
  const dest = {
    x: move.x ?? start.x,
    y: move.y ?? start.y,
    z: move.z ?? start.z
  }

  if (move.i === undefined && move.j === undefined) {
    return [start, dest]
  }

  const center = {
    x: start.x + (move.i ?? 0),
    y: start.y + (move.j ?? 0)
  }

  const radius = distance(
    { x: start.x, y: start.y },
    center
  )

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(dest.y - center.y, dest.x - center.x)
  let delta = endAngle - startAngle

  if (move.d === 'clockwise') {
    if (delta > 0) delta -= 2 * Math.PI
  } else {
    if (delta < 0) delta += 2 * Math.PI
  }

  const out: Point3D[] = []
  for (let s = 0; s <= segments; s++) {
    const t = s / segments
    const a = startAngle + delta * t
    out.push({
      x: center.x + Math.cos(a) * radius,
      y: center.y + Math.sin(a) * radius,
      z: start.z + (dest.z - start.z) * t
    })
  }
  return out
}

function applyMovePosition (toolhead: Point3D, move: Move): void {
  if (isArcMove(move)) {
    const dest = sampleArcSegment(toolhead, move, 16)
    const end = dest[dest.length - 1]
    toolhead.x = end.x
    toolhead.y = end.y
    toolhead.z = end.z
    return
  }
  if (move.x !== undefined) toolhead.x = move.x
  if (move.y !== undefined) toolhead.y = move.y
  if (move.z !== undefined) toolhead.z = move.z
}

function arcSampleCountForMoveCount (moveCount: number): number {
  if (moveCount > 300_000) return 4
  if (moveCount > 120_000) return 8
  if (moveCount > 50_000) return 12
  return 16
}

function recomputeMoveSegmentStart (segments: Segment3D[], numMoves: number): number[] {
  const starts = new Array<number>(numMoves + 1)
  let si = 0
  for (let m = 0; m < numMoves; m++) {
    while (si < segments.length && segments[si].moveIndex < m) si++
    starts[m] = si
  }
  starts[numMoves] = segments.length
  return starts
}

/**
 * Reduces segment count without the "noise cloud" caused by picking every Nth segment globally
 * (that breaks continuity and scatters short edges across the whole bbox).
 * Chains are split on spatial jumps (travels). Each chain is vertex-decimated into longer edges.
 */
function decimateSegmentChains (segments: Segment3D[], numMoves: number): { segments: Segment3D[]; moveSegmentStart: number[] } {
  if (segments.length <= MAX_DISPLAY_SEGMENTS) {
    return {
      segments,
      moveSegmentStart: recomputeMoveSegmentStart(segments, numMoves)
    }
  }

  const chains: Segment3D[][] = []
  let cur: Segment3D[] = []
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (cur.length === 0) {
      cur.push(s)
      continue
    }
    const prev = cur[cur.length - 1]
    const dx = s.x0 - prev.x1
    const dy = s.y0 - prev.y1
    const dz = s.z0 - prev.z1
    if (dx * dx + dy * dy + dz * dz <= CHAIN_GAP_SQ) {
      cur.push(s)
    } else {
      chains.push(cur)
      cur = [s]
    }
  }
  if (cur.length) chains.push(cur)

  const totalLen = segments.length
  const out: Segment3D[] = []

  for (const chain of chains) {
    if (!chain.length) continue

    const share = chain.length / totalLen
    let maxForChain = Math.max(1, Math.floor(share * MAX_DISPLAY_SEGMENTS))
    maxForChain = Math.min(chain.length, maxForChain)

    const verts: Array<{ x: number; y: number; z: number }> = []
    verts.push({ x: chain[0].x0, y: chain[0].y0, z: chain[0].z0 })
    for (const seg of chain) {
      verts.push({ x: seg.x1, y: seg.y1, z: seg.z1 })
    }

    if (verts.length < 2) continue

    if (chain.length <= maxForChain) {
      out.push(...chain)
      continue
    }

    const nSeg = verts.length - 1
    const targetEdges = Math.min(maxForChain, nSeg)
    for (let k = 0; k < targetEdges; k++) {
      const i0 = Math.floor((k * nSeg) / targetEdges)
      const i1 = Math.floor(((k + 1) * nSeg) / targetEdges)
      if (i1 <= i0) continue
      const a = verts[i0]
      const b = verts[i1]
      const segIdx = Math.min(i0, chain.length - 1)
      const src = chain[segIdx]
      out.push({
        x0: a.x,
        y0: a.y,
        z0: a.z,
        x1: b.x,
        y1: b.y,
        z1: b.z,
        extruding: src.extruding,
        tool: src.tool,
        moveIndex: src.moveIndex
      })
    }
  }

  if (out.length > MAX_DISPLAY_SEGMENTS) {
    out.length = MAX_DISPLAY_SEGMENTS
  }
  return {
    segments: out,
    moveSegmentStart: recomputeMoveSegmentStart(out, numMoves)
  }
}

export interface GcodeSegments3dBuildResult {
  segments: Segment3D[]
  /** `start[m]` = first segment index belonging to move `m`; `start[moves.length]` = total count. */
  moveSegmentStart: number[]
}

function yieldToMainThread (): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 40 })
    } else {
      requestAnimationFrame(() => resolve())
    }
  })
}

/**
 * Builds 3D line segments for WebGL. Yields between chunks so the UI stays responsive on huge files.
 */
export async function buildGcodeSegments3dAsync (
  moves: readonly Move[],
  options?: { shouldCancel?: () => boolean; chunkMoves?: number }
): Promise<GcodeSegments3dBuildResult> {
  if (moves.length === 0) {
    return { segments: [], moveSegmentStart: [0] }
  }

  const arcSamples = arcSampleCountForMoveCount(moves.length)
  const chunkMoves = options?.chunkMoves ?? 4000
  const shouldCancel = options?.shouldCancel

  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  const toolhead: Point3D = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < Math.min(3, moves.length); i++) {
    const m = moves[i]
    if (m.x !== undefined) toolhead.x = m.x
    if (m.y !== undefined) toolhead.y = m.y
    if (m.z !== undefined) toolhead.z = m.z
  }

  const segments: Segment3D[] = []

  const processMoveIndex = (index: number) => {
    const move = moves[index]
    const from = { x: toolhead.x, y: toolhead.y, z: toolhead.z }

    if (isArcMove(move)) {
      let arcPts: Point3D[]
      try {
        arcPts = sampleArcSegment(from, move, arcSamples)
      } catch {
        applyMovePosition(toolhead, move)
        return
      }
      for (let a = 1; a < arcPts.length; a++) {
        const p0 = arcPts[a - 1]
        const p1 = arcPts[a]
        const extruding = move.e != null && move.e > 0
        segments.push({
          x0: p0.x,
          y0: p0.y,
          z0: p0.z,
          x1: p1.x,
          y1: p1.y,
          z1: p1.z,
          extruding,
          tool: move.tool,
          moveIndex: index
        })
      }
      toolhead.x = arcPts[arcPts.length - 1].x
      toolhead.y = arcPts[arcPts.length - 1].y
      toolhead.z = arcPts[arcPts.length - 1].z
      return
    }

    const next = {
      x: move.x ?? toolhead.x,
      y: move.y ?? toolhead.y,
      z: move.z ?? toolhead.z
    }

    const extruding = move.e != null && move.e > 0

    segments.push({
      x0: from.x,
      y0: from.y,
      z0: from.z,
      x1: next.x,
      y1: next.y,
      z1: next.z,
      extruding,
      tool: move.tool,
      moveIndex: index
    })

    toolhead.x = next.x
    toolhead.y = next.y
    toolhead.z = next.z
  }

  let index = 0
  while (index < moves.length) {
    if (shouldCancel?.()) {
      return { segments: [], moveSegmentStart: [0] }
    }
    const end = Math.min(index + chunkMoves, moves.length)
    for (; index < end; index++) {
      processMoveIndex(index)
    }
    await yieldToMainThread()
  }

  return decimateSegmentChains(segments, moves.length)
}

/** Keep segments whose source move index is within [minMove, maxMove] (inclusive). Matches 2D getPaths(layer, progress). */
export function filterSegmentsByMoveIndex (
  segments: readonly Segment3D[],
  minMove: number,
  maxMove: number
): Segment3D[] {
  return segments.filter(s => s.moveIndex >= minMove && s.moveIndex <= maxMove)
}

/**
 * Layer index for a move index (layer i starts at layers[i].move).
 * Binary search — layers are sorted by starting move index.
 */
export function getLayerIndexForMove (moveIndex: number, layers: readonly Layer[]): number {
  if (layers.length === 0) return 0
  let lo = 0
  let hi = layers.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (layers[mid].move <= moveIndex) lo = mid
    else hi = mid - 1
  }
  return lo
}
