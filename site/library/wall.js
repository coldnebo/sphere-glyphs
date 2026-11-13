// The Library wall: an endless grid over all 29,940,480 glyphs. Only the rows on screen exist;
// they are reused as you scroll. Glyph n comes from the Library index (lib/library.js) and is
// drawn by the canvas sketch renderer (lib/sketch.js).
import { Library } from "../lib/library.js";
import { drawGlyph } from "../lib/sketch.js";
import { encodeLoop } from "../lib/glyph-text.js";

const DATA = "../spike/data.json";         // the build points these at the packaged copies
const EXPLORER = "../spike/";

const [data, counts] = await Promise.all([
  fetch(DATA).then((r) => r.json()),
  fetch("index.bin").then((r) => r.arrayBuffer()).then((b) => new Uint16Array(b)),
]);
const library = new Library(counts, data.symmetries);
const TOTAL = library.size;
const fmt = (n) => n.toLocaleString("en");
document.getElementById("total").textContent = fmt(TOTAL);

const wall = document.getElementById("wall");
const bar = document.querySelector(".bar");
const track = document.getElementById("track");
const thumb = document.getElementById("thumb");
const positionEl = document.getElementById("position");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- layout

const view = { cols: 6, tile: 180, rowH: 210, top: 0, rows: 0, totalRows: 0, barH: 0 };
const pool = [];   // row elements: { el, row, tiles: [{ a, canvas, span }] }

function layout() {
  const keepFirst = Math.floor(view.top) * view.cols;     // keep the first visible glyph in place
  const width = innerWidth - 28;                          // leave room for the track
  view.cols = Math.max(3, Math.min(10, Math.round(width / 190)));
  view.tile = width / view.cols;
  view.rowH = view.tile + 18;
  view.barH = bar.offsetHeight;
  view.rows = Math.ceil((innerHeight - view.barH) / view.rowH) + 2;
  view.totalRows = Math.ceil(TOTAL / view.cols);
  view.top = clampTop(keepFirst / view.cols);

  const dpr = Math.min(2, devicePixelRatio || 1);
  const px = Math.round((view.tile - 12) * dpr);
  while (pool.length < view.rows) {
    const el = document.createElement("div");
    el.className = "row";
    wall.append(el);
    pool.push({ el, row: -1, tiles: [] });
  }
  for (const r of pool) {
    r.el.style.gridTemplateColumns = `repeat(${view.cols}, ${view.tile}px)`;
    r.el.style.display = pool.indexOf(r) < view.rows ? "grid" : "none";
    while (r.tiles.length < view.cols) {
      const a = document.createElement("a");
      a.className = "tile";
      const canvas = document.createElement("canvas");
      const span = document.createElement("span");
      a.append(canvas, span);
      r.el.append(a);
      r.tiles.push({ a, canvas, span });
    }
    r.tiles.forEach((t, i) => {
      t.a.style.display = i < view.cols ? "flex" : "none";
      t.canvas.width = t.canvas.height = px;
    });
    r.row = -1;   // force a redraw
  }
  view.px = px;
  dirty = true;
}

const clampTop = (t) => Math.max(0, Math.min(t, Math.max(0, view.totalRows - (innerHeight - view.barH) / view.rowH)));

// ---------------------------------------------------------------- drawing

function drawRow(r, row) {
  r.row = row;
  r.tiles.slice(0, view.cols).forEach((t, c) => {
    const n = row * view.cols + c;
    const ctx = t.canvas.getContext("2d");
    if (n >= TOTAL) {
      t.a.style.visibility = "hidden";
      return;
    }
    t.a.style.visibility = "visible";
    const g = library.glyph(n);
    const code = encodeLoop(g.loop);
    drawGlyph(ctx, data.points, g.loop, { size: view.px });
    t.span.textContent = `No. ${fmt(n + 1)}`;
    t.a.href = `${EXPLORER}?loop=${code}`;
    t.a.title = `No. ${fmt(n + 1)} · loop ${code}`;
    t.a.dataset.n = n;
  });
}

let dirty = true;
function render() {
  if (!dirty) return;
  dirty = false;
  const first = Math.floor(view.top);
  const live = new Set();
  for (let i = 0; i < view.rows; i++) live.add(first + i);
  // rows already showing a needed row keep it; the rest are reassigned
  const free = pool.slice(0, view.rows).filter((r) => !live.has(r.row));
  const shown = new Set(pool.slice(0, view.rows).map((r) => r.row));
  for (const row of live) {
    if (row >= view.totalRows || shown.has(row)) continue;
    drawRow(free.pop(), row);
  }
  for (const r of pool.slice(0, view.rows)) {
    const y = view.barH + (r.row - view.top) * view.rowH;
    r.el.style.transform = `translate3d(0, ${y}px, 0)`;
    r.el.style.visibility = r.row >= 0 && r.row < view.totalRows ? "visible" : "hidden";
  }
  // position readout and the thumb
  positionEl.textContent = fmt(Math.min(TOTAL, first * view.cols + 1));
  const span = Math.max(1, view.totalRows - (innerHeight - view.barH) / view.rowH);
  const travel = track.clientHeight - thumb.offsetHeight - 20;
  thumb.style.transform = `translateY(${10 + (view.top / span) * travel}px)`;
  saveHash();
}

// ---------------------------------------------------------------- moving

let velocity = 0;
function scrollBy(rows) {
  const t = clampTop(view.top + rows);
  if (t !== view.top) {
    view.top = t;
    dirty = true;
    hideHint();
  }
}
function jumpTo(n, flash = false) {
  n = Math.max(0, Math.min(TOTAL - 1, Math.floor(n)));
  velocity = 0;
  view.top = clampTop(Math.floor(n / view.cols) - 1);
  dirty = true;
  if (flash) {
    render();
    requestAnimationFrame(() => {
      const el = wall.querySelector(`.tile[data-n="${n}"]`);
      if (!el) return;
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    });
  }
}

function frame() {
  if (Math.abs(velocity) > 0.001) {
    scrollBy(velocity);
    velocity *= 0.94;
  }
  render();
  requestAnimationFrame(frame);
}

wall.addEventListener("wheel", (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
  scrollBy(px / view.rowH);
}, { passive: false });

// touch / pen / mouse drag on the wall, with a little inertia
let drag = null, dragged = false;
wall.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;    // mice scroll with the wheel and click glyphs
  drag = { y: e.clientY, t: performance.now(), v: 0, moved: 0 };
  dragged = false;
  velocity = 0;
});
// a drag that ends on a glyph is not a click on it
wall.addEventListener("click", (e) => {
  if (dragged) e.preventDefault();
  dragged = false;
}, true);
addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dy = drag.y - e.clientY, now = performance.now();
  drag.moved += Math.abs(dy);
  if (drag.moved > 8) dragged = true;
  scrollBy(dy / view.rowH);
  drag.v = (dy / view.rowH) / Math.max(1, now - drag.t) * 16;
  drag.y = e.clientY;
  drag.t = now;
});
addEventListener("pointerup", () => {
  if (drag && !reduceMotion) velocity = drag.v;
  drag = null;
});

// the track is the whole library: drag the thumb or click anywhere along it
let thumbDrag = false;
function trackTo(clientY) {
  const r = track.getBoundingClientRect();
  const f = Math.max(0, Math.min(1, (clientY - r.top - 10 - thumb.offsetHeight / 2) / (r.height - 20 - thumb.offsetHeight)));
  velocity = 0;
  view.top = clampTop(f * (view.totalRows - (innerHeight - view.barH) / view.rowH));
  dirty = true;
  hideHint();
}
track.addEventListener("pointerdown", (e) => {
  thumbDrag = true;
  track.setPointerCapture(e.pointerId);
  trackTo(e.clientY);
});
track.addEventListener("pointermove", (e) => thumbDrag && trackTo(e.clientY));
track.addEventListener("pointerup", () => (thumbDrag = false));

wall.addEventListener("keydown", (e) => {
  const page = (innerHeight - view.barH) / view.rowH - 1;
  const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page, " ": e.shiftKey ? -page : page };
  if (e.key in moves) scrollBy(moves[e.key]);
  else if (e.key === "Home") jumpTo(0);
  else if (e.key === "End") jumpTo(TOTAL - 1);
  else return;
  e.preventDefault();
});

document.getElementById("random").addEventListener("click", () => jumpTo(Math.random() * TOTAL));
document.getElementById("goto").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = Number(document.getElementById("gotoN").value.replace(/[^0-9]/g, ""));
  if (n >= 1 && n <= TOTAL) jumpTo(n - 1, true);
});

const hint = document.querySelector(".hint");
let hintTimer = setTimeout(() => hideHint(), 6000);
function hideHint() {
  if (!hint.classList.contains("gone")) hint.classList.add("gone");
  clearTimeout(hintTimer);
}

// ---------------------------------------------------------------- the address: #12345678 is glyph No. 12,345,678

let hashTimer = 0;
function saveHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    history.replaceState(null, "", `#${Math.floor(view.top) * view.cols + 1}`);
  }, 300);
}

addEventListener("resize", layout);
layout();
// a shared address puts that glyph's row at the top, so the address stays the same
const fromHash = Number(location.hash.slice(1));
if (fromHash >= 1 && fromHash <= TOTAL) view.top = clampTop(Math.floor((fromHash - 1) / view.cols));
wall.focus({ preventScroll: true });
requestAnimationFrame(frame);
