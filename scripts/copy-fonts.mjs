/**
 * Copy self-hostable woff2 files from @fontsource/* into public/fonts/ for stable URLs + preload.
 * Run: node scripts/copy-fonts.mjs
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "fonts");
if (!existsSync(out)) mkdirSync(out, { recursive: true });

const copies = [
  ["node_modules/@fontsource/almarai/files/almarai-arabic-400-normal.woff2", "almarai-400.woff2"],
  ["node_modules/@fontsource/almarai/files/almarai-arabic-700-normal.woff2", "almarai-700.woff2"],
  ["node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2", "roboto-400.woff2"],
  ["node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff2", "roboto-500.woff2"],
  ["node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2", "roboto-700.woff2"],
];

for (const [fromRel, toName] of copies) {
  const from = join(root, fromRel);
  const to = join(out, toName);
  if (!existsSync(from)) {
    console.error("Missing:", from);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log("copied", toName);
}
