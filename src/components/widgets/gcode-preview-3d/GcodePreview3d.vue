<template>
  <app-focusable-container
    ref="container"
    class="gcode-preview-3d-root"
    :class="{ 'gcode-preview-3d-root--fullscreen': fullscreen }"
    :disabled="disabled"
    @focus="focused = true"
    @blur="focused = false"
  >
    <div
      class="gcode-preview-3d-viewer"
      :class="{ 'gcode-preview-3d-viewer--fullscreen': fullscreen }"
    >
      <div
        ref="threeHost"
        class="gcode-preview-3d-host"
      />
      <div
        v-if="file && !disabled"
        class="gcode-preview-3d-options"
        @mousedown.stop=""
      >
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              small
              tabindex="-1"
              :retain-focus-on-click="!isMobileViewport"
              v-on="on"
              @click="zoomIn"
            >
              <v-icon dense>
                $magnifyPlus
              </v-icon>
            </v-btn>
          </template>
          <span>{{ $t('app.gcode.label.preview_3d_zoom_in') }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              small
              tabindex="-1"
              :retain-focus-on-click="!isMobileViewport"
              v-on="on"
              @click="zoomOut"
            >
              <v-icon dense>
                $magnifyMinus
              </v-icon>
            </v-btn>
          </template>
          <span>{{ $t('app.gcode.label.preview_3d_zoom_out') }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              small
              tabindex="-1"
              :disabled="!boundsFull"
              :retain-focus-on-click="!isMobileViewport"
              v-on="on"
              @click="resetCameraView"
            >
              <v-icon dense>
                $reset
              </v-icon>
            </v-btn>
          </template>
          <span>{{ $t('app.gcode.label.preview_3d_reset_view') }}</span>
        </v-tooltip>
      </div>
    </div>
    <div
      v-if="file"
      class="preview-name text-caption text--secondary px-1"
    >
      {{ file.filename }}
    </div>
  </app-focusable-container>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import StateMixin from '@/mixins/state'
import BrowserMixin from '@/mixins/browser'
import AuthMixin from '@/mixins/auth'
import type { BBox, Layer, Move, Tool } from '@/store/gcodePreview/types'
import { consola } from 'consola'
import {
  buildGcodeSegments3dAsync,
  getLayerIndexForMove,
  type Segment3D
} from '@/util/gcode-preview-3d-geometry'
import type { AppFile, AppFileWithMeta } from '@/store/files/types'

const PROGRESS_COLOR_MIN_DELTA = 256
const PROGRESS_COLOR_MIN_INTERVAL_MS = 48
const IDLE_ROTATE_AFTER_MS = 22_000
const AUTO_ROTATE_SPEED = 0.55
/** Max segments per LineSegments2 mesh to avoid long main-thread stalls and huge GPU uploads. */
const LINE_MESH_MAX_SEGMENTS = 26_000
/** Yield while classifying moves into layer buckets so the tab stays responsive. */
const CLASSIFY_YIELD_EVERY_MOVES = 8000

function disposeObject3D (obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const m = child.material
      if (Array.isArray(m)) m.forEach(x => x.dispose())
      else m?.dispose()
    }
  })
}

function createNozzleGroup (): THREE.Group {
  const group = new THREE.Group()
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4a64a,
    metalness: 0.72,
    roughness: 0.32
  })
  const steel = new THREE.MeshStandardMaterial({
    color: 0x6b7a8c,
    metalness: 0.55,
    roughness: 0.38
  })

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, 10, 20),
    brass
  )
  barrel.rotation.x = Math.PI / 2
  barrel.position.z = 5
  group.add(barrel)

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(7, 5, 6),
    steel
  )
  block.position.set(0, 0, 11)
  group.add(block)

  return group
}

type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

function computeBounds (segments: readonly Segment3D[]): Bounds | null {
  if (!segments.length) return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const s of segments) {
    minX = Math.min(minX, s.x0, s.x1)
    minY = Math.min(minY, s.y0, s.y1)
    minZ = Math.min(minZ, s.z0, s.z1)
    maxX = Math.max(maxX, s.x0, s.x1)
    maxY = Math.max(maxY, s.y0, s.y1)
    maxZ = Math.max(maxZ, s.z0, s.z1)
  }
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

@Component({})
export default class GcodePreview3d extends Mixins(StateMixin, BrowserMixin, AuthMixin) {
  @Prop({ type: Boolean, default: false })
  readonly disabled?: boolean

  @Prop({ type: Boolean, default: false })
  readonly fullscreen?: boolean

  @Prop({ type: Number, default: 0 })
  readonly layer!: number

  @Prop({ type: Number, default: 0 })
  readonly moveProgress!: number

  @Prop({ type: Boolean, default: false })
  readonly useLiveToolhead!: boolean

  @Prop({ type: Boolean, default: true })
  readonly showPreviousLayers!: boolean

  @Prop({ type: Boolean, default: false })
  readonly showNextLayers!: boolean

  @Prop({ type: Boolean, default: false })
  readonly showTravels!: boolean

  @Prop({ type: Boolean, default: true })
  readonly showPrinthead!: boolean

  focused = false

  threeHost: HTMLDivElement | null = null
  renderer: THREE.WebGLRenderer | null = null
  scene: THREE.Scene | null = null
  camera: THREE.PerspectiveCamera | null = null
  controls: OrbitControls | null = null
  private linePreviousChunks: LineSegments2[] = []
  private lineCurrentChunks: LineSegments2[] = []
  private lineNextChunks: LineSegments2[] = []
  nozzleGroup: THREE.Group | null = null
  gridHelper: THREE.GridHelper | null = null
  resizeObserver: ResizeObserver | null = null
  rafId = 0
  private visibilityHandler: (() => void) | null = null
  private documentHidden = false

  private allSegments: Segment3D[] = []
  /** Index table: start index in `allSegments` per move (length moves.length + 1). */
  private moveSegmentStart: number[] = []
  private segmentBuildGen = 0
  /** Bumps when visible geometry rebuild is superseded (new file / layer / options). */
  private geometryBuildGen = 0
  /** Current layer slice (for progress coloring). */
  segmentsCurrent: Segment3D[] = []
  /** One interleaved color buffer per current-layer chunk (6 floats per segment). */
  private lineCurrentColorArrays: Float32Array[] = []
  displayNozzle = new THREE.Vector3()
  private tmpToolhead = new THREE.Vector3()
  private zoomOffset = new THREE.Vector3()
  private lastColorUpdateFp = -1
  private lastColorUpdateTime = 0
  private lastAnimTime = 0

  /** Full model bounds; grid + initial framing use this only (stable view). */
  private boundsFull: Bounds | null = null
  private cameraHasBeenFramed = false
  private lastUserInteraction = 0

  get moves (): readonly Move[] {
    return this.$typedState.gcodePreview.moves
  }

  get file (): AppFile | AppFileWithMeta | null {
    return this.$typedState.gcodePreview.file
  }

  get filePosition (): number {
    return this.$typedState.printer.printer.virtual_sdcard?.file_position ?? 0
  }

  get themeIsDark (): boolean {
    return this.$typedState.config.uiSettings.theme.isDark
  }

  get toolColors (): Record<Tool, string> {
    return this.$typedGetters['gcodePreview/getToolColors']
  }

  get layers (): readonly Layer[] {
    return this.$typedGetters['gcodePreview/getLayers']
  }

  @Watch('moves')
  onMovesChanged () {
    this.$nextTick(() => this.rebuildAllFromMoves())
  }

  @Watch('file')
  onFileChanged () {
    this.$nextTick(() => this.rebuildAllFromMoves())
  }

  @Watch('layer')
  onLayerChanged () {
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  @Watch('moveProgress')
  onMoveProgressChanged () {
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  @Watch('showPreviousLayers')
  onShowPreviousLayersChanged () {
    this.touchPreviewInteraction()
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  @Watch('showNextLayers')
  onShowNextLayersChanged () {
    this.touchPreviewInteraction()
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  @Watch('showTravels')
  onShowTravelsChanged () {
    this.touchPreviewInteraction()
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  @Watch('showPrinthead')
  onShowPrintheadChanged () {
    if (this.nozzleGroup) {
      this.nozzleGroup.visible = this.showPrinthead
    }
  }

  @Watch('themeIsDark')
  onThemeChanged () {
    if (this.scene && this.renderer) {
      const bg = this.themeIsDark ? 0x121212 : 0xdcdcdc
      this.scene.background = new THREE.Color(bg)
      this.renderer.setClearColor(bg, 1)
    }
    this.$nextTick(() => this.rebuildVisibleGeometry())
  }

  mounted () {
    this.threeHost = this.$refs.threeHost as HTMLDivElement
    this.lastUserInteraction = performance.now()
    this.visibilityHandler = () => {
      this.documentHidden = document.visibilityState === 'hidden'
      if (this.documentHidden && this.controls) {
        this.controls.autoRotate = false
      }
    }
    document.addEventListener('visibilitychange', this.visibilityHandler)
    this.initThree()
    this.rebuildAllFromMoves()
    this.startAnimate()
  }

  beforeDestroy () {
    this.segmentBuildGen++
    this.geometryBuildGen++
    document.removeEventListener('visibilitychange', this.visibilityHandler!)
    cancelAnimationFrame(this.rafId)
    this.resizeObserver?.disconnect()
    this.controls?.removeEventListener('start', this.onControlsStart)
    this.controls?.dispose()
    this.disposeAllLines()
    if (this.gridHelper && this.scene) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.dispose()
      this.gridHelper = null
    }
    if (this.nozzleGroup && this.scene) {
      this.scene.remove(this.nozzleGroup)
      disposeObject3D(this.nozzleGroup)
      this.nozzleGroup = null
    }
    if (this.renderer) {
      const canvas = this.renderer.domElement
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      this.renderer.dispose()
      this.renderer = null
    }
  }

  private onControlsStart = () => {
    this.touchPreviewInteraction()
  }

  touchPreviewInteraction () {
    this.lastUserInteraction = performance.now()
    if (this.controls) {
      this.controls.autoRotate = false
    }
  }

  initThree () {
    if (!this.threeHost) return

    const w = this.threeHost.clientWidth || 400
    const h = this.threeHost.clientHeight || 320

    this.scene = new THREE.Scene()
    const bg = this.themeIsDark ? 0x121212 : 0xdcdcdc
    this.scene.background = new THREE.Color(bg)

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100000)
    this.camera.up.set(0, 0, 1)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.threeHost.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 2
    this.controls.maxDistance = 500_000
    /** Wheel zoom moves toward the pointer (default false = always dolly toward orbit target). */
    this.controls.zoomToCursor = true
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED
    this.controls.addEventListener('start', this.onControlsStart)

    const hemi = new THREE.HemisphereLight(0xc8d8e8, 0x404550, 0.55)
    this.scene.add(hemi)

    const ambient = new THREE.AmbientLight(0xffffff, 0.28)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 0.95)
    key.position.set(40, -30, 80)
    key.castShadow = false
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xaaccff, 0.35)
    fill.position.set(-50, 40, 20)
    this.scene.add(fill)

    this.nozzleGroup = createNozzleGroup()
    this.nozzleGroup.visible = this.showPrinthead
    this.scene.add(this.nozzleGroup)

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.threeHost || !this.camera || !this.renderer) return
      const rw = this.threeHost.clientWidth
      const rh = this.threeHost.clientHeight
      if (rw < 2 || rh < 2) return
      this.camera.aspect = rw / rh
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(rw, rh)
    })
    this.resizeObserver.observe(this.threeHost)
  }

  rebuildAllFromMoves () {
    if (!this.scene) return

    if (!this.moves.length) {
      this.segmentBuildGen++
      this.geometryBuildGen++
      this.allSegments = []
      this.moveSegmentStart = []
      this.segmentsCurrent = []
      this.boundsFull = null
      this.cameraHasBeenFramed = false
      this.disposeAllLines()
      this.disposeGrid()
      return
    }

    this.segmentBuildGen++
    this.geometryBuildGen++
    const gen = this.segmentBuildGen
    this.disposeAllLines()
    this.segmentsCurrent = []
    this.allSegments = []
    this.moveSegmentStart = []

    this.boundsFull = this.boundsFromStore()
    if (this.boundsFull) {
      this.updateGridForFullBounds()
      if (!this.cameraHasBeenFramed) {
        this.frameCameraToBounds(this.boundsFull)
        this.cameraHasBeenFramed = true
      }
    }

    this.runSegmentBuild(gen).catch(() => {})
  }

  private getLineMaterialResolution (): THREE.Vector2 {
    const w = this.threeHost?.clientWidth || 400
    const h = this.threeHost?.clientHeight || 320
    return new THREE.Vector2(w, h)
  }

  private boundsFromStore (): Bounds | null {
    const b = this.$typedGetters['gcodePreview/getBounds'] as Readonly<BBox>
    if (!b || !Number.isFinite(b.x.min) || !Number.isFinite(b.x.max)) return null
    const layers = this.layers
    const zMax = layers.length ? Math.max(10, ...layers.map(l => l.z)) : 50
    return {
      minX: b.x.min,
      maxX: b.x.max,
      minY: b.y.min,
      maxY: b.y.max,
      minZ: 0,
      maxZ: zMax
    }
  }

  private async runSegmentBuild (gen: number) {
    try {
      const result = await buildGcodeSegments3dAsync(this.moves, {
        shouldCancel: () => gen !== this.segmentBuildGen
      })
      if (gen !== this.segmentBuildGen || !this.scene) return

      this.allSegments = result.segments
      this.moveSegmentStart = result.moveSegmentStart

      if (!this.boundsFull && this.allSegments.length) {
        this.boundsFull = computeBounds(this.allSegments)
        if (this.boundsFull) {
          this.updateGridForFullBounds()
          if (!this.cameraHasBeenFramed) {
            this.frameCameraToBounds(this.boundsFull)
            this.cameraHasBeenFramed = true
          }
        }
      }

      this.rebuildVisibleGeometry()
    } catch (e) {
      consola.error('[GcodePreview3d] segment build', e)
    }
  }

  rebuildVisibleGeometry () {
    this.scheduleRebuildVisibleGeometry()
  }

  private scheduleRebuildVisibleGeometry () {
    this.geometryBuildGen++
    const gen = this.geometryBuildGen
    void this.runRebuildVisibleGeometry(gen)
  }

  private yieldForGeometry (): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(), { timeout: 48 })
      } else {
        requestAnimationFrame(() => resolve())
      }
    })
  }

  private async runRebuildVisibleGeometry (gen: number) {
    await this.yieldForGeometry()
    if (gen !== this.geometryBuildGen || !this.scene || !this.boundsFull) return

    const moves = this.moves
    const segments = this.allSegments
    const mStart = this.moveSegmentStart
    if (!segments.length || mStart.length !== moves.length + 1) {
      this.disposeAllLines()
      this.segmentsCurrent = []
      this.syncNozzleTarget(true)
      return
    }

    const layers = this.layers
    const L = this.layer
    const P = this.moveProgress
    const layerStart = layers[L]?.move ?? 0

    const prevSegs: Segment3D[] = []
    const curSegs: Segment3D[] = []
    const nextSegs: Segment3D[] = []

    const travelOk = (s: Segment3D) => this.showTravels || s.extruding

    for (let mi = 0; mi < moves.length; mi++) {
      if (gen !== this.geometryBuildGen || !this.scene) return
      const li = getLayerIndexForMove(mi, layers)
      let bucket: 'prev' | 'cur' | 'next' | null = null
      if (li < L && this.showPreviousLayers) bucket = 'prev'
      else if (li === L && mi >= layerStart && mi <= P) bucket = 'cur'
      else if (li > L && this.showNextLayers) bucket = 'next'
      if (bucket === null) continue

      const s0 = mStart[mi]
      const s1 = mStart[mi + 1]
      for (let si = s0; si < s1; si++) {
        const s = segments[si]
        if (!travelOk(s)) continue
        if (bucket === 'prev') prevSegs.push(s)
        else if (bucket === 'cur') curSegs.push(s)
        else nextSegs.push(s)
      }

      if (mi > 0 && mi % CLASSIFY_YIELD_EVERY_MOVES === 0) {
        await this.yieldForGeometry()
        if (gen !== this.geometryBuildGen || !this.scene) return
      }
    }

    if (gen !== this.geometryBuildGen || !this.scene) return

    this.segmentsCurrent = curSegs
    this.disposeAllLines()

    await this.addLineMeshesInChunks(prevSegs, 'previous', gen)
    await this.addLineMeshesInChunks(nextSegs, 'next', gen)
    await this.addLineMeshesInChunks(curSegs, 'current', gen)

    if (gen !== this.geometryBuildGen || !this.scene) return

    const now = performance.now()
    this.lastColorUpdateFp = this.filePosition
    this.lastColorUpdateTime = now
    this.syncNozzleTarget(true)
  }

  private buildPreviousLineMesh (slice: Segment3D[]): LineSegments2 {
    const pos: number[] = []
    const col: number[] = []
    const res = this.getLineMaterialResolution()
    const dark = this.themeIsDark
    const exR = dark ? 0.78 : 0.83
    const exG = dark ? 0.70 : 0.77
    const exB = dark ? 0.55 : 0.66
    const trR = dark ? 0.48 : 0.62
    const trG = dark ? 0.42 : 0.56
    const trB = dark ? 0.36 : 0.48
    for (const s of slice) {
      pos.push(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1)
      if (s.extruding) {
        col.push(exR, exG, exB, exR, exG, exB)
      } else {
        col.push(trR, trG, trB, trR, trG, trB)
      }
    }
    const geom = new LineSegmentsGeometry()
    geom.setPositions(new Float32Array(pos))
    geom.setColors(new Float32Array(col))
    const mat = new LineMaterial({
      color: 0xffffff,
      linewidth: 2.35,
      vertexColors: true,
      resolution: res.clone(),
      depthWrite: true,
      depthTest: true
    })
    const line = new LineSegments2(geom, mat)
    line.renderOrder = 1
    return line
  }

  private buildNextLineMesh (slice: Segment3D[]): LineSegments2 {
    const pos: number[] = []
    const res = this.getLineMaterialResolution()
    for (const s of slice) {
      pos.push(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1)
    }
    const geom = new LineSegmentsGeometry()
    geom.setPositions(new Float32Array(pos))
    const mat = new LineMaterial({
      color: this.themeIsDark ? 0x6a7580 : 0x9aa8b0,
      linewidth: 2,
      resolution: res.clone(),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      depthTest: true
    })
    const line = new LineSegments2(geom, mat)
    line.renderOrder = 0
    return line
  }

  private buildCurrentLineMesh (slice: Segment3D[]): { mesh: LineSegments2, colorArray: Float32Array } {
    const pos: number[] = []
    const col: number[] = []
    const res = this.getLineMaterialResolution()
    const fp = this.filePosition
    const dark = this.themeIsDark
    const cDone = new THREE.Color()
    const cTodo = new THREE.Color()
    const cTravelDone = new THREE.Color(0x5c7cba)
    const cTravelTodo = new THREE.Color(0x2a3540)
    const cTravelDoneDark = new THREE.Color(0x7a9bdc)
    const cTravelTodoDark = new THREE.Color(0x3d4d5c)
    const td = dark ? cTravelDoneDark : cTravelDone
    const tt = dark ? cTravelTodoDark : cTravelTodo

    for (const s of slice) {
      const moveFp = this.moves[s.moveIndex]?.filePosition ?? 0
      const done = moveFp <= fp
      pos.push(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1)
      if (s.extruding) {
        const tool = `T${s.tool}` as Tool
        const hex = this.toolColors[tool] ?? '#1fb0ff'
        cDone.set(hex)
        cTodo.copy(cDone).multiplyScalar(dark ? 0.42 : 0.5)
        const c = done ? cDone : cTodo
        col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      } else {
        const c = done ? td : tt
        col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      }
    }

    const geom = new LineSegmentsGeometry()
    geom.setPositions(new Float32Array(pos))
    geom.setColors(new Float32Array(col))
    const startAttr = geom.getAttribute('instanceColorStart')
    const ib = startAttr.data as THREE.InterleavedBuffer
    const colorArray = ib.array as Float32Array

    const mat = new LineMaterial({
      color: 0xffffff,
      linewidth: 2.85,
      vertexColors: true,
      resolution: res.clone(),
      depthWrite: true,
      depthTest: true
    })
    const mesh = new LineSegments2(geom, mat)
    mesh.renderOrder = 2
    return { mesh, colorArray }
  }

  private async addLineMeshesInChunks (
    segs: Segment3D[],
    kind: 'previous' | 'current' | 'next',
    gen: number
  ) {
    if (!segs.length || !this.scene) return
    const max = LINE_MESH_MAX_SEGMENTS
    for (let i = 0; i < segs.length; i += max) {
      if (gen !== this.geometryBuildGen || !this.scene) return
      const slice = segs.slice(i, i + max)
      if (kind === 'previous') {
        const mesh = this.buildPreviousLineMesh(slice)
        this.linePreviousChunks.push(mesh)
        this.scene.add(mesh)
      } else if (kind === 'next') {
        const mesh = this.buildNextLineMesh(slice)
        this.lineNextChunks.push(mesh)
        this.scene.add(mesh)
      } else {
        const { mesh, colorArray } = this.buildCurrentLineMesh(slice)
        this.lineCurrentChunks.push(mesh)
        this.lineCurrentColorArrays.push(colorArray)
        this.scene.add(mesh)
      }
      await this.yieldForGeometry()
    }
  }

  private disposeAllLines () {
    if (!this.scene) return
    const disposeChunk = (line: LineSegments2) => {
      this.scene!.remove(line)
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    }
    for (const l of this.linePreviousChunks) disposeChunk(l)
    for (const l of this.lineCurrentChunks) disposeChunk(l)
    for (const l of this.lineNextChunks) disposeChunk(l)
    this.linePreviousChunks = []
    this.lineCurrentChunks = []
    this.lineNextChunks = []
    this.lineCurrentColorArrays = []
  }

  private disposeGrid () {
    if (this.gridHelper && this.scene) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.dispose()
      this.gridHelper = null
    }
  }

  private updateGridForFullBounds () {
    if (!this.scene || !this.boundsFull) return

    const { minX, maxX, minY, maxY } = this.boundsFull
    const span = Math.max(maxX - minX, maxY - minY, 50)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    this.disposeGrid()

    const gridSize = Math.min(2000, Math.max(100, span * 1.15))
    const divisions = Math.min(60, Math.max(10, Math.round(gridSize / 15)))
    const gridCol1 = this.themeIsDark ? 0x556677 : 0x9aa8b8
    const gridCol2 = this.themeIsDark ? 0x3a4550 : 0x6a7a8a
    this.gridHelper = new THREE.GridHelper(gridSize, divisions, gridCol1, gridCol2)
    this.gridHelper.rotation.x = Math.PI / 2
    this.gridHelper.position.set(cx, cy, 0)
    this.scene.add(this.gridHelper)
  }

  shouldUpdateProgressColors (fp: number, now: number): boolean {
    if (!this.lineCurrentColorArrays.length || !this.segmentsCurrent.length) return false
    if (fp === this.lastColorUpdateFp) return false
    const byteDelta = Math.abs(fp - this.lastColorUpdateFp)
    if (byteDelta >= PROGRESS_COLOR_MIN_DELTA) return true
    if (now - this.lastColorUpdateTime >= PROGRESS_COLOR_MIN_INTERVAL_MS) return true
    return false
  }

  updateProgressColors (fp: number) {
    if (!this.lineCurrentColorArrays.length || !this.segmentsCurrent.length || !this.moves.length) return

    const cDone = new THREE.Color()
    const cTodo = new THREE.Color()
    const cTravelDone = new THREE.Color(this.themeIsDark ? 0x7a9bdc : 0x5c7cba)
    const cTravelTodo = new THREE.Color(this.themeIsDark ? 0x3d4d5c : 0x2a3540)

    let segIdx = 0
    for (let ci = 0; ci < this.lineCurrentColorArrays.length; ci++) {
      const arr = this.lineCurrentColorArrays[ci]
      const nSeg = arr.length / 6
      for (let j = 0; j < nSeg; j++) {
        const s = this.segmentsCurrent[segIdx++]
        if (!s) break
        const moveFp = this.moves[s.moveIndex]?.filePosition ?? 0
        const done = moveFp <= fp
        const o = j * 6
        if (s.extruding) {
          const tool = `T${s.tool}` as Tool
          const hex = this.toolColors[tool] ?? '#1fb0ff'
          cDone.set(hex)
          cTodo.copy(cDone).multiplyScalar(this.themeIsDark ? 0.42 : 0.5)
          const c = done ? cDone : cTodo
          arr[o] = c.r
          arr[o + 1] = c.g
          arr[o + 2] = c.b
          arr[o + 3] = c.r
          arr[o + 4] = c.g
          arr[o + 5] = c.b
        } else {
          const c = done ? cTravelDone : cTravelTodo
          arr[o] = c.r
          arr[o + 1] = c.g
          arr[o + 2] = c.b
          arr[o + 3] = c.r
          arr[o + 4] = c.g
          arr[o + 5] = c.b
        }
      }
      const mesh = this.lineCurrentChunks[ci]
      const g = mesh?.geometry as LineSegmentsGeometry | undefined
      if (g) {
        const a = g.getAttribute('instanceColorStart')
        const b = g.getAttribute('instanceColorEnd')
        if (a) a.needsUpdate = true
        if (b) b.needsUpdate = true
      }
    }
    this.lastColorUpdateFp = fp
    this.lastColorUpdateTime = performance.now()
  }

  getInterpolatedFileToolhead (out: THREE.Vector3): THREE.Vector3 {
    const moves = this.moves
    const fp = this.filePosition
    if (moves.length === 0) {
      return out.set(0, 0, 0)
    }
    let idx = this.$typedGetters['gcodePreview/getMoveIndexByFilePosition'](fp)
    idx = Math.max(0, Math.min(idx, moves.length - 1))
    const nextIdx = Math.min(idx + 1, moves.length - 1)
    const fp0 = moves[idx].filePosition
    const fp1 = moves[nextIdx].filePosition
    let t = 0
    if (fp1 > fp0 && nextIdx !== idx) {
      t = (fp - fp0) / (fp1 - fp0)
    }
    t = Math.max(0, Math.min(1, t))
    const p0 = this.$typedGetters['gcodePreview/getToolHeadPosition'](idx)
    const p1 = this.$typedGetters['gcodePreview/getToolHeadPosition'](nextIdx)
    return out.set(
      p0.x + (p1.x - p0.x) * t,
      p0.y + (p1.y - p0.y) * t,
      p0.z + (p1.z - p0.z) * t
    )
  }

  getLiveToolheadPosition (out: THREE.Vector3): THREE.Vector3 {
    const mr = this.$typedState.printer.printer.motion_report
    const th = this.$typedState.printer.printer.toolhead
    const lp = mr?.live_position
    if (lp != null && lp.length >= 3) {
      return out.set(lp[0], lp[1], lp[2])
    }
    const pos = th.position
    return out.set(pos[0], pos[1], pos[2])
  }

  syncNozzleTarget (snap = false) {
    if (!this.nozzleGroup) return
    if (this.useLiveToolhead && this.klippyReady) {
      this.getLiveToolheadPosition(this.tmpToolhead)
      if (snap) {
        this.displayNozzle.copy(this.tmpToolhead)
      }
    } else {
      this.getInterpolatedFileToolhead(this.tmpToolhead)
      if (snap) {
        this.displayNozzle.copy(this.tmpToolhead)
      }
    }
    this.nozzleGroup.position.copy(this.displayNozzle)
  }

  frameCameraToBounds (b: Bounds) {
    if (!this.camera || !this.controls) return

    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ, 50)

    this.camera.position.set(cx + size * 0.9, cy - size * 0.9, cz + size * 0.75)
    this.controls.target.set(cx, cy, cz)
    this.controls.cursor.set(cx, cy, cz)
    this.controls.update()
  }

  zoomIn () {
    this.dollyCamera(0.88)
  }

  zoomOut () {
    this.dollyCamera(1 / 0.88)
  }

  private dollyCamera (factor: number) {
    if (!this.camera || !this.controls) return
    this.touchPreviewInteraction()
    const minD = this.controls.minDistance
    const maxD = this.controls.maxDistance
    this.zoomOffset.copy(this.camera.position).sub(this.controls.target)
    let len = this.zoomOffset.length()
    if (len < 1e-6) return
    this.zoomOffset.multiplyScalar(factor)
    len = this.zoomOffset.length()
    if (len < minD) {
      this.zoomOffset.normalize().multiplyScalar(minD)
    } else if (len > maxD) {
      this.zoomOffset.normalize().multiplyScalar(maxD)
    }
    this.camera.position.copy(this.controls.target).add(this.zoomOffset)
    this.controls.update()
  }

  resetCameraView () {
    if (!this.boundsFull) return
    this.touchPreviewInteraction()
    this.frameCameraToBounds(this.boundsFull)
  }

  startAnimate () {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick)
      if (!this.renderer || !this.scene || !this.camera || !this.controls || !this.nozzleGroup) {
        return
      }
      if (this.documentHidden) {
        return
      }

      const fp = this.filePosition
      const now = performance.now()
      if (this.shouldUpdateProgressColors(fp, now)) {
        this.updateProgressColors(fp)
      }

      const dt = this.lastAnimTime > 0 ? Math.min(0.12, (now - this.lastAnimTime) / 1000) : 1 / 60
      this.lastAnimTime = now

      if (this.useLiveToolhead && this.klippyReady) {
        this.getLiveToolheadPosition(this.tmpToolhead)
        const lambda = 48
        const alpha = 1 - Math.exp(-lambda * dt)
        this.displayNozzle.lerp(this.tmpToolhead, alpha)
        if (this.displayNozzle.distanceToSquared(this.tmpToolhead) < 2.5e-7) {
          this.displayNozzle.copy(this.tmpToolhead)
        }
      } else {
        this.getInterpolatedFileToolhead(this.tmpToolhead)
        const lambda = 16
        const alpha = 1 - Math.exp(-lambda * dt)
        this.displayNozzle.lerp(this.tmpToolhead, alpha)
      }
      this.nozzleGroup.position.copy(this.displayNozzle)

      if (now - this.lastUserInteraction >= IDLE_ROTATE_AFTER_MS) {
        this.controls.autoRotate = true
      }

      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }
}
</script>

<style scoped>
.gcode-preview-3d-root {
  position: relative;
  width: 100%;
}

.gcode-preview-3d-root--fullscreen {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.gcode-preview-3d-viewer {
  position: relative;
  width: 100%;
  min-height: 320px;
  height: 48vh;
}

.gcode-preview-3d-viewer--fullscreen {
  flex: 1 1 auto;
  min-height: 240px;
  height: auto !important;
}

.gcode-preview-3d-host {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.gcode-preview-3d-host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.gcode-preview-3d-options {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  padding: 2px 4px;
  border-bottom-right-radius: 4px;
  background: rgba(0, 0, 0, 0.75);
  font-weight: 100;
}

.theme--light .gcode-preview-3d-options {
  background: rgba(255, 255, 255, 0.75);
}

.preview-name {
  position: absolute;
  bottom: 4px;
  left: 4px;
  pointer-events: none;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
