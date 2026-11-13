// A small raster canvas for computed figures: soft dots (point clouds) and z-buffered,
// shaded triangles (surfaces), on paper. Drawn at 2x and downsampled, then saved as WebP.
import sharp from "sharp";

export const PAPER = [245, 240, 227];
export const INK = [23, 20, 15];
export const SIENNA = [138, 75, 42];
export const WASH = [158, 168, 189];

export class Raster {
  constructor(width, height, { scale = 2, background = PAPER } = {}) {
    this.scale = scale;
    this.w = width * scale;
    this.h = height * scale;
    this.rgb = new Float32Array(this.w * this.h * 3);
    this.z = new Float32Array(this.w * this.h).fill(-Infinity);
    for (let i = 0; i < this.w * this.h; i++) this.rgb.set(background, i * 3);
  }

  /** A soft round dot at (x, y) in output pixels, blended over what is there. */
  dot(x, y, r, color, alpha) {
    const s = this.scale, cx = x * s, cy = y * s, R = r * s;
    const x0 = Math.max(0, Math.floor(cx - R - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + R + 1));
    const y0 = Math.max(0, Math.floor(cy - R - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + R + 1));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
        const a = alpha * Math.max(0, Math.min(1, R + 0.5 - d));
        if (a <= 0) continue;
        const i = (py * this.w + px) * 3;
        for (let c = 0; c < 3; c++) this.rgb[i + c] += (color[c] - this.rgb[i + c]) * a;
      }
    }
  }

  /** A filled triangle with depth test; vertices are [x, y, z] in output pixels, z toward the viewer. */
  triangle(p0, p1, p2, color) {
    const s = this.scale;
    const [ax, ay, az] = [p0[0] * s, p0[1] * s, p0[2]];
    const [bx, by, bz] = [p1[0] * s, p1[1] * s, p1[2]];
    const [cx, cy, cz] = [p2[0] * s, p2[1] * s, p2[2]];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const w0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / area;
        const w1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * az + w1 * bz + w2 * cz;
        const k = py * this.w + px;
        if (z <= this.z[k]) continue;
        this.z[k] = z;
        this.rgb.set(color, k * 3);
      }
    }
  }

  /** Set one output-resolution pixel block directly (used for shaded spheres). */
  fill(x, y, color) {
    const s = this.scale;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      this.rgb.set(color, ((y * s + dy) * this.w + (x * s + dx)) * 3);
    }
  }

  async webp(quality = 82) {
    const bytes = Uint8ClampedArray.from(this.rgb);
    const out = await sharp(Buffer.from(bytes.buffer), { raw: { width: this.w, height: this.h, channels: 3 } })
      .resize(Math.round(this.w / this.scale), Math.round(this.h / this.scale), { kernel: "lanczos3" })
      .webp({ quality })
      .toBuffer();
    return { type: "webp", data: out, width: this.w / this.scale, height: this.h / this.scale };
  }
}

export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
