import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "public", "icons");

const BG = "#2563eb";
const INK = "#f7f3ec";
// Tabler "trending-up" outline paths (from @tabler/icons/icons/outline/trending-up.svg)
const PATHS = ["M3 17l6 -6l4 4l8 -8", "M14 7l7 0l0 7"];
// Ink bounding box of the icon on the 24 grid including the 2px stroke: x 2..22, y 6..18 → 20×12 units
const INK_W = 20;

const ANY_SIZES = [48, 72, 96, 128, 144, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

function svg(size: number, maskable: boolean): string {
  const scale = (size * (maskable ? 0.4 : 0.47)) / INK_W;
  const box = 24 * scale;
  const off = (size - box) / 2;
  const bg = maskable
    ? `<rect width="${size}" height="${size}" fill="${BG}"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BG}"/>`;
  const paths = PATHS.map(d => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${off} ${off}) scale(${scale})" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

function render(size: number, maskable: boolean): Buffer {
  return new Resvg(svg(size, maskable)).render().asPng();
}

mkdirSync(OUT, { recursive: true });
rmSync(join(OUT, "apple-touch-icon.png"), { force: true });

for (const s of ANY_SIZES) writeFileSync(join(OUT, `icon-${s}.png`), render(s, false));
for (const s of MASKABLE_SIZES) writeFileSync(join(OUT, `icon-maskable-${s}.png`), render(s, true));
writeFileSync(join(OUT, "favicon.svg"), svg(512, false));

console.log(`wrote ${ANY_SIZES.length} any + ${MASKABLE_SIZES.length} maskable PNGs + favicon.svg → ${OUT}`);
