// Fetch the photographs the articles use from Wikimedia Commons, once, and keep them here.
//
//   node site/media/fetch.mjs            (in the container; add --force to fetch everything again)
//
// Articles name images by their Commons file name: ![caption](commons:File name.jpg), or
// scroll: for a long handscroll that the page scrolls sideways. Each image is downloaded at a
// sensible size, compressed to WebP, and recorded in manifest.json with its source page, artist
// and licence. The site serves these copies, so pages don't depend on Commons being up, and
// visitors' browsers never contact it. Only public-domain and CC0 images are accepted.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "site/media";
const MANIFEST = join(DIR, "manifest.json");
const UA = { "User-Agent": "sphere-glyphs-site-build/0.1 (https://github.com/coldnebo/sphere-glyphs)" };
const OK_LICENCES = /^(public domain|cc0|pd)/i;
const EXTRA = ["Calligraphic Galleon MET DP234017.jpg"];   // used outside the articles (the home page)
const PLATE = { width: 2000, height: 2000, quality: 80 };    // fits within 2000 x 2000
const SCROLL = { height: 720, quality: 76 };                 // handscrolls: full length, 720 px high

const force = process.argv.includes("--force");
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

/** Every commons:/scroll: reference in the articles, plus EXTRA. */
function references() {
  const refs = new Map();
  for (const f of readdirSync("site/articles").filter((f) => f.endsWith(".md"))) {
    const md = readFileSync(join("site/articles", f), "utf8");
    for (const para of md.split(/\n{2,}/)) {
      const m = /^!\[[^\]]*\]\((commons|scroll):([^)]+(?:\([^)]*\)[^)]*)*)\)\s*$/.exec(para.trim());
      if (m) refs.set(m[2].trim(), m[1]);
    }
  }
  for (const f of EXTRA) if (!refs.has(f)) refs.set(f, "commons");
  return refs;
}

/** A stable local file name: ASCII, from the Commons name. */
export function slug(name) {
  const base = name.replace(/\.[a-z]+$/i, "").normalize("NFKD").replace(/[^\x20-\x7e]/g, "");
  const s = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;   // keeps non-Latin names distinct
  return `${s || "image"}-${(h >>> 0).toString(36)}`;
}

const strip = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function info(name) {
  const url = "https://commons.wikimedia.org/w/api.php?format=json&action=query&prop=imageinfo" +
    "&iiprop=url|size|mime|extmetadata&titles=" + encodeURIComponent("File:" + name);
  const page = Object.values((await (await fetch(url, { headers: UA })).json()).query.pages)[0];
  if (!page.imageinfo) throw new Error(`not on Commons: ${name}`);
  return page.imageinfo[0];
}

async function fetchOne(name, kind) {
  const ii = await info(name);
  const m = ii.extmetadata ?? {};
  const licence = strip(m.LicenseShortName?.value);
  if (!OK_LICENCES.test(licence)) throw new Error(`${name}: licence "${licence}" is not public domain or CC0`);

  const original = Buffer.from(await (await fetch(ii.url, { headers: UA })).arrayBuffer());
  const img = sharp(original, { limitInputPixels: false });
  let resized, ext = "webp";
  if (kind === "scroll") {
    const h = Math.min(SCROLL.height, ii.height);
    resized = img.resize({ height: h });
    // WebP stops at 16383 px; the longest handscrolls go out as progressive JPEG instead
    if ((ii.width * h) / ii.height > 16383) {
      ext = "jpg";
      resized = resized.jpeg({ quality: SCROLL.quality, progressive: true, mozjpeg: true });
    } else resized = resized.webp({ quality: SCROLL.quality });
  } else {
    resized = img.resize({ width: PLATE.width, height: PLATE.height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: PLATE.quality });
  }
  const { data, info: out } = await resized.toBuffer({ resolveWithObject: true });
  const file = `${slug(name)}.${ext}`;
  writeFileSync(join(DIR, file), data);
  return {
    file, kind, width: out.width, height: out.height, bytes: data.length,
    page: ii.descriptionurl, licence,
    artist: strip(m.Artist?.value) || null,
    credit: strip(m.Credit?.value) || null,
    original: { width: ii.width, height: ii.height, bytes: ii.size },
  };
}

mkdirSync(DIR, { recursive: true });
for (const [name, kind] of references()) {
  const have = manifest[name];
  if (have && have.kind === kind && existsSync(join(DIR, have.file)) && !force) {
    console.log(`have   ${have.file}`);
    continue;
  }
  const entry = await fetchOne(name, kind);
  manifest[name] = entry;
  save();   // after every image, so an error later keeps the work done so far
  console.log(`fetch  ${entry.file}  ${entry.width}x${entry.height}  ${(entry.bytes / 1024).toFixed(0)} KB` +
    `  (original ${(entry.original.bytes / 1e6).toFixed(1)} MB)  ${entry.licence}`);
}
save();
console.log(`manifest: ${Object.keys(manifest).length} images`);

function save() {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + "\n");
}
