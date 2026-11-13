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
import { BRUSHES, paintGlyph } from "../lib/brush.js";
import { paintCloud } from "../lib/cloud.js";

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
// `style` is "glass" (Penrose) or a brush preset; `ink` holds the brush's own settings.
const INK_DEFAULT = { ink: 1, dryness: 1, splatter: 1, grit: 0 };
const state = { root: data.loops.A, family: "A", k: 1, ...BRUSH, style: "glass", ink: { ...INK_DEFAULT } };
const isBrush = () => state.style !== "glass" && state.style !== "cloud";
const isPainted = () => state.style !== "glass";       // brush or cloud: drawn on a canvas
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

/** The camera's world-to-view rotation as rows, the form brush.js takes. */
function viewRows(q) {
  const e = viewMatrix(q).elements;
  return [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
}

/** Paint the current glyph (brush or cloud) into a new canvas of `px` pixels. */
function brushCanvas(px, c = cycle(), q = camera.quaternion, settings = state, style = state.style) {
  const buf = { w: px, h: px, rgb: new Float32Array(px * px * 3) };
  const shape = { size: px, view: viewRows(q), base: settings.base, momentum: settings.momentum, pressure: settings.pressure };
  if (style === "cloud") paintCloud(buf, data.points, c, shape);
  else paintGlyph(buf, data.points, c, { ...shape, ...settings.ink });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(px, px);
  for (let i = 0, j = 0; i < buf.rgb.length; i += 3, j += 4) {
    img.data[j] = buf.rgb[i];
    img.data[j + 1] = buf.rgb[i + 1];
    img.data[j + 2] = buf.rgb[i + 2];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function inkNow() {
  if (running) return void (pending = true);
  running = true;
  ink.classList.add("busy");
  const t0 = performance.now();
  try {
    if (isPainted()) {
      const px = Math.round(ink.clientWidth * Math.min(2, devicePixelRatio || 1));
      ink.replaceChildren(brushCanvas(px));
      const what = state.style === "cloud" ? "point cloud" : `brush (${STYLE_NAMES[state.style] ?? "custom"})`;
      status.textContent = `${what} · ${Math.round(performance.now() - t0)} ms`;
    } else {
      const style = withBrush(withView(glassStyle, viewMatrix(camera.quaternion).elements), state);
      ink.replaceChildren(await penroseSVG(cycle(), style));
      status.textContent = `ink, Penrose · ${Math.round(performance.now() - t0)} ms`;
    }
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
function thumbnail(el, c, quaternion = DEFAULT_VIEW, brush = BRUSH, look = { style: "glass" }) {
  thumbQueue.push(async () => {
    if (look.style !== "glass") {
      const px = Math.round(el.clientWidth * Math.min(2, devicePixelRatio || 1)) || 240;
      el.replaceChildren(brushCanvas(px, c, quaternion, { ...brush, ink: look.ink ?? INK_DEFAULT }, look.style));
      return;
    }
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
//   &style=glass|wet|fluent|dry|big|formal|custom   &ink=ink,dryness,splatter,grit (brush styles)

const STYLE_NAMES = { glass: "glass", wet: "wet", fluent: "fluent", dry: "dry", big: "big brush", formal: "formal", cloud: "cloud" };

function stateParams() {
  const q = camera.quaternion;
  const params = {
    loop: loopName(),
    view: [q.x, q.y, q.z, q.w].map((v) => +v.toFixed(4)).join(","),
    brush: [state.base, state.momentum, state.pressure].map((v) => +v.toFixed(2)).join(","),
  };
  if (isPainted()) params.style = state.style;
  if (isBrush()) {
    params.ink = [state.ink.ink, state.ink.dryness, state.ink.splatter, state.ink.grit].map((v) => +v.toFixed(2)).join(",");
  }
  return params;
}
function stateURL() {
  return `${location.origin}${location.pathname}?${new URLSearchParams(stateParams())}`;
}
function saveToURL() {
  history.replaceState(null, "", stateURL());
  showLoopInfo();
}

/** Apply a {loop, view, brush, style, ink} description (from the URL or a gallery entry). */
function applyCode({ loop, view, brush, style, ink: inkParam }) {
  state.style = style && (style in STYLE_NAMES || style === "custom") ? style : "glass";
  const v = (inkParam ?? "").split(",").map(Number);
  state.ink = v.length === 4 && v.every(Number.isFinite)
    ? { ink: clamp(v[0], 0.4, 2), dryness: clamp(v[1], 0, 3), splatter: clamp(v[2], 0, 3), grit: clamp(v[3], 0, 1) }
    : { ...INK_DEFAULT, ...pick(BRUSHES[state.style] ?? {}, INK_KEYS) };
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
const INK_KEYS = ["ink", "dryness", "splatter", "grit"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

// ---------------------------------------------------------------- controls

const kInput = document.getElementById("k");
const kOut = document.getElementById("kval");
const SLIDERS = [["base", 1], ["momentum", 2], ["pressure", 2]];

const INK_SLIDERS = [["ink-amount", "ink", 2], ["dryness", "dryness", 1], ["splatter", "splatter", 1], ["grit", "grit", 2]];

function syncControls() {
  kInput.value = state.k;
  kOut.textContent = state.k;
  for (const [key, digits] of SLIDERS) {
    document.getElementById(key).value = state[key];
    document.getElementById(key + "val").textContent = state[key].toFixed(digits);
  }
  for (const [id, key, digits] of INK_SLIDERS) {
    document.getElementById(id).value = state.ink[key];
    document.getElementById(id + "val").textContent = state.ink[key].toFixed(digits);
  }
  document.querySelector(".ink-controls").hidden = !isBrush();
  for (const b of document.querySelectorAll("[data-style]")) {
    b.setAttribute("aria-pressed", String(b.dataset.style === state.style));
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

// styles: glass, or a brush preset (which sets the whole brush, weight and momentum included)
for (const b of document.querySelectorAll("[data-style]")) {
  b.addEventListener("click", () => {
    const name = b.dataset.style;
    state.style = name;
    if (name !== "glass" && name !== "cloud") {
      const preset = BRUSHES[name];
      state.ink = { ...INK_DEFAULT, ...pick(preset, INK_KEYS) };
      Object.assign(state, BRUSH, pick(preset, ["base", "momentum", "pressure"]));
    }
    syncControls();
    buildLoop();
    inkNow();
  });
}
for (const [id, key, digits] of INK_SLIDERS) {
  const input = document.getElementById(id);
  input.addEventListener("input", () => {
    state.ink[key] = Number(input.value);
    document.getElementById(id + "val").textContent = state.ink[key].toFixed(digits);
    if (state.style !== "custom") {
      state.style = "custom";
      syncControls();
    }
    inkNow();
  });
}

// ---------------------------------------------------------------- save a high-quality image

const SAVE_PX = 2400;
const SITE = "coldnebo.github.io/sphere-glyphs";

/** The credit line along the bottom: what this is, and where it came from. */
function attribution(ctx, px) {
  const name = loopName();
  const style = state.style === "cloud" ? "point cloud" : isBrush() ? `brush, ${STYLE_NAMES[state.style] ?? "custom"}` : "glass";
  ctx.font = `italic ${Math.round(px * 0.0115)}px "EB Garamond", Georgia, serif`;
  ctx.fillStyle = "rgba(70, 62, 52, 0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Sphere Glyphs · loop ${name} · ${style} · ${SITE}`, px / 2, px * 0.975);
}

async function saveImage(button) {
  const was = button.textContent;
  button.textContent = "rendering…";
  button.disabled = true;
  await new Promise((r) => setTimeout(r, 30));   // let the label update before the work
  try {
    let canvas;
    if (isPainted()) {
      canvas = brushCanvas(SAVE_PX);
    } else {
      const style = withBrush(withView(glassStyle, viewMatrix(camera.quaternion).elements), state);
      const svg = await penroseSVG(cycle(), style);
      svg.setAttribute("width", SAVE_PX);
      svg.setAttribute("height", SAVE_PX);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
      const img = new Image();
      img.src = url;
      await img.decode();
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = SAVE_PX;
      canvas.getContext("2d").drawImage(img, 0, 0, SAVE_PX, SAVE_PX);
      URL.revokeObjectURL(url);
    }
    attribution(canvas.getContext("2d"), SAVE_PX);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sphere-glyph-${loopName()}-${state.style}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    console.error(e);
    status.textContent = "could not save the image, see console";
  } finally {
    button.textContent = was;
    button.disabled = false;
  }
}
document.getElementById("save").addEventListener("click", (e) => saveImage(e.currentTarget));

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
  const entry = { title: "untitled", ...stateParams(), note: "" };
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

/** A gallery entry's style and brush ink, if it was saved with a brush. */
function entryLook({ style, ink: inkParam }) {
  if (!style || style === "glass") return { style: "glass" };
  if (style === "cloud") return { style: "cloud" };
  const v = (inkParam ?? "").split(",").map(Number);
  const ink = v.length === 4 && v.every(Number.isFinite)
    ? { ink: v[0], dryness: v[1], splatter: v[2], grit: v[3] }
    : { ...INK_DEFAULT, ...pick(BRUSHES[style] ?? {}, INK_KEYS) };
  return { style, ink };
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
      entryLook(entry),
    );
  }
}
if (!gallery.length) galleryEl.textContent = "Nothing saved yet.";

// ---------------------------------------------------------------- start

resize();
applyCode(Object.fromEntries(new URLSearchParams(location.search)));
