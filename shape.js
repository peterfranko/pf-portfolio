import * as THREE from 'three';

/* ─────────────────────────────────────────────
   SHAPE CONFIG — tweak everything here
   Live-edit from the console:  window.shape.update({ amplitude: 0.4 })
──────────────────────────────────────────── */
export const SHAPE_CONFIG = {
  // Geometry
  geometry: 'icosahedron', // 'icosahedron' | 'octahedron' | 'torusKnot' | 'sphere'
  detail: 5,               // subdivision (1–7). Higher = smoother distortion, heavier.
  radius: 1.0,

  // Torus knot specifics (only used when geometry === 'torusKnot')
  knot: { tube: 0.34, tubularSegments: 240, radialSegments: 32, p: 2, q: 3 },

  // Distortion (vertex shader noise)
  amplitude: 0.28,   // how far vertices push along normals
  frequency: 1.15,   // noise scale
  speed:     0.28,   // noise evolution over time

  // Rotation
  rotation: { x: 0.0015, y: 0.0028, z: 0.0004 },

  // Pointer parallax
  pointer:  { strength: 0.35, damping: 0.07 },

  // Look
  wireframe:     true,
  lineOpacity:   0.75,
  fresnelBoost:  0.45,   // edge glow intensity (0 disables)

  // Palette (auto-swapped in dark mode)
  light: { stroke: '#1A1713', fill: '#F5F2EC' },
  dark:  { stroke: '#EFEAE0', fill: '#15130F' },

  // Canvas
  heightVh: 44,          // viewport-height % for the container
  pixelRatioCap: 2,
  transparent: true,
};

/* ─────────────────────────────────────────────
   SHADERS
──────────────────────────────────────────── */
// Classic Ashima / Stefan Gustavson 3D simplex noise (public domain)
const NOISE_GLSL = /* glsl */`
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const VERT = /* glsl */`
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uSpeed;
varying float vNoise;
varying vec3  vNormal;
varying vec3  vViewDir;
${NOISE_GLSL}
void main() {
  float n = snoise(position * uFrequency + vec3(uTime * uSpeed));
  vNoise = n;
  vec3 displaced = position + normal * n * uAmplitude;
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vNormal  = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3  uStroke;
uniform float uOpacity;
uniform float uFresnel;
varying float vNoise;
varying vec3  vNormal;
varying vec3  vViewDir;
void main() {
  float fres = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 2.0);
  float glow = mix(1.0, 1.0 + uFresnel * 1.8, fres);
  float modu = 0.85 + 0.15 * vNoise;
  gl_FragColor = vec4(uStroke * glow, uOpacity * modu);
}`;

/* ─────────────────────────────────────────────
   MOUNT
──────────────────────────────────────────── */
export function mountShape(container, userConfig = {}) {
  const cfg = { ...SHAPE_CONFIG, ...userConfig };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3.1);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: cfg.transparent,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
  container.appendChild(renderer.domElement);

  const geometry = buildGeometry(cfg);

  const paletteFor = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? cfg.dark : cfg.light;

  const uniforms = {
    uTime:      { value: 0 },
    uAmplitude: { value: cfg.amplitude },
    uFrequency: { value: cfg.frequency },
    uSpeed:     { value: cfg.speed },
    uStroke:    { value: new THREE.Color(paletteFor().stroke) },
    uOpacity:   { value: cfg.lineOpacity },
    uFresnel:   { value: cfg.fresnelBoost },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    wireframe:   cfg.wireframe,
    depthWrite:  false,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(cfg.radius);
  scene.add(mesh);

  // Pointer parallax
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const r = container.getBoundingClientRect();
    pointer.tx = ((t.clientX - r.left) / r.width  - 0.5) * 2;
    pointer.ty = ((t.clientY - r.top)  / r.height - 0.5) * 2;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove',   onPointer, { passive: true });

  // Resize
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Color-scheme changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => uniforms.uStroke.value.set(paletteFor().stroke);
  mq.addEventListener?.('change', onScheme);

  // Animate
  const clock = new THREE.Clock();
  let raf;
  const tick = () => {
    const dt = clock.getDelta();
    const t  = clock.getElapsedTime();

    uniforms.uTime.value = t;

    const motionScale = reduceMotion ? 0 : 1;
    mesh.rotation.x += cfg.rotation.x * motionScale * 60 * dt;
    mesh.rotation.y += cfg.rotation.y * motionScale * 60 * dt;
    mesh.rotation.z += cfg.rotation.z * motionScale * 60 * dt;

    // Damped pointer tilt
    pointer.x += (pointer.tx - pointer.x) * cfg.pointer.damping;
    pointer.y += (pointer.ty - pointer.y) * cfg.pointer.damping;
    mesh.rotation.x += pointer.y * cfg.pointer.strength * 0.015;
    mesh.rotation.y += pointer.x * cfg.pointer.strength * 0.015;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  // Public API for live-editing
  const api = {
    config: cfg,
    update(patch = {}) {
      Object.assign(cfg, patch);
      if ('amplitude' in patch) uniforms.uAmplitude.value = cfg.amplitude;
      if ('frequency' in patch) uniforms.uFrequency.value = cfg.frequency;
      if ('speed'     in patch) uniforms.uSpeed.value     = cfg.speed;
      if ('lineOpacity' in patch) uniforms.uOpacity.value = cfg.lineOpacity;
      if ('fresnelBoost' in patch) uniforms.uFresnel.value = cfg.fresnelBoost;
      if ('wireframe' in patch) material.wireframe = cfg.wireframe;
      if ('radius'    in patch) mesh.scale.setScalar(cfg.radius);
      if ('geometry' in patch || 'detail' in patch || 'knot' in patch) {
        mesh.geometry.dispose();
        mesh.geometry = buildGeometry(cfg);
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove', onPointer);
      mq.removeEventListener?.('change', onScheme);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return api;
}

function buildGeometry(cfg) {
  switch (cfg.geometry) {
    case 'octahedron':
      return new THREE.OctahedronGeometry(1, cfg.detail);
    case 'sphere':
      return new THREE.SphereGeometry(1, 64, 64);
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(
        0.75, cfg.knot.tube, cfg.knot.tubularSegments,
        cfg.knot.radialSegments, cfg.knot.p, cfg.knot.q
      );
    case 'icosahedron':
    default:
      return new THREE.IcosahedronGeometry(1, cfg.detail);
  }
}

/* ─────────────────────────────────────────────
   AUTO-MOUNT
──────────────────────────────────────────── */
const host = document.querySelector('#hero-shape');
if (host) {
  try {
    window.shape = mountShape(host);
  } catch (err) {
    console.error('[hero-shape] failed to mount:', err);
  }
}
