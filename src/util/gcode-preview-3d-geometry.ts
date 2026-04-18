import type { ArcMove, Layer, Move, Point3D } from '@/store/gcodePreview/types'
import { binarySearch } from '@/util/gcode-preview'

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

/** Same defaults as OctoPrint PrettyGCode (Marlin arc interpolation). */
export const PRETTY_GCODE_ARC = {
  mmPerArcSegment: 1.0,
  minArcSegments: 20,
  minMmPerArcSegment: 0.1,
  nArcCorrection: 24
} as const

/**
 * Marlin-style arc interpolation (PrettyGCode / MarlinFirmware).
 * Matches firmware segment length instead of uniform angle steps.
 */
export function interpolateArcPrettyGCode (
  from: Point3D,
  eFrom: number,
  move: ArcMove
): Point3D[] {
  const dest = {
    x: move.x ?? from.x,
    y: move.y ?? from.y,
    z: move.z ?? from.z
  }
  const eTo = move.e !== undefined ? move.e : eFrom

  if (move.i === undefined && move.j === undefined) {
    return sampleArcSegment(from, move, 24)
  }

  const ii = move.i ?? 0
  const jj = move.j ?? 0
  const radius = Math.hypot(ii, jj)
  if (radius < 1e-6) {
    return [from, dest]
  }

  const { mmPerArcSegment, minArcSegments, minMmPerArcSegment, nArcCorrection } = PRETTY_GCODE_ARC

  const current = { x: from.x, y: from.y, z: from.z, e: eFrom }
  const arc = {
    x: dest.x,
    y: dest.y,
    z: dest.z,
    e: eTo,
    i: ii,
    j: jj,
    is_clockwise: move.d === 'clockwise'
  }

  let vRadiusX = -1.0 * arc.i
  let vRadiusY = -1.0 * arc.j
  const centerX = current.x - vRadiusX
  const centerY = current.y - vRadiusY
  const travelZ = arc.z - current.z
  const travelE = arc.e - current.e
  const vRadiusTargetX = arc.x - centerX
  const vRadiusTargetY = arc.y - centerY

  let angularTravelTotal = Math.atan2(
    vRadiusX * vRadiusTargetY - vRadiusY * vRadiusTargetX,
    vRadiusX * vRadiusTargetX + vRadiusY * vRadiusTargetY
  )
  if (angularTravelTotal < 0) angularTravelTotal += 2.0 * Math.PI

  let mmPerSeg: number = mmPerArcSegment
  if (minArcSegments > 0) {
    mmPerSeg = radius * ((2.0 * Math.PI) / minArcSegments)
  }
  if (minMmPerArcSegment > 0 && mmPerSeg < minMmPerArcSegment) {
    mmPerSeg = minMmPerArcSegment
  }
  if (mmPerSeg > mmPerArcSegment) {
    mmPerSeg = mmPerArcSegment
  }

  if (arc.is_clockwise) {
    angularTravelTotal -= 2.0 * Math.PI
  }

  if (current.x === arc.x && current.y === arc.y && angularTravelTotal === 0) {
    angularTravelTotal += 2.0 * Math.PI
  }

  const mmOfTravelArc = Math.hypot(angularTravelTotal * radius, Math.abs(travelZ))
  const numSegments = Math.max(1, Math.ceil(mmOfTravelArc / mmPerSeg))

  const xySegmentTheta = angularTravelTotal / numSegments
  const zSegmentTheta = travelZ / numSegments
  const eSegmentTheta = travelE / numSegments

  const out: Point3D[] = [{ x: from.x, y: from.y, z: from.z }]

  if (numSegments > 1) {
    const cosT = Math.cos(xySegmentTheta)
    const sinT = Math.sin(xySegmentTheta)
    let count = 0
    for (let i = 1; i < numSegments; i++) {
      if (count < nArcCorrection) {
        const rAxisi = vRadiusX * sinT + vRadiusY * cosT
        vRadiusX = vRadiusX * cosT - vRadiusY * sinT
        vRadiusY = rAxisi
        count++
      } else {
        const sinTi = Math.sin(i * xySegmentTheta)
        const cosTi = Math.cos(i * xySegmentTheta)
        vRadiusX = (-1.0 * arc.i) * cosTi + arc.j * sinTi
        vRadiusY = (-1.0 * arc.i) * sinTi - arc.j * cosTi
        count = 0
      }
      const line = {
        x: centerX + vRadiusX,
        y: centerY + vRadiusY,
        z: current.z + zSegmentTheta,
        e: current.e + eSegmentTheta
      }
      out.push({ x: line.x, y: line.y, z: line.z })
      current.x = line.x
      current.y = line.y
      current.z = line.z
      current.e = line.e
    }
  }
  out.push({ x: arc.x, y: arc.y, z: arc.z })
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

  const chunkMoves = options?.chunkMoves ?? 4000
  const shouldCancel = options?.shouldCancel

  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  const toolhead: Point3D = { x: 0, y: 0, z: 0 }
  let toolheadE = 0
  for (let i = 0; i < Math.min(3, moves.length); i++) {
    const m = moves[i]
    if (m.x !== undefined) toolhead.x = m.x
    if (m.y !== undefined) toolhead.y = m.y
    if (m.z !== undefined) toolhead.z = m.z
    if (m.e !== undefined) toolheadE = m.e
  }

  const segments: Segment3D[] = []

  const processMoveIndex = (index: number) => {
    const move = moves[index]
    const from = { x: toolhead.x, y: toolhead.y, z: toolhead.z }

    if (isArcMove(move)) {
      let arcPts: Point3D[]
      try {
        arcPts = interpolateArcPrettyGCode(from, toolheadE, move)
      } catch {
        applyMovePosition(toolhead, move)
        if (move.e !== undefined) toolheadE = move.e
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
      if (move.e !== undefined) toolheadE = move.e
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
    if (move.e !== undefined) toolheadE = move.e
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

function interpolateToolheadFromMovesOnly (
  moves: readonly Move[],
  idx: number,
  nextIdx: number,
  t: number
): Point3D {
  const start = moves[idx]
  const x0 = start.x ?? 0
  const y0 = start.y ?? 0
  const z0 = start.z ?? 0
  if (nextIdx === idx) {
    return { x: x0, y: y0, z: z0 }
  }
  const end = moves[nextIdx]
  const x1 = end.x ?? x0
  const y1 = end.y ?? y0
  const z1 = end.z ?? z0
  return {
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
    z: z0 + (z1 - z0) * t
  }
}

/**
 * Toolhead position for `virtual_sdcard.file_position`, aligned with 3D segment geometry
 * (linear + arc polylines). Maps file byte progress between moves, then distance along
 * the decoded path within the active move.
 */
export function toolheadAtFilePosition (
  moves: readonly Move[],
  segments: readonly Segment3D[],
  moveSegmentStart: readonly number[],
  filePosition: number,
  fileSizeHint?: number | null
): Point3D {
  if (moves.length === 0) {
    return { x: 0, y: 0, z: 0 }
  }
  if (filePosition <= 0) {
    const m0 = moves[0]
    return {
      x: m0.x ?? 0,
      y: m0.y ?? 0,
      z: m0.z ?? 0
    }
  }

  let idx = binarySearch(moves, m => filePosition - m.filePosition, true)
  if (idx < 0) idx = 0
  idx = Math.max(0, Math.min(idx, moves.length - 1))

  const fp0 = moves[idx].filePosition
  const nextIdx = Math.min(idx + 1, moves.length - 1)
  const fp1 = moves[nextIdx].filePosition

  let t = 0
  if (nextIdx !== idx && fp1 > fp0) {
    t = (filePosition - fp0) / (fp1 - fp0)
  } else if (idx === moves.length - 1) {
    const endHint = fileSizeHint != null && fileSizeHint > fp0 ? fileSizeHint : fp0 + 1
    const span = endHint - fp0
    t = span > 0 ? Math.min(1, Math.max(0, (filePosition - fp0) / span)) : 1
  } else {
    t = filePosition >= fp0 ? 1 : 0
  }
  t = Math.max(0, Math.min(1, t))

  if (!segments.length || moveSegmentStart.length !== moves.length + 1) {
    return interpolateToolheadFromMovesOnly(moves, idx, nextIdx, t)
  }

  const s0 = moveSegmentStart[idx]
  const s1 = moveSegmentStart[idx + 1]

  if (s1 <= s0) {
    return interpolateToolheadFromMovesOnly(moves, idx, nextIdx, t)
  }

  const points: Point3D[] = []
  points.push({ x: segments[s0].x0, y: segments[s0].y0, z: segments[s0].z0 })
  for (let i = s0; i < s1; i++) {
    points.push({ x: segments[i].x1, y: segments[i].y1, z: segments[i].z1 })
  }

  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0, z: 0 }
  }

  const lengths: number[] = [0]
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const dz = points[i + 1].z - points[i].z
    total += Math.sqrt(dx * dx + dy * dy + dz * dz)
    lengths.push(total)
  }
  if (total < 1e-9) {
    return points[0]
  }

  const target = t * total
  for (let i = 0; i < lengths.length - 1; i++) {
    if (target <= lengths[i + 1] + 1e-9) {
      const segLen = lengths[i + 1] - lengths[i]
      const segT = segLen > 1e-9 ? (target - lengths[i]) / segLen : 0
      const a = points[i]
      const b = points[i + 1]
      return {
        x: a.x + (b.x - a.x) * segT,
        y: a.y + (b.y - a.y) * segT,
        z: a.z + (b.z - a.z) * segT
      }
    }
  }
  return points[points.length - 1]
}
