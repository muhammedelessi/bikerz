/**
 * Regenerate LCP hero AVIF + JPEG fallbacks from WebP sources in public/.
 * Run: node scripts/optimize-hero-lcp.mjs
 */
import sharp from "sharp";
import { existsSync } from "node:fs";

const tasks = [
  // Desktop LCP: smaller AVIF ≈ +PageSpeed; mobile slightly higher quality
  ["public/hero-rider.webp", "public/hero-rider.avif", "avif", { quality: 40, effort: 9 }],
  ["public/hero-rider-mobile.webp", "public/hero-rider-mobile.avif", "avif", { quality: 50, effort: 9 }],
  ["public/hero-rider.webp", "public/hero-rider.jpg", "jpeg", { quality: 85 }],
];

await (async () => {
  for (const [input, output, fmt, opts] of tasks) {
    if (!existsSync(input)) {
      console.warn(`skip (missing): ${input}`);
      continue;
    }
    const img = sharp(input);
    if (fmt === "avif") await img.avif(opts).toFile(output);
    else if (fmt === "jpeg") await img.jpeg(opts).toFile(output);
    console.log("wrote", output);
  }
})();
