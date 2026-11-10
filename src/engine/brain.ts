// Procedural 3D brain (point cloud, two hemispheres + cerebellum + stem) with one glowing node per module.
// Loaded lazily from the home page so the grid view never downloads three.js.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  AdditiveBlending, NormalBlending, CanvasTexture, Color, Group, Sprite, SpriteMaterial, Mesh, SphereGeometry, MeshBasicMaterial,
  Raycaster, Vector2, Vector3, type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface BrainNode { id: string; name: string; icon: string; color: string; stat: string; activity: number; }
export interface BrainHandle { dispose(): void; }

// Region per module (direction from the hemisphere centre; +z = front, +y = top, -x = left).
const REGIONS: Record<string, [number, number, number]> = {
  mind: [-0.25, 0.45, 0.85], schedule: [0.3, 0.55, 0.75], work: [-0.55, 0.55, 0.45], jobs: [0.6, 0.5, 0.45],
  habits: [-0.15, 1, 0.05], health: [0.2, 1, -0.05], skin: [-0.5, 0.65, -0.55], hair: [0.5, 0.7, -0.5],
  people: [-1, -0.2, 0.25], notes: [1, -0.25, 0.2], money: [0.75, 0.3, -0.6], wants: [-0.3, 0.2, -1],
};
const HEMI_R = new Vector3(0.62, 0.82, 1.18);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Point on a hemisphere surface in direction d, with cortex-like folds. side = -1 left, +1 right. */
function surface(d: Vector3, side: number, shell = 1): Vector3 {
  const fold = 1 + 0.05 * Math.sin(9 * d.x + 4.1 * d.y) * Math.sin(8 * d.z - 2.7 * d.y) + 0.025 * Math.sin(17 * d.y + 9 * d.z);
  const v = new Vector3(d.x * HEMI_R.x, d.y * HEMI_R.y, d.z * HEMI_R.z).multiplyScalar(fold * shell);
  if (d.x * side < 0) v.x *= 0.3;           // flatten the medial (inner) side
  if (d.y < -0.25) v.y *= 0.75;             // flatter underside
  v.x += side * 0.36;
  return v;
}

function glowTexture(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function brainCloud(tex: Texture, light: boolean): Points {
  const rand = rng(7), pos: number[] = [], col: number[] = [];
  const a = new Color(light ? '#3b5bdb' : '#7c9cff'), b = new Color(light ? '#9c36b5' : '#c7a6ff'), tmp = new Color();
  const dir = () => { let v: Vector3; do v = new Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1); while (v.lengthSq() > 1 || v.lengthSq() < 0.01); return v.normalize(); };
  const push = (v: Vector3, dim = 1) => { pos.push(v.x, v.y, v.z); tmp.copy(a).lerp(b, (v.y + 1) / 2).multiplyScalar(dim); col.push(tmp.r, tmp.g, tmp.b); };
  for (let i = 0; i < 9000; i++) {
    const side = i % 2 ? 1 : -1, inner = rand() < 0.12;
    push(surface(dir(), side, inner ? 0.55 + rand() * 0.35 : 0.97 + rand() * 0.05), inner ? 0.35 : 1);
  }
  for (let i = 0; i < 1300; i++) {   // cerebellum
    const d = dir(), f = 1 + 0.06 * Math.sin(22 * d.y);
    push(new Vector3(d.x * 0.7 * f, -0.62 + d.y * 0.32 * f, -0.78 + d.z * 0.42 * f), 0.8);
  }
  for (let i = 0; i < 350; i++) {    // brain stem
    const t = rand(), ang = rand() * Math.PI * 2, r = 0.15 * (1 - t * 0.3);
    push(new Vector3(Math.cos(ang) * r, -0.55 - t * 0.75, -0.4 + t * 0.08 + Math.sin(ang) * r), 0.6);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return new Points(geo, new PointsMaterial({ size: 0.03, map: tex, vertexColors: true, transparent: true, opacity: light ? 0.7 : 0.8,
    depthWrite: false, blending: light ? NormalBlending : AdditiveBlending, sizeAttenuation: true }));
}

function nodePosition(id: string, i: number, n: number): Vector3 {
  let d = REGIONS[id] ? new Vector3(...REGIONS[id]) : (() => { // golden-spiral fallback for future modules
    const y = 1 - ((i + 0.5) / n) * 1.4, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    return new Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
  })();
  d = d.normalize();
  return surface(d, d.x < 0 ? -1 : 1, 1.06);
}

export function mountBrain(host: HTMLElement, nodes: BrainNode[], opts: { reducedMotion: boolean; onSelect: (id: string) => void; onSlow: () => void; onLost: () => void }): BrainHandle {
  const light = document.documentElement.dataset.theme === 'light';
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('div'); overlay.className = 'brain-labels';
  const tip = document.createElement('div'); tip.className = 'brain-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  host.append(canvas, overlay, tip);

  const scene = new Scene(), camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0.9, 0.6, 3.9);
  const tex = glowTexture();
  const brain = new Group(); scene.add(brain);
  const cloud = brainCloud(tex, light); brain.add(cloud);

  const hitGeo = new SphereGeometry(0.13, 12, 12), coreGeo = new SphereGeometry(0.035, 12, 12);
  const items = nodes.map((n, i) => {
    const pos = nodePosition(n.id, i, nodes.length);
    const glow = new Sprite(new SpriteMaterial({ map: tex, color: new Color(n.color), transparent: true, depthWrite: false,
      blending: light ? NormalBlending : AdditiveBlending, opacity: 0.35 + 0.65 * n.activity }));
    glow.position.copy(pos);
    const core = new Mesh(coreGeo, new MeshBasicMaterial({ color: new Color(n.color) })); core.position.copy(pos);
    const hit = new Mesh(hitGeo, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.copy(pos);
    hit.userData.id = n.id;
    brain.add(glow, core, hit);
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'brain-label';
    label.style.setProperty('--accent', n.color);
    label.style.opacity = String(0.55 + 0.45 * n.activity);
    label.textContent = `${n.icon} ${n.name}`;
    label.setAttribute('aria-label', `Open ${n.name}. ${n.stat}`);
    label.addEventListener('click', () => select(n.id));
    label.addEventListener('mouseenter', () => showTip(n, label));
    label.addEventListener('focus', () => showTip(n, label));
    label.addEventListener('mouseleave', hideTip); label.addEventListener('blur', hideTip);
    overlay.append(label);
    return { n, pos, glow, core, hit, label, base: 0.22 + 0.2 * n.activity, lw: 0 };
  });

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.minDistance = 2.2; controls.maxDistance = 7;
  controls.enableDamping = !opts.reducedMotion; controls.autoRotate = !opts.reducedMotion; controls.autoRotateSpeed = 0.6;
  controls.target.set(0, -0.05, 0);
  let idleTimer = 0;
  // Auto-rotate only when idle: pause while dragging, while the mouse is over the brain, or while a label has focus,
  // so moving nodes never get in the way of clicking them.
  let hovering = false, focused = false;
  const pause = () => { controls.autoRotate = false; clearTimeout(idleTimer); };
  const resume = () => {
    clearTimeout(idleTimer);
    if (!opts.reducedMotion) idleTimer = window.setTimeout(() => { if (!hovering && !focused && !zoom) controls.autoRotate = true; }, 3000);
  };
  controls.addEventListener('start', pause);
  controls.addEventListener('end', resume);
  const halt = () => { // stop leftover auto-rotate inertia at once (one undamped update zeroes the delta)
    pause();
    const d = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = d;
  };
  const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') { hovering = true; halt(); } };
  const onLeave = () => { hovering = false; hideTip(); resume(); };
  const onFocusIn = () => { focused = true; halt(); };
  const onFocusOut = () => { focused = false; resume(); };
  host.addEventListener('pointerenter', onEnter);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('focusin', onFocusIn);
  host.addEventListener('focusout', onFocusOut);

  function showTip(n: BrainNode, anchor?: HTMLElement, x?: number, y?: number): void {
    tip.replaceChildren(Object.assign(document.createElement('strong'), { textContent: `${n.icon} ${n.name}` }), document.createElement('br'), n.stat);
    tip.hidden = false;
    const hr = host.getBoundingClientRect();
    const ax = anchor ? anchor.getBoundingClientRect().left - hr.left + anchor.offsetWidth / 2 : x!;
    const ay = anchor ? anchor.getBoundingClientRect().top - hr.top : y!;
    tip.style.left = `${Math.max(8, Math.min(hr.width - 200, ax - 90))}px`;
    tip.style.top = `${Math.max(4, ay - 58)}px`;
  }
  function hideTip(): void { tip.hidden = true; }

  const ray = new Raycaster(), ndc = new Vector2();
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(items.map((it) => it.hit))[0];
    return hit ? items.find((it) => it.hit === hit.object) : undefined;
  };
  let down: { x: number; y: number } | null = null;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const it = pick(e);
    canvas.style.cursor = it ? 'pointer' : 'grab';
    const r = canvas.getBoundingClientRect();
    if (it) showTip(it.n, undefined, e.clientX - r.left, e.clientY - r.top); else hideTip();
  };
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null;
    const it = pick(e);
    if (it) select(it.n.id);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  let zoom: { from: Vector3; to: Vector3; t0: number; id: string } | null = null;
  function select(id: string): void {
    const it = items.find((x) => x.n.id === id);
    if (!it || zoom) return;
    if (opts.reducedMotion) { opts.onSelect(id); return; }
    const world = it.pos.clone().applyMatrix4(brain.matrixWorld);
    controls.autoRotate = false; controls.enabled = false;
    zoom = { from: camera.position.clone(), to: world.clone().normalize().multiplyScalar(world.length() + 0.9), t0: performance.now(), id };
  }

  const resize = () => {
    const w = host.clientWidth, hgt = host.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt; camera.updateProjectionMatrix();
    if (!fitted) { // first layout: back the camera off on narrow (portrait) screens so the whole brain fits
      fitted = true;
      const dist = Math.min(6.5, 4 / Math.min(1, Math.pow(camera.aspect, 0.85)));
      camera.position.sub(controls.target).setLength(dist).add(controls.target);
    }
  };
  let fitted = false;
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  const onLost = (e: Event) => { e.preventDefault(); opts.onLost(); };
  canvas.addEventListener('webglcontextlost', onLost);

  let raf = 0, frames = 0, slowChecked = false, tStart = 0;
  const v = new Vector3(), toCam = new Vector3();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (zoom) {
      const k = Math.min(1, (now - zoom.t0) / 700), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(zoom.from, zoom.to, e); camera.lookAt(controls.target);
      if (k >= 1) { const id = zoom.id; zoom = null; opts.onSelect(id); return; }
    } else controls.update();
    const t = now / 1000;
    const w = host.clientWidth, hgt = host.clientHeight;
    toCam.copy(camera.position).sub(controls.target).normalize();
    items.forEach((it, i) => {
      const pulse = opts.reducedMotion ? 1 : 1 + 0.18 * it.n.activity * Math.sin(t * 2.2 + i);
      it.glow.scale.setScalar(it.base * pulse);
      v.copy(it.pos).applyMatrix4(brain.matrixWorld);
      const front = v.clone().sub(controls.target).normalize().dot(toCam) > -0.15;
      v.project(camera);
      const half = (it.lw ||= it.label.offsetWidth) / 2 + 4; // width cached: no layout reads per frame
      const lx = Math.max(half, Math.min(w - half, ((v.x + 1) / 2) * w));
      it.label.style.transform = `translate(${lx}px, ${((1 - v.y) / 2) * hgt}px) translate(-50%, -150%)`;
      it.label.classList.toggle('back', !front);
    });
    renderer.render(scene, camera);
    // Performance check: if the first ~90 frames after warm-up average under ~20 fps, fall back to the grid.
    if (!slowChecked) {
      if (!tStart && now > 1000) tStart = now;
      if (tStart && ++frames === 90) { slowChecked = true; if ((now - tStart) / 90 > 50) opts.onSlow(); }
    }
  };
  const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) { tStart = 0; frames = 0; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf); clearTimeout(idleTimer);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      host.removeEventListener('pointerenter', onEnter); host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('focusin', onFocusIn); host.removeEventListener('focusout', onFocusOut);
      ro.disconnect(); controls.dispose();
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as { dispose?: () => void } | undefined; mat?.dispose?.();
      });
      tex.dispose(); renderer.dispose();
      canvas.remove(); overlay.remove(); tip.remove();
    },
  };
}
