// Bundles each src/client/*.ts island into public/js/*.js (dependency-free, minified ESM).
import { build } from "esbuild";
import { readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src/client");
const outDir = resolve(root, "public/js");
mkdirSync(outDir, { recursive: true });

let entries = [];
try {
  entries = readdirSync(srcDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => resolve(srcDir, f));
} catch {
  /* no client dir yet */
}

if (!entries.length) {
  console.log("no client islands to bundle");
} else {
  await build({
    entryPoints: entries,
    outdir: outDir,
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    sourcemap: false,
  });
  console.log(`client islands bundled: ${entries.length} -> public/js/`);
}
