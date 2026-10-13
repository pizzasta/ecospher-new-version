// The voice-born form: a creature grown from a VoiceGenome. Nothing is a
// preset. Your spectral envelope sets the rings around its body, your pitch
// contour sculpts it side to side, brightness grows spikes, grit roughens the
// skin, breath makes it translucent, rhythm sets how its halo turns. It is
// all vertex-shader work on one mesh plus a few hundred orbiting motes, so it
// stays light on a phone. three.js is already lazy-loaded by the node stage.

import * as THREE from 'three'
import type { VoiceGenome } from './voiceGenome'

export type EchoForm = {
  group: THREE.Group
  /** t seconds, level 0..1 (live voice loudness) */
  tick: (t: number, level: number) => void
  dispose: () => void
}

const VERT = /* glsl */ `
uniform float uTime, uLevel, uPitch, uBright, uRough, uDyn, uSeed;
uniform float uBands[12];
uniform float uContour[12];
varying vec3 vN;
varying vec3 vView;
varying float vDisp;
varying vec3 vDir;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float bandAt(float t){
  float x = clamp(t, 0.0, 1.0) * 11.0; int a = int(floor(x)); int b = min(a + 1, 11); float f = x - float(a);
  f = f * f * (3.0 - 2.0 * f);
  return mix(uBands[a], uBands[b], f);
}
float contourAt(float t){
  float x = fract(t) * 11.0; int a = int(floor(x)); int b = min(a + 1, 11); float f = x - float(a);
  f = f * f * (3.0 - 2.0 * f);
  return mix(uContour[a], uContour[b], f);
}
float disp(vec3 dir){
  float lat = dir.y * 0.5 + 0.5;
  float lon = atan(dir.z, dir.x) / 6.2831853 + 0.5;
  float rings = (bandAt(lat) - 0.45) * 0.5;
  float lobes = (contourAt(lon) - 0.5) * 0.42 * (0.4 + 0.6 * (1.0 - abs(dir.y)));
  float skin = (noise(dir * (1.4 + uBright * 2.2) + uSeed + uTime * 0.12) - 0.5) * (0.14 + uRough * 0.34);
  float ridge = 1.0 - abs(noise(dir * (3.0 + uBright * 7.0) + uSeed * 1.7 - uTime * 0.08) * 2.0 - 1.0);
  float spikes = pow(ridge, mix(3.0, 10.0, uBright)) * (0.03 + 0.2 * uBright);
  float live = uLevel * (0.10 + 0.34 * noise(dir * 4.0 + uTime * 5.0)) + uLevel * uDyn * 0.1 * sin(uTime * 14.0 + lat * 9.0);
  return rings + lobes + skin + spikes + live;
}
vec3 place(vec3 dir){
  float d = disp(dir);
  vec3 p = dir * (1.0 + d);
  p.y *= 1.0 + (uPitch - 0.5) * 0.95;
  p.xz *= 1.0 - (uPitch - 0.5) * 0.35;
  return p;
}
void main(){
  vec3 dir = normalize(position);
  vec3 t1 = normalize(cross(dir, abs(dir.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(dir, t1);
  float e = 0.012;
  vec3 p0 = place(dir);
  vec3 p1 = place(normalize(dir + t1 * e));
  vec3 p2 = place(normalize(dir + t2 * e));
  vec3 n = normalize(cross(p1 - p0, p2 - p0));
  if (dot(n, p0) < 0.0) n = -n;
  vN = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = normalize(-mv.xyz);
  vDisp = disp(dir);
  vDir = dir;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform float uTime, uBreath, uRough, uLevel;
uniform vec3 uC1, uC2, uAcc;
varying vec3 vN;
varying vec3 vView;
varying float vDisp;
varying vec3 vDir;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(vView);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + fres * 1.1 + vDisp * 2.4 + uTime * 0.04));
  vec3 base = mix(uC1, uC2, smoothstep(-0.25, 0.55, vDisp));
  float lit = 0.35 + 0.65 * max(dot(N, normalize(vec3(0.5, 0.8, 0.6))), 0.0);
  vec3 col = base * lit;
  col = mix(col, irid, 0.22 + 0.45 * fres);
  col += uAcc * fres * (1.2 + uLevel * 2.0);
  // glitch slices: the grittier the voice, the more it tears
  float slice = step(0.985 - uRough * 0.07, fract(vDir.y * 14.0 - uTime * 0.6 + sin(vDir.x * 5.0 + uTime) * 0.2));
  col += slice * uAcc * (0.25 + uRough * 0.9);
  float alpha = mix(0.96, 0.5 + fres * 0.5, uBreath);
  gl_FragColor = vec4(col, alpha);
}
`

export function createEchoForm(genome: VoiceGenome, colors: [string, string, string]): EchoForm {
  const group = new THREE.Group()
  const disposables: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x }
  const [c1, c2, acc] = colors.map(c => new THREE.Color(c)) as [THREE.Color, THREE.Color, THREE.Color]
  // a fingerprint of the genome decides the noise seed, so equal-looking voices still differ
  const seed = genome.contour.reduce((s, v, i) => s + v * (i + 1), 0) + genome.bands.reduce((s, v, i) => s + v * (i + 3), 0)

  const uniforms = {
    uTime: { value: 0 }, uLevel: { value: 0 },
    uPitch: { value: genome.pitch }, uBright: { value: genome.bright }, uRough: { value: genome.rough },
    uBreath: { value: genome.breath }, uDyn: { value: genome.dyn }, uSeed: { value: seed },
    uBands: { value: genome.bands.slice() }, uContour: { value: genome.contour.slice() },
    uC1: { value: c1.clone().lerp(new THREE.Color('#0b1030'), 0.25) }, uC2: { value: c2 }, uAcc: { value: acc },
  }
  const bodyGeo = track(new THREE.IcosahedronGeometry(1, 22))
  const bodyMat = track(new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true }))
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.scale.setScalar(0.92)
  group.add(body)

  // the core: a small hot light inside, visible through breathy skin
  const coreMat = track(new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }))
  const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.28, 3)), coreMat)
  group.add(core)

  // halo rings: tilt from your contour, spin from your rhythm
  const rings: THREE.Mesh[] = []
  const ringMat = track(new THREE.MeshBasicMaterial({ color: acc.clone().lerp(new THREE.Color('#ffffff'), 0.35), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }))
  const ringCount = 2 + Math.round(genome.tempo * 2)
  for (let i = 0; i < ringCount; i++) {
    const r = 1.35 + i * 0.22 + genome.pitch * 0.15
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.006 + genome.dyn * 0.008, 8, 160)), ringMat)
    ring.rotation.x = 0.4 + genome.contour[(i * 3) % 12] * 1.9
    ring.rotation.y = genome.contour[(i * 3 + 1) % 12] * 3.1
    rings.push(ring)
    group.add(ring)
  }

  // motes: more of them the more dynamic the voice, each riding one band's ring
  const moteCount = 70 + Math.round(genome.dyn * 190)
  const moteBase = new Float32Array(moteCount * 4) // angle, radius, speed, lift
  const motePos = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const band = i % 12
    moteBase[i * 4] = (i / moteCount) * Math.PI * 2 * 7.3
    moteBase[i * 4 + 1] = 1.25 + genome.bands[band] * 0.8 + (i % 5) * 0.05
    moteBase[i * 4 + 2] = (0.15 + genome.tempo * 0.7) * (band % 2 ? 1 : -1) * (0.6 + (band / 12) * 0.8)
    moteBase[i * 4 + 3] = (band / 11 - 0.5) * 1.7
  }
  const moteGeo = track(new THREE.BufferGeometry())
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  const motes = new THREE.Points(moteGeo, track(new THREE.PointsMaterial({
    color: acc.clone().lerp(new THREE.Color('#ffffff'), 0.5), size: 0.045, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  })))
  group.add(motes)

  const tick = (t: number, level: number) => {
    uniforms.uTime.value = t
    uniforms.uLevel.value = level
    core.scale.setScalar(1 + level * 1.3 + Math.sin(t * (1.4 + genome.tempo * 3)) * 0.08)
    coreMat.opacity = 0.55 + level * 0.45
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.12 + genome.tempo * 0.5) * (i % 2 ? -1 : 1)
      r.scale.setScalar(1 + level * 0.12)
    })
    for (let i = 0; i < moteCount; i++) {
      const a = moteBase[i * 4] + t * moteBase[i * 4 + 2] * (1 + level * 2.5)
      const rad = moteBase[i * 4 + 1] * (1 + level * 0.25)
      const lift = moteBase[i * 4 + 3]
      const flat = Math.sqrt(Math.max(0.05, 1 - (lift / 1.2) * (lift / 1.2)))
      motePos[i * 3] = Math.cos(a) * rad * flat
      motePos[i * 3 + 1] = lift + Math.sin(a * 2 + t) * 0.05
      motePos[i * 3 + 2] = Math.sin(a) * rad * flat
    }
    moteGeo.attributes.position.needsUpdate = true
  }
  tick(0, 0)

  return { group, tick, dispose: () => disposables.forEach(d => d.dispose()) }
}
