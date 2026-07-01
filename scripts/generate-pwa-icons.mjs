// scripts/generate-pwa-icons.mjs
//
// Generates the PWA icon set from the brand mark (the amber Custodian logo).
// Run with `npm run generate:icons`. Output PNGs land in /public and are
// committed to the repo — this script only needs to be re-run if the brand
// mark changes.
//
// NOTE: the source logo is 160x160, so the 512px outputs are upscaled and
// will look soft. Replace public/high-resolution-color-logo.png with a larger
// master (>=512px) and re-run this script to get crisp icons.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
const SRC = resolve(publicDir, "high-resolution-color-logo.png");
const out = (name) => resolve(publicDir, name);

// Sample the top-left pixel so the maskable padding matches the logo's own
// amber background seamlessly (the source is a full-bleed, opaque square).
async function backgroundColor() {
  const { data } = await sharp(SRC)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: 1 };
}

async function main() {
  const bg = await backgroundColor();
  console.log(`Brand background sampled as rgb(${bg.r}, ${bg.g}, ${bg.b})`);

  // Full-bleed "any" icons: the logo already fills its square edge to edge.
  for (const size of [192, 512]) {
    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(out(`pwa-${size}x${size}.png`));
  }

  // Maskable icon: shrink the mark into the central ~80% safe zone and extend
  // the amber background to the edges, so no launcher mask shape clips the
  // logo or leaves transparent corners.
  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    const logo = await sharp(SRC).resize(inner, inner, { fit: "cover" }).toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: bg },
    })
      .composite([{ input: logo, top: pad, left: pad }])
      .png()
      .toFile(out(`maskable-icon-${size}x${size}.png`));
  }

  // Apple touch icon: full-bleed, opaque (iOS applies its own rounded mask and
  // does not support transparency here).
  await sharp(SRC)
    .resize(180, 180, { fit: "cover" })
    .flatten({ background: bg })
    .png()
    .toFile(out("apple-touch-icon-180x180.png"));

  console.log("Generated PWA icons in /public.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
