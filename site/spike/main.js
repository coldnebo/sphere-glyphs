// Spike: drag a loop glyph in 3D (three.js); on release, ink it with Penrose from that view.
// Pick a family glyph, roll a random loop, or mutate the current one; the URL always holds
// the current loop, view and brush, so any glyph can be shared or saved to the gallery.
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { compile, optimize, toSVG, showError } from "@penrose/core";
import {
  loopSubstance, withBrush, withView,
  star, encodeLoop, decodeLoop, canonicalCode, familyNames, randomLoop, mutateLoop,
} from "../lib/glyph-text.js";

const PAPER = 0xf5f0e3;
const INK = 0x17140f;
const TILT = 0.52;                 // glass.style's default view
const HALF = 200 / 165;            // glass.style: canvas half-width / sphere radius in px
const DIST = 5;                    // camera distance (orthographic, so only depth/fog uses it)
const BRUSH = { base: 6.5, momentum: 1.0, pressure: 1.0 };   // glass.style's brush block

const [domain, glassStyle, data, gallery] = await Promise.all([
  fetch("/penrose/tammes-glyph.domain").then((r) => r.text()),
  fetch("/penrose/styles/glass.style").then((r) => r.text()),
  fetch("./data.json").then((r) => r.json()),
  fetch("./gallery.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
]);
const P = data.points.map((p) => new THREE.Vector3(...p));
const N = P.length;
const FAMILY = familyNames(data.loops, data.symmetries);   // canonical code -> "A1".."C6"

// The glyph on screen is star(root, k). `family` names the root when it's A, B or C.
const state = { root: data.loops.A, family: "A", k: 1, ...BRUSH };
const cycle = () => star(state.root, state.k);

/** Short name for what's on screen: "B4" for a family glyph, else its 12-character code. */
function loopName() {
  return state.family ? `${state.family}${state.k}` : encodeLoop(cycle());
}

// ---------------------------------------------------------------- 3D view

const host = document.getElementById("sphere");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, DIST - 0.6, DIST + 1.6);   // far side of the sphere fades into the paper

const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 20);
const DEFAULT_VIEW = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -TILT);
function setView(q) {
  camera.position.set(0, 0, DIST).applyQuaternion(q);
  camera.up.set(0, 1, 0).applyQuaternion(q);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}
setView(DEFAULT_VIEW);   // before the controls exist: they record the camera's starting pose

const controls = new TrackballControls(camera, renderer.domElement);
controls.noZoom = true;
controls.noPan = true;
controls.rotateSpeed = 3.0;
controls.staticMoving = true;   // no inertia: the view stops where you let go, so the ink matches it

// rim: a circle that always faces the camera
const rim = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 128 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    }),
  ),
  new THREE.LineBasicMaterial({ color: 0x9aa3b4, transparent: true, opacity: 0.5, fog: false }),
);
scene.add(rim);

const dotGeo = new THREE.SphereGeometry(0.022, 16, 12);
const dotMat = new THREE.MeshBasicMaterial({ color: 0x55504a });
for (const p of P) scene.add(new THREE.Mesh(dotGeo, dotMat).translateX(p.x).translateY(p.y).translateZ(p.z));

// contact graph: faint great-circle arcs
const arcMat = new THREE.LineBasicMaterial({ color: 0xb9b3a6 });
for (const [a, b] of data.edges) {
  const pts = Array.from({ length: 17 }, (_, i) => P[a].clone().lerp(P[b], i / 16).normalize());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat));
}

// the loop as a tube along the brush model's path
const loopMat = new THREE.MeshBasicMaterial({ color: INK });
let loopMesh = null;
function buildLoop() {
  if (loopMesh) {
    scene.remove(loopMesh);
    loopMesh.geometry.dispose();
  }
  const c = cycle().map((i) => P[i]);
  const path = new THREE.CurvePath();
  // corner at each vertex from `cut` back along the incoming chord to `cut` along the outgoing
  // one (projection is linear, so this matches the ink exactly), then a straight run
  const cut = 0.5 * state.momentum;
  const at = (from, to, t) => from.clone().lerp(to, t);
  for (let i = 0; i < N; i++) {
    const a = c[(i + N - 1) % N], b = c[i], d = c[(i + 1) % N];
    path.add(new THREE.QuadraticBezierCurve3(at(b, a, cut), b, at(b, d, cut)));
    if (cut < 0.4999) path.add(new THREE.LineCurve3(at(b, d, cut), at(d, b, cut)));
  }
  const radius = (state.base / 2 / 165) * 0.9;   // glass.style: base px at 165 px per unit
  loopMesh = new THREE.Mesh(new THREE.TubeGeometry(path, 30 * N, radius, 8, true), loopMat);
  scene.add(loopMesh);
}

function resize() {
  const w = host.clientWidth;
  renderer.setSize(w, w, false);
  controls.handleResize();
}
new ResizeObserver(resize).observe(host);

renderer.setAnimationLoop(() => {
  controls.update();
  rim.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------- Penrose

/** World-to-view rotation for a camera orientation, as glass.style's view block wants it. */
const viewMatrix = (q) => new THREE.Matrix4().makeRotationFromQuaternion(q).invert();

async function penroseSVG(c, style) {
  const compiled = await compile({
    domain, substance: loopSubstance(data.points, c), style, variation: "spike", excludeWarnings: [],
  });
  if (compiled.isErr()) throw new Error(showError(compiled.error));
  const optimized = optimize(compiled.value);
  if (optimized.isErr()) throw new Error(showError(optimized.error));
  const svg = await toSVG(optimized.value, async () => undefined, "spike");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg;
}

const ink = document.getElementById("ink");
const status = document.getElementById("status");
let pending = false, running = false;

async function inkNow() {
  if (running) return void (pending = true);
  running = true;
  ink.classList.add("busy");
  const t0 = performance.now();
  try {
    const style = withBrush(withView(glassStyle, viewMatrix(camera.quaternion).elements), state);
    ink.replaceChildren(await penroseSVG(cycle(), style));
    status.textContent = `ink, Penrose · ${Math.round(performance.now() - t0)} ms`;
    saveToURL();
  } catch (e) {
    status.textContent = "Penrose error, see console";
    console.error(e);
  } finally {
    running = false;
    ink.classList.remove("busy");
    if (pending) {
      pending = false;
      inkNow();
    }
  }
}

controls.addEventListener("end", inkNow);

// Small renders for the family table and gallery, one at a time so the page stays responsive.
const thumbQueue = [];
let thumbsRunning = false;
function thumbnail(el, c, quaternion = DEFAULT_VIEW, brush = BRUSH) {
  thumbQueue.push(async () => {
    const style = withBrush(withView(glassStyle, viewMatrix(quaternion).elements), brush);
    el.replaceChildren(await penroseSVG(c, style));
  });
  if (!thumbsRunning) drainThumbs();
}
async function drainThumbs() {
  thumbsRunning = true;
  while (thumbQueue.length) {
    await new Promise((r) => setTimeout(r, 0));   // let input and the 3D view breathe
    try { await thumbQueue.shift()(); } catch (e) { console.error(e); }
  }
  thumbsRunning = false;
}

// ---------------------------------------------------------------- URL state
//   ?loop=B4 | ?loop=3192a56c487b   &view=qx,qy,qz,qw   &brush=weight,momentum,pressure

function stateURL() {
  const q = camera.quaternion;
  const params = new URLSearchParams({
    loop: loopName(),
    view: [q.x, q.y, q.z, q.w].map((v) => +v.toFixed(4)).join(","),
    brush: [state.base, state.momentum, state.pressure].map((v) => +v.toFixed(2)).join(","),
  });
  return `${location.origin}${location.pathname}?${params}`;
}
function saveToURL() {
  history.replaceState(null, "", stateURL());
  showLoopInfo();
}

/** Apply a {loop, view, brush} description (from the URL or a gallery entry). */
function applyCode({ loop, view, brush }) {
  const fam = /^([ABC])([1-6])$/.exec(loop ?? "");
  if (fam) Object.assign(state, { root: data.loops[fam[1]], family: fam[1], k: Number(fam[2]) });
  else if (decodeLoop(loop)) Object.assign(state, { root: decodeLoop(loop), family: null, k: 1 });

  const q = (view ?? "").split(",").map(Number);
  if (q.length === 4 && q.every(Number.isFinite) && Math.hypot(...q) > 0.5) {
    setView(new THREE.Quaternion(...q).normalize());
  }
  const b = (brush ?? "").split(",").map(Number);
  if (b.length === 3 && b.every(Number.isFinite)) {
    state.base = clamp(b[0], 1.5, 16);
    state.momentum = clamp(b[1], 0.05, 1);
    state.pressure = clamp(b[2], 0, 2.5);
  }
  syncControls();
  buildLoop();
  inkNow();
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------- controls

const kInput = document.getElementById("k");
const kOut = document.getElementById("kval");
const SLIDERS = [["base", 1], ["momentum", 2], ["pressure", 2]];

function syncControls() {
  kInput.value = state.k;
  kOut.textContent = state.k;
  for (const [key, digits] of SLIDERS) {
    document.getElementById(key).value = state[key];
    document.getElementById(key + "val").textContent = state[key].toFixed(digits);
  }
  for (const b of document.querySelectorAll("#families button")) {
    b.setAttribute("aria-pressed", String(b.dataset.name === `${state.family}${state.k}`));
  }
}

function showLoopInfo() {
  const canon = canonicalCode(cycle(), data.symmetries);
  const same = FAMILY.get(canon);
  const name = loopName();
  document.getElementById("code").textContent = name;
  document.getElementById("codeinfo").textContent =
    state.family ? `family glyph · canonical ${canon}`
    : same ? `the same glyph as ${same}, turned · canonical ${canon}`
    : `canonical ${canon}`;
}

kInput.addEventListener("input", () => {
  state.k = Number(kInput.value);
  syncControls();
  buildLoop();
  inkNow();
});

for (const [key, digits] of SLIDERS) {
  const input = document.getElementById(key);
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    document.getElementById(key + "val").textContent = state[key].toFixed(digits);
    if (key !== "pressure") buildLoop();
    inkNow();
  });
}

document.getElementById("random").addEventListener("click", () => {
  Object.assign(state, { root: randomLoop(N), family: null, k: 1 });
  syncControls();
  buildLoop();
  inkNow();
});
document.getElementById("mutate").addEventListener("click", () => {
  Object.assign(state, { root: mutateLoop(cycle()), family: null, k: 1 });
  syncControls();
  buildLoop();
  inkNow();
});
document.getElementById("reset").addEventListener("click", () => {
  setView(DEFAULT_VIEW);
  inkNow();
});

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const was = button.textContent;
    button.textContent = "copied";
    setTimeout(() => (button.textContent = was), 1200);
  } catch {
    prompt("Copy this:", text);
  }
}
document.getElementById("copylink").addEventListener("click", (e) => copy(stateURL(), e.currentTarget));
document.getElementById("copyentry").addEventListener("click", (e) => {
  const p = new URL(stateURL()).searchParams;
  const entry = { title: "untitled", loop: p.get("loop"), view: p.get("view"), brush: p.get("brush"), note: "" };
  copy(JSON.stringify(entry, null, 2) + ",", e.currentTarget);
});

// the family table: 3 surface loops x k = 1..6, each a button with its own thumbnail
const families = document.getElementById("families");
for (const r of Object.keys(data.loops)) {
  for (let k = 1; k <= 6; k++) {
    const b = document.createElement("button");
    b.className = "thumb";
    b.dataset.name = `${r}${k}`;
    b.title = `loop ${r}, k = ${k}`;
    b.innerHTML = `<div class="art"></div><span>${r}${k}</span>`;
    b.addEventListener("click", () => applyCode({ loop: `${r}${k}` }));
    families.append(b);
    thumbnail(b.querySelector(".art"), star(data.loops[r], k));
  }
}

// the curated gallery (site/spike/gallery.json)
const galleryEl = document.getElementById("gallery");
for (const entry of gallery) {
  const b = document.createElement("button");
  b.className = "thumb";
  b.title = entry.note || entry.title;
  b.innerHTML = `<div class="art"></div><span></span>`;
  b.querySelector("span").textContent = entry.title;
  b.addEventListener("click", () => applyCode(entry));
  galleryEl.append(b);
  const fam = /^([ABC])([1-6])$/.exec(entry.loop);
  const c = fam ? star(data.loops[fam[1]], Number(fam[2])) : decodeLoop(entry.loop);
  const q = (entry.view ?? "").split(",").map(Number);
  const b3 = (entry.brush ?? "").split(",").map(Number);
  if (c) {
    thumbnail(
      b.querySelector(".art"), c,
      q.length === 4 ? new THREE.Quaternion(...q).normalize() : DEFAULT_VIEW,
      b3.length === 3 ? { base: b3[0], momentum: b3[1], pressure: b3[2] } : BRUSH,
    );
  }
}
if (!gallery.length) galleryEl.textContent = "Nothing saved yet.";

// ---------------------------------------------------------------- start

resize();
applyCode(Object.fromEntries(new URLSearchParams(location.search)));
