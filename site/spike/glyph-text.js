// Pure text builders shared by the page and its test: Penrose Substance and Style programs.

// Penrose matches Number variables injectively: repeated values in one statement would
// silently drop it (see src/substance_text.py), so keep every literal distinct.
export function literals(values) {
  const seen = new Set();
  return values
    .map((v) => {
      let s = v.toFixed(6);
      while (seen.has(Number(s))) s = (v += 1e-6).toFixed(6);
      seen.add(Number(s));
      return s;
    })
    .join(", ");
}

/** A closed loop through `points` (array of [x, y, z]) in the order `cycle`. */
export function loopSubstance(points, cycle) {
  const name = (i) => `v${String(i).padStart(2, "0")}`;
  const lines = ["Vertex " + points.map((_, i) => name(i)).join(", "), ""];
  points.forEach((p, i) => lines.push(`At(${name(i)}, ${literals(p)})`));
  lines.push("");
  cycle.forEach((a, i) => lines.push(`Step(${name(a)}, ${name(cycle[(i + 1) % cycle.length])})`));
  return lines.join("\n") + "\n";
}

/** Set brush parameters (base, momentum, pressure) in a style's `-- brush:begin` block. */
export function withBrush(style, params) {
  const [head, block, tail] = style.split(/(?<=-- brush:begin)|(?=  -- brush:end)/);
  if (tail === undefined) throw new Error("style has no brush block");
  let b = block;
  for (const key of ["base", "momentum", "pressure"]) {
    const v = Math.max(0, Number(params[key]));
    if (!Number.isFinite(v)) continue;
    b = b.replace(new RegExp(`^(\\s*${key} = )[0-9.]+`, "m"), `$1${v.toFixed(4)}`);
  }
  return head + b + tail;
}

/** Replace a style's `-- view:begin ... -- view:end` block with an explicit rotation.
 *  `m` is a 4x4 world-to-view matrix in column-major order (three.js Matrix4.elements). */
export function withView(style, m) {
  const num = (v) => (v < 0 ? `0.0 - ${(-v).toFixed(6)}` : v.toFixed(6));
  const r = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const block = ["  -- view:begin (set by the page)"];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) block.push(`  r${i}${j} = ${num(r[i][j])}`);
  block.push("  -- view:end");
  const out = style.replace(/ *-- view:begin[\s\S]*?-- view:end/, block.join("\n"));
  if (out === style) throw new Error("style has no view block");
  return out;
}
