/**
 * Regenerate src/lib/inference/__generated__/inference.json, the precomputed
 * numbers behind /inference. Takes a few minutes; every seed and size is in
 * src/lib/inference/settings.ts.
 *
 *   pnpm inference
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInferenceArtefact } from "../src/lib/inference/artefact";

const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/inference/__generated__/inference.json",
);

const t0 = performance.now();
const artefact = buildInferenceArtefact((message) => console.log(message));
// 10 significant digits: plenty for display, and stable across platforms
const json = JSON.stringify(
  artefact,
  (_key, value) =>
    typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value)
      ? Number(value.toPrecision(10))
      : value,
  1,
);
writeFileSync(out, `${json}\n`);
console.log(
  `wrote ${path.relative(process.cwd(), out)} (${(json.length / 1024).toFixed(0)} KB) in ${((performance.now() - t0) / 1000).toFixed(0)} s`,
);
