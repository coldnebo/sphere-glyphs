// Compile a Penrose trio, optimize, and write the SVG (or PNG).
// usage: node src/render.mjs <domain> <substance> <style> <out.svg|out.png>
import { renderSVG, writeImage } from "./penrose.mjs";

const [domain, substance, style, out] = process.argv.slice(2);
if (!out) {
  console.error("usage: node src/render.mjs <domain> <substance> <style> <out.svg|out.png>");
  process.exit(2);
}
try {
  await writeImage(await renderSVG({ domain, substance, style }), out);
  console.log("wrote", out);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
