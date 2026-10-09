// The 3D node: your sigil as a glowing object floating in a scene of your
// choosing. three.js, loaded lazily by Node3D.tsx. Everything is procedural
// (no textures or models to download), capped in pixel ratio, paused when
// off-screen or in a background tab, and drawn as a single still frame for
// people who prefer reduced motion.

import * as THREE from 'three'
import type { Scene3D } from './scene3d'

export type NodeStageOptions = {
  sigil: string
  scene: Scene3D
  /** [start, end, accent] */
  colors: [string, string, string]
  reducedMotion: boolean
}

export type NodeStage = {
  update: (opts: NodeStageOptions) => void
  /** live loudness 0..1 (mic); null → idle breathing */
  setLevelSource: (fn: (() => number) | null) => void
  dispose: () => void
}

// ─── sigil forms ─────────────────────────────────────────────────────────────

function waveCurve(amp = 0.35, len = 2.4, turns = 2, y = 0): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    pts.push(new THREE.Vector3((t - 0.5) * len, y + Math.sin(t * Math.PI * 2 * turns) * amp, Math.cos(t * Math.PI * 2 * turns) * 0.12))
  }
  return new THREE.CatmullRomCurve3(pts)
}

/** One distinct 3D form per sigil id. Returned geometries share one material. */
function sigilGeometries(id: string): THREE.BufferGeometry[] {
  switch (id) {
    case 'wave': return [new THREE.TubeGeometry(waveCurve(), 120, 0.11, 12)]
    case 'tide': return [-0.38, 0, 0.38].map(y => new THREE.TubeGeometry(waveCurve(0.16, 2.2, 2, y), 100, 0.07, 10))
    case 'hex': return [new THREE.CylinderGeometry(0.85, 0.85, 0.42, 6).rotateX(Math.PI / 2)]
    case 'eye': return [new THREE.SphereGeometry(0.72, 48, 24, 0, Math.PI), new THREE.TorusGeometry(0.95, 0.04, 12, 80)]
    case 'antenna': return [
      new THREE.ConeGeometry(0.42, 1.3, 24).translate(0, -0.25, 0),
      new THREE.TorusGeometry(0.62, 0.035, 10, 64).rotateX(Math.PI / 2).translate(0, 0.62, 0),
      new THREE.TorusGeometry(0.95, 0.03, 10, 64).rotateX(Math.PI / 2).translate(0, 0.78, 0),
    ]
    case 'spark': return [new THREE.OctahedronGeometry(0.85).scale(0.45, 1.25, 0.45), new THREE.OctahedronGeometry(0.85).scale(1.25, 0.45, 0.45)]
    case 'static': return [new THREE.BoxGeometry(1.2, 1.2, 1.2, 4, 4, 4)]
    case 'loop': return [new THREE.TorusGeometry(0.8, 0.13, 24, 120)]
    case 'gem': return [new THREE.OctahedronGeometry(0.9).scale(0.85, 1.35, 0.85)]
    case 'orbit': return [
      new THREE.SphereGeometry(0.42, 32, 16),
      new THREE.TorusGeometry(0.95, 0.03, 10, 90).rotateX(1.2),
      new THREE.TorusGeometry(1.15, 0.025, 10, 90).rotateY(1.0).rotateX(0.4),
    ]
    case 'rift': return [new THREE.TetrahedronGeometry(1.0)]
    case 'bloom': return [new THREE.IcosahedronGeometry(0.85, 1)]
    case 'comet': return [new THREE.SphereGeometry(0.42, 32, 16).translate(0.35, 0.3, 0), new THREE.ConeGeometry(0.36, 1.5, 24).rotateZ(Math.PI * 0.75).translate(-0.3, -0.32, 0)]
    case 'void': return [new THREE.DodecahedronGeometry(0.88)]
    default: return [new THREE.TorusGeometry(0.85, 0.06, 16, 120), new THREE.SphereGeometry(0.34, 32, 16)] // hz: the frequency ring
  }
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ─── scenes ──────────────────────────────────────────────────────────────────

type SceneRig = { group: THREE.Group; tick: (t: number, dt: number, level: number) => void; dispose: () => void }

function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

function pointsMaterial(color: THREE.Color, size: number, opacity = 0.9) {
  return new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
}

function buildScene(id: Scene3D, c1: THREE.Color, c2: THREE.Color, accent: THREE.Color): SceneRig {
  const group = new THREE.Group()
  const disposables: Array<{ dispose: () => void }> = []
  const rand = seeded(id.length * 977 + 13)
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x }

  let tick: SceneRig['tick'] = () => {}

  if (id === 'deep-space') {
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { pos[i * 3] = (rand() - 0.5) * 30; pos[i * 3 + 1] = (rand() - 0.5) * 20; pos[i * 3 + 2] = -rand() * 40 }
    const geo = track(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(geo, track(pointsMaterial(c2.clone().lerp(new THREE.Color('#ffffff'), 0.7), 0.11)))
    const dust = new THREE.Points(geo, track(pointsMaterial(c1, 0.16, 0.35)))
    dust.position.z = -6
    group.add(stars, dust)
    tick = (_t, dt, level) => {
      const a = geo.attributes.position as THREE.BufferAttribute
      const speed = (2.2 + level * 9) * dt
      for (let i = 0; i < n; i++) {
        let z = a.getZ(i) + speed
        if (z > 4) z -= 44
        a.setZ(i, z)
      }
      a.needsUpdate = true
    }
  } else if (id === 'rain-city') {
    group.add(new THREE.AmbientLight(0x223344, 0.6))
    const winMat = track(pointsMaterial(c2.clone().lerp(new THREE.Color('#ffd28a'), 0.5), 0.16, 1))
    const bodyMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#05070f') }))
    const winPos: number[] = []
    for (let i = 0; i < 26; i++) {
      const w = 1 + rand() * 1.6, h = 3 + rand() * 9, d = 1 + rand()
      const x = (rand() - 0.5) * 26, z = -6 - rand() * 18
      const box = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), bodyMat)
      box.position.set(x, -3 + h / 2, z)
      group.add(box)
      for (let k = 0; k < 14; k++) if (rand() > 0.35) winPos.push(x + (rand() - 0.5) * w * 0.8, -3 + rand() * h, z + d / 2 + 0.01)
    }
    const wg = track(new THREE.BufferGeometry()); wg.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3))
    group.add(new THREE.Points(wg, winMat))
    const drops = 500
    const rp = new Float32Array(drops * 6)
    for (let i = 0; i < drops; i++) {
      const x = (rand() - 0.5) * 20, y = rand() * 14 - 4, z = -rand() * 14 + 2
      rp.set([x, y, z, x - 0.05, y - 0.45, z], i * 6)
    }
    const rg = track(new THREE.BufferGeometry()); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3))
    group.add(new THREE.LineSegments(rg, track(new THREE.LineBasicMaterial({ color: c2.clone().lerp(new THREE.Color('#bcd4ff'), 0.6), transparent: true, opacity: 0.35 }))))
    tick = (_t, dt) => {
      const a = rg.attributes.position as THREE.BufferAttribute
      const fall = 11 * dt
      for (let i = 0; i < drops; i++) {
        let y0 = a.getY(i * 2) - fall
        if (y0 < -4) y0 += 14
        a.setY(i * 2, y0); a.setY(i * 2 + 1, y0 - 0.45)
      }
      a.needsUpdate = true
    }
  } else if (id === 'synth-grid') {
    const grid = new THREE.GridHelper(60, 60, accent, c1)
    const gm = grid.material as THREE.Material
    gm.transparent = true; gm.opacity = 0.55
    track(grid.geometry); track(gm)
    grid.position.y = -2.2
    const sunTex = document.createElement('canvas'); sunTex.width = 4; sunTex.height = 256
    const sg = sunTex.getContext('2d')!
    const grad = sg.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, `#${accent.clone().lerp(new THREE.Color('#ffe08a'), 0.5).getHexString()}`)
    grad.addColorStop(1, `#${c1.getHexString()}`)
    sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256)
    // synthwave sun bands
    sg.clearRect(0, 150, 4, 8); sg.clearRect(0, 180, 4, 10); sg.clearRect(0, 210, 4, 13); sg.clearRect(0, 236, 4, 16)
    const sunMap = track(new THREE.CanvasTexture(sunTex))
    const sun = new THREE.Mesh(track(new THREE.CircleGeometry(4.2, 64)), track(new THREE.MeshBasicMaterial({ map: sunMap, transparent: true, fog: false })))
    sun.position.set(0, 1.6, -26)
    const haze = new THREE.Mesh(track(new THREE.CircleGeometry(9, 64)), track(new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.22, fog: false })))
    haze.position.set(0, 1.6, -27)
    group.add(haze, sun, grid)
    tick = (t, _dt, level) => { grid.position.z = (t * (2 + level * 6)) % 1; sun.scale.setScalar(1 + level * 0.08) }
  } else if (id === 'wormhole') {
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 26; i++) {
      const col = c1.clone().lerp(c2, i / 26)
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(3.2, 0.02, 6, 90)), track(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 })))
      ring.position.z = -i * 1.6
      rings.push(ring)
      group.add(ring)
    }
    tick = (t, dt, level) => {
      for (const [i, r] of rings.entries()) {
        r.position.z += (3 + level * 10) * dt
        if (r.position.z > 3) r.position.z -= 26 * 1.6
        r.rotation.z = t * 0.2 + i * 0.12
        r.position.x = Math.sin(t * 0.5 + r.position.z * 0.15) * 0.6
        r.position.y = Math.cos(t * 0.4 + r.position.z * 0.15) * 0.4
      }
    }
  } else if (id === 'aurora-sea') {
    const geo = track(new THREE.PlaneGeometry(40, 30, 90, 60)).rotateX(-Math.PI / 2)
    const base = (geo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array
    const sea = new THREE.Points(geo, track(pointsMaterial(c2, 0.06, 0.8)))
    sea.position.set(0, -2.4, -10)
    const curtain = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 10, 1, 1)), track(new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.12, side: THREE.DoubleSide })))
    curtain.position.set(0, 3.5, -22)
    group.add(curtain, sea)
    tick = (t, _dt, level) => {
      const a = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3], z = base[i * 3 + 2]
        a.setY(i, Math.sin(x * 0.35 + t * 0.9) * 0.45 + Math.cos(z * 0.3 + t * 0.6) * 0.35 + level * Math.sin(x + t * 4) * 0.4)
      }
      a.needsUpdate = true
      ;(curtain.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 0.5) * 0.05 + level * 0.1
    }
  }

  return { group, tick, dispose: () => disposables.forEach(d => d.dispose()) }
}

// ─── stage ───────────────────────────────────────────────────────────────────

export function createNodeStage(canvas: HTMLCanvasElement, initial: NodeStageOptions): NodeStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 4.2)

  const ambient = new THREE.HemisphereLight(0x8fa8ff, 0x10061a, 0.6)
  const key = new THREE.PointLight(0xffffff, 40, 20)
  key.position.set(2.5, 2.2, 3)
  const rim = new THREE.PointLight(0xffffff, 34, 20)
  rim.position.set(-2.6, -1.2, -1.2)
  const front = new THREE.DirectionalLight(0xffffff, 0.9)
  front.position.set(0, 1, 4)
  scene.add(ambient, key, rim, front)

  const glowTex = glowTexture()
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }))
  glow.scale.setScalar(3.6)
  glow.position.z = -0.6
  scene.add(glow)

  let opts = initial
  let sigilGroup: THREE.Group | null = null
  let sigilDispose: (() => void) | null = null
  let rig: SceneRig | null = null
  let levelSource: (() => number) | null = null
  let level = 0

  const buildSigil = () => {
    if (sigilGroup) { scene.remove(sigilGroup); sigilDispose?.() }
    const accent = new THREE.Color(opts.colors[2])
    const mat = new THREE.MeshStandardMaterial({ color: accent.clone().lerp(new THREE.Color('#ffffff'), 0.15), emissive: accent, emissiveIntensity: 0.2, metalness: 0.85, roughness: 0.22, flatShading: opts.sigil === 'void' || opts.sigil === 'rift' || opts.sigil === 'gem' || opts.sigil === 'bloom' })
    // halo shell: a slightly larger back-face copy, additive, so the edges burn like neon
    const shellMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const edgeMat = new THREE.LineBasicMaterial({ color: accent.clone().lerp(new THREE.Color('#ffffff'), 0.45), transparent: true, opacity: 0.9 })
    const geos = sigilGeometries(opts.sigil)
    const group = new THREE.Group()
    const edges: THREE.BufferGeometry[] = []
    for (const g of geos) {
      group.add(new THREE.Mesh(g, mat))
      const shell = new THREE.Mesh(g, shellMat)
      shell.scale.setScalar(1.07)
      group.add(shell)
      const e = new THREE.EdgesGeometry(g, 28)
      edges.push(e)
      group.add(new THREE.LineSegments(e, edgeMat))
    }
    if (opts.sigil === 'static') mat.wireframe = true
    scene.add(group)
    sigilGroup = group
    sigilDispose = () => { geos.forEach(g => g.dispose()); edges.forEach(e => e.dispose()); mat.dispose(); edgeMat.dispose(); shellMat.dispose() }
    ;(glow.material as THREE.SpriteMaterial).color = accent
    key.color = new THREE.Color(opts.colors[1])
    rim.color = new THREE.Color(opts.colors[0])
  }

  const buildBackdrop = () => {
    if (rig) { scene.remove(rig.group); rig.dispose(); rig = null }
    if (opts.scene === 'none') { scene.fog = null; return }
    rig = buildScene(opts.scene, new THREE.Color(opts.colors[0]), new THREE.Color(opts.colors[1]), new THREE.Color(opts.colors[2]))
    scene.add(rig.group)
    scene.fog = new THREE.Fog(new THREE.Color('#030712'), 6, 38)
  }

  buildSigil()
  buildBackdrop()

  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = w / h < 0.8 ? 5.4 : 4.2
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  ro?.observe(canvas)

  // only animate while visible and the tab is in front
  let onScreen = true
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(entries => { onScreen = entries[0]?.isIntersecting ?? true }, { threshold: 0.01 })
    : null
  io?.observe(canvas)

  const clock = new THREE.Clock()
  let t = 0
  let raf = 0
  const frame = (still = false) => {
    const dt = still ? 0 : Math.min(0.05, clock.getDelta())
    t += dt
    const target = levelSource ? Math.min(1, levelSource()) : 0
    level += (target - level) * (still ? 1 : 0.18)
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.6)
    if (sigilGroup) {
      sigilGroup.rotation.y = still ? 0.6 : t * (0.45 + level * 1.4)
      sigilGroup.rotation.x = Math.sin(t * 0.4) * 0.25
      sigilGroup.position.y = Math.sin(t * 0.9) * 0.08
      sigilGroup.scale.setScalar(1 + level * 0.28 + breathe * 0.03)
      const m = (sigilGroup.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.16 + breathe * 0.12 + level * 1.2
    }
    glow.material.opacity = 0.4 + breathe * 0.12 + level * 0.4
    glow.scale.setScalar(3.4 + level * 1.6)
    camera.position.x = Math.sin(t * 0.15) * 0.25
    camera.lookAt(0, 0, 0)
    rig?.tick(t, dt, level)
    renderer.render(scene, camera)
  }
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!onScreen || document.hidden) { clock.getDelta(); return }
    frame()
  }
  if (opts.reducedMotion) frame(true)
  else loop()

  return {
    update: next => {
      const sigilChanged = next.sigil !== opts.sigil || next.colors.join() !== opts.colors.join()
      const sceneChanged = next.scene !== opts.scene || next.colors.join() !== opts.colors.join()
      const motionChanged = next.reducedMotion !== opts.reducedMotion
      opts = next
      if (sigilChanged) buildSigil()
      if (sceneChanged) buildBackdrop()
      if (motionChanged) {
        cancelAnimationFrame(raf)
        if (opts.reducedMotion) frame(true); else loop()
      } else if (opts.reducedMotion) frame(true)
    },
    setLevelSource: fn => { levelSource = fn; if (opts.reducedMotion) frame(true) },
    dispose: () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      if (rig) rig.dispose()
      sigilDispose?.()
      glowTex.dispose()
      glow.material.dispose()
      renderer.dispose()
    },
  }
}
