// Build the site into _site/: articles as full-screen spreads, with figures rendered at build time.
//
//   node site/build.mjs              (inside the container; scripts/serve.sh to preview)
//
// Article Markdown conventions:
//   # Title + intro paragraphs + ![caption](fig:cover)   -> the cover
//   ## Heading                                            -> one spread; its fig: images are the plate
//   **Look further:** ...                                 -> a breakout panel
//   text[^key]  /  [^key]: citation (under ## Sources)    -> numbered citations and the sources list
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { FIGURES } from "./figures.mjs";

// _site/ is self-contained and uses only relative links, so it works at any path:
// http://localhost:8000/_site/ locally, https://<user>.github.io/sphere-glyphs/ on GitHub Pages.
//   index.html        home
//   loops/            the article
//   explorer/         the interactive explorer (site/spike, packaged)
//   lib/  vendor/     its shared module, three.js and the Penrose browser bundle
const OUT = "_site";
const EXPLORER = "../explorer/";
const ARTICLES = [{ src: "site/articles/permutations.md", slug: "loops" }];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const inline = (md) => marked.parseInline(md);

function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return [{}, text];
  const meta = Object.fromEntries(m[1].split("\n").map((l) => {
    const i = l.indexOf(":");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  return [meta, text.slice(m[0].length)];
}

/** Number citations by first use; return the text with superscripts and the ordered sources. */
function citations(body) {
  const defs = new Map();
  body = body.replace(/^\[\^([\w-]+)\]:\s*(.+)$/gm, (_, key, text) => {
    defs.set(key, text);
    return "";
  });
  const order = [];
  body = body.replace(/\[\^([\w-]+)\]/g, (_, key) => {
    if (!defs.has(key)) throw new Error(`citation [^${key}] has no source`);
    if (!order.includes(key)) order.push(key);
    const n = order.indexOf(key) + 1;
    return `<sup class="cite"><a href="#src-${key}" aria-label="source ${n}">${n}</a></sup>`;
  });
  const cited = order.map((key, i) => ({ key, n: i + 1, text: defs.get(key) }));
  const further = [...defs].filter(([k]) => !order.includes(k)).map(([key, text]) => ({ key, text }));
  return [body, cited, further];
}

/** Split into the cover (before the first ##) and one block per ## section. */
function sections(body) {
  const parts = body.split(/^## /m);
  const cover = parts.shift();
  return [cover, parts.map((p) => {
    const nl = p.indexOf("\n");
    return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1) };
  })];
}

const figureCache = new Map();
async function figure(name, caption, dir) {
  const fn = FIGURES[name];
  if (!fn) throw new Error(`unknown figure fig:${name}`);
  if (!figureCache.has(name)) {
    const t0 = Date.now();
    figureCache.set(name, await fn());
    console.log(`  figure ${name}  ${Math.round(figureCache.get(name).length / 1024)} KB  ${Date.now() - t0} ms`);
  }
  const svg = figureCache.get(name);
  // hand-drawn SVGs go inline (their strokes animate); Penrose renders load as images
  const animated = svg.includes('class="draw"');
  let media;
  if (animated) {
    media = svg.replace(/^<svg\b/, '<svg class="art"');
  } else {
    writeFileSync(join(dir, "figures", `${name}.svg`), svg);
    media = `<img class="art" src="figures/${name}.svg" alt="${esc(caption)}" loading="lazy" decoding="async">`;
  }
  return `<figure class="plate fig-${name}">${media}<figcaption>${inline(caption)}</figcaption></figure>`;
}

/** Pull fig: images out of a block of Markdown, render the rest. */
async function splitBlock(md, dir) {
  const figs = [];
  const rest = [];
  for (const para of md.split(/\n{2,}/)) {
    const m = /^!\[([^\]]*)\]\(fig:([\w-]+)\)\s*$/.exec(para.trim());
    if (m) figs.push(await figure(m[2], m[1], dir));
    else if (para.trim() === "---") continue;
    else if (para.trim().startsWith("**Look further:**")) {
      rest.push(`<aside class="further">${marked.parse(para.trim().replace(/^\*\*Look further:\*\*\s*/, ""))
        .replace(/^<p>/, '<p><span class="further-label">Look further</span> ')}</aside>`);
    } else rest.push(marked.parse(para.replace(/\]\(\.\.\/spike\/\)/g, `](${EXPLORER})`)));
  }
  return [figs, rest.join("\n")];
}

async function buildArticle({ src, slug }) {
  const dir = join(OUT, slug);
  mkdirSync(join(dir, "figures"), { recursive: true });
  console.log(`article ${src} -> ${dir}/`);

  const [meta, raw] = frontMatter(readFileSync(src, "utf8"));
  const [body, cited, further] = citations(raw.replace(/^## Sources\s*$/m, ""));
  const [coverMd, secs] = sections(body);

  const coverTitle = /^# (.+)$/m.exec(coverMd)?.[1] ?? meta.title;
  const [coverFigs, coverText] = await splitBlock(coverMd.replace(/^# .+$/m, ""), dir);

  const spreads = [];
  let n = 0;
  for (const s of secs) {
    if (!s.body.trim()) continue;
    const [figs, text] = await splitBlock(s.body, dir);
    n += 1;
    const id = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    spreads.push({ id, n, title: s.title, figs, text });
  }

  const nav = spreads.map((s) => `<a href="#${s.id}" title="${esc(s.title)}"><span>${s.n}</span></a>`).join("");
  const spreadHTML = spreads.map((s, i) => `
  <section class="spread ${s.figs.length ? "" : "text-only"} ${i % 2 ? "flip" : ""} ${s.figs.length > 1 ? "multi" : ""}" id="${s.id}">
    <div class="plates">${s.figs.join("")}</div>
    <div class="words">
      <p class="number">${String(s.n).padStart(2, "0")}</p>
      <h2>${inline(s.title)}</h2>
      ${s.text}
    </div>
  </section>`).join("\n");

  const sources = `
  <section class="sources" id="sources">
    <h2>Sources</h2>
    <ol>${cited.map((c) => `<li id="src-${c.key}">${inline(c.text)}</li>`).join("")}</ol>
    ${further.length ? `<div class="further-reading">${further.map((c) => `<p id="src-${c.key}">${inline(c.text)}</p>`).join("")}</div>` : ""}
  </section>`;

  const html = readFileSync("site/article/template.html", "utf8")
    .replaceAll("{{title}}", esc(meta.title ?? coverTitle))
    .replaceAll("{{summary}}", esc(meta.summary ?? ""))
    .replace("{{coverTitle}}", inline(coverTitle))
    .replace("{{coverText}}", coverText)
    .replace("{{coverFigure}}", coverFigs.join(""))
    .replace("{{nav}}", nav)
    .replace("{{spreads}}", spreadHTML)
    .replace("{{sources}}", sources)
    .replace("{{explorer}}", EXPLORER);
  writeFileSync(join(dir, "index.html"), html);
  for (const f of ["article.css", "article.js"]) copyFileSync(join("site/article", f), join(dir, f));
}

// ---------------------------------------------------------------- explorer

const pkg = (spec) => fileURLToPath(import.meta.resolve(spec));

function copyTo(dest, src, transform) {
  mkdirSync(dirname(dest), { recursive: true });
  if (transform) writeFileSync(dest, transform(readFileSync(src, "utf8")));
  else copyFileSync(src, dest);
}

function buildExplorer() {
  console.log(`explorer site/spike -> ${OUT}/explorer/`);
  const dir = join(OUT, "explorer");
  copyTo(join(dir, "index.html"), "site/spike/index.html", (html) =>
    html
      .replace("/node_modules/three/build/three.module.js", "../vendor/three.module.js")
      .replace("/node_modules/three/examples/jsm/", "../vendor/three-addons/")
      .replace("/node_modules/@penrose/core/dist/bundle/index.js", "../vendor/penrose-core.js")
      .replace("<title>Loop Viewer Spike</title>", "<title>Loop Explorer</title>")
      .replace("<header>",
        '<header>\n      <p class="back"><a href="../loops/">← Thirty million loops</a> · <a href="../">Sphere glyphs</a></p>'));
  copyTo(join(dir, "main.js"), "site/spike/main.js", (js) => js.replaceAll('"/penrose/', '"./penrose/'));
  for (const f of ["style.css", "data.json", "gallery.json"]) copyTo(join(dir, f), join("site/spike", f));
  copyTo(join(dir, "penrose/tammes-glyph.domain"), "penrose/tammes-glyph.domain");
  copyTo(join(dir, "penrose/styles/glass.style"), "penrose/styles/glass.style");
  copyTo(join(OUT, "lib/glyph-text.js"), "site/lib/glyph-text.js");

  const vendor = join(OUT, "vendor");
  copyTo(join(vendor, "three.module.js"), pkg("three"));
  copyTo(join(vendor, "three-addons/controls/TrackballControls.js"), pkg("three/addons/controls/TrackballControls.js"));
  copyTo(join(vendor, "penrose-core.js"), join(dirname(pkg("@penrose/core")), "bundle/index.js"));
}

function buildHome() {
  console.log(`home -> ${OUT}/index.html`);
  copyTo(join(OUT, "index.html"), "site/home.html");
  writeFileSync(join(OUT, ".nojekyll"), "");   // serve files as-is, no Jekyll processing
}

rmSync(OUT, { recursive: true, force: true });
for (const a of ARTICLES) await buildArticle(a);
buildExplorer();
buildHome();
console.log(`done: ${OUT}/`);
