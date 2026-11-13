// Tiny static server for local previews (no dependencies).
//   /                 -> the repo
//   /node_modules/... -> the image's /workspace/node_modules (or ./node_modules)
// usage: node scripts/serve.mjs [port]      (inside the container; see scripts/serve.sh)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.argv[2] ?? 8000);
const root = resolve(import.meta.dirname, "..");
const modules = [join(root, "node_modules"), resolve(root, "../node_modules")].find(existsSync);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".style": "text/plain; charset=utf-8", ".domain": "text/plain; charset=utf-8",
  ".substance": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const base = path.startsWith("/node_modules/") ? modules : root;
  if (path.startsWith("/node_modules/")) path = path.slice("/node_modules".length);
  let file = join(base, path);
  if (!file.startsWith(base)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`serving on http://localhost:${port}/site/spike/`));
