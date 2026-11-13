// Spike: drag a loop glyph in 3D (three.js); on release, ink it with Penrose from that view.
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { compile, optimize, toSVG, showError } from "@penrose/core";
import { loopSubstance, withBrush, withView } from "./glyph-text.js";

const PAPER = 0xf5f0e3;
const INK = 0x17140f;
const TILT = 0.52;                 // glass.style's default view
const HALF = 200 / 165;            // glass.style: canvas half-width / sphere radius in px
const DIST = 5;                    // camera distance (orthographic, so only depth/fog uses it)

const [domain, glassStyle, data] = await Promise.all([
  fetch("/penrose/tammes-glyph.domain").then((r) => r.text()),
  fetch("/penrose/styles/glass.style").then((r) => r.text()),
  fetch("./data.json").then((r) => r.json()),
]);
const P = data.points.map((p) => new THREE.Vector3(...p));
const N = P.length;

// brush defaults match glass.style's brush block
const state = { loop: "A", k: 1, base: 6.5, momentum: 1.0, pressure: 1.0 };
const cycle = () => {
  const L = data.loops[state.loop];
  return L.map((_, i) => L[(state.k * i) % N]);
};

// ---------------------------------------------------------------- 3D view

const host = document.getElementById("sphere");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, DIST - 0.6, DIST + 1.6);   // far side of the sphere fades into the paper

const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 20);
// start where glass.style's default view is: the symmetry axis tilted toward the viewer
function resetView() {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -TILT);
  camera.position.set(0, 0, DIST).applyQuaternion(q);
  camera.up.set(0, 1, 0).applyQuaternion(q);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}
resetView();   // before the controls exist: they record the camera's starting pose

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

// points
const dotGeo = new THREE.SphereGeometry(0.022, 16, 12);
const dotMat = new THREE.MeshBasicMaterial({ color: 0x55504a });
for (const p of P) scene.add(new THREE.Mesh(dotGeo, dotMat).translateX(p.x).translateY(p.y).translateZ(p.z));

// contact graph: faint great-circle arcs
const arcMat = new THREE.LineBasicMaterial({ color: 0xb9b3a6 });
for (const [a, b] of data.edges) {
  const pts = Array.from({ length: 17 }, (_, i) => P[a].clone().lerp(P[b], i / 16).normalize());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat));
}

// the loop: the same momentum path as the brush model (midpoint to midpoint, the vertex as
// the control point), as a tube
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

// ---------------------------------------------------------------- Penrose ink

const ink = document.getElementById("ink");
const status = document.getElementById("status");
let pending = false, running = false;

async function inkNow() {
  if (running) return void (pending = true);
  running = true;
  ink.classList.add("busy");
  const R = new THREE.Matrix4().copy(camera.matrixWorld).invert();   // world -> view
  const t0 = performance.now();
  try {
    const compiled = await compile({
      domain, substance: loopSubstance(data.points, cycle()), style: withBrush(withView(glassStyle, R.elements), state), variation: "spike", excludeWarnings: [],
    });
    if (compiled.isErr()) throw new Error(showError(compiled.error));
    const optimized = optimize(compiled.value);
    if (optimized.isErr()) throw new Error(showError(optimized.error));
    const svg = await toSVG(optimized.value, async () => undefined, "spike");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    ink.replaceChildren(svg);
    status.textContent = `ink, Penrose · loop ${state.loop}, k = ${state.k} · ${Math.round(performance.now() - t0)} ms`;
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

// ---------------------------------------------------------------- controls

const kInput = document.getElementById("k");
const kOut = document.getElementById("kval");
kInput.addEventListener("input", () => {
  state.k = Number(kInput.value);
  kOut.textContent = state.k;
  buildLoop();
  inkNow();
});
for (const b of document.querySelectorAll("[data-loop]")) {
  b.addEventListener("click", () => {
    state.loop = b.dataset.loop;
    document.querySelectorAll("[data-loop]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    buildLoop();
    inkNow();
  });
}
// brush sliders: the 3D tube follows weight and momentum at once; the ink re-renders
// (requests made while Penrose is busy collapse into one follow-up render)
for (const [key, digits] of [["base", 1], ["momentum", 2], ["pressure", 2]]) {
  const input = document.getElementById(key);
  const out = document.getElementById(key + "val");
  input.value = state[key];
  out.textContent = state[key].toFixed(digits);
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    out.textContent = state[key].toFixed(digits);
    if (key !== "pressure") buildLoop();
    inkNow();
  });
}

document.getElementById("reset").addEventListener("click", () => {
  resetView();
  inkNow();
});

buildLoop();
resize();
inkNow();
