// Count the canonical glyphs in every block of the Library's wall order, in parallel.
// The total must come to 29,940,480, the Burnside count: an independent check of it.
//
//   node site/library/build-index.mjs        (writes site/library/index.bin, Uint16 per block)
import { readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { BLOCKS, scanBlock } from "../lib/library.js";

const OUT = "site/library/index.bin";
const EXPECTED = 29940480;

if (isMainThread) {
  const { symmetries } = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
  const threads = Math.max(1, availableParallelism());
  const counts = new Uint16Array(BLOCKS);
  const t0 = Date.now();
  const CHUNK = 512;
  let done = 0, next = 0;
  console.log(`${BLOCKS} blocks on ${threads} threads`);
  await Promise.all(Array.from({ length: threads }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { symmetries } });
    const give = () => {
      if (next >= BLOCKS) return w.postMessage(null);
      const from = next;
      next = Math.min(BLOCKS, next + CHUNK);
      w.postMessage([from, next]);
    };
    w.on("message", ({ from, counts: c }) => {
      counts.set(c, from);
      const before = done;
      done += c.length;
      if (Math.floor(done / 10000) !== Math.floor(before / 10000)) {
        const s = (Date.now() - t0) / 1000;
        console.log(`  ${done}/${BLOCKS} blocks  ${s.toFixed(0)} s  (~${((s * BLOCKS) / done - s).toFixed(0)} s left)`);
      }
      give();
    });
    w.on("error", reject);
    w.on("exit", resolve);
    give();
  })));
  const total = counts.reduce((a, b) => a + b, 0);
  writeFileSync(OUT, Buffer.from(counts.buffer));
  console.log(`glyphs: ${total.toLocaleString("en")}  (Burnside: ${EXPECTED.toLocaleString("en")})  max per block ${Math.max(...counts)}`);
  console.log(`wrote ${OUT} (${counts.byteLength} bytes) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (total !== EXPECTED) {
    console.error("MISMATCH with the Burnside count");
    process.exit(1);
  }
} else {
  parentPort.on("message", (job) => {
    if (!job) return process.exit(0);
    const [from, to] = job;
    const c = new Uint16Array(to - from);
    for (let b = from; b < to; b++) c[b - from] = scanBlock(b, workerData.symmetries).length;
    parentPort.postMessage({ from, counts: c }, [c.buffer]);
  });
}
