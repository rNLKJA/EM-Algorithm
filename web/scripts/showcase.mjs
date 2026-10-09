/**
 * pnpm showcase: run the guided tour and rebuild the showcase media.
 *
 *   pnpm showcase                                  # against production
 *   BASE_URL=http://localhost:3410 pnpm showcase   # after `pnpm build` (the server is started for you)
 *   pnpm showcase --test-only                      # Playwright only (screenshots + raw video)
 *   pnpm showcase --media-only                     # post-process the last run only
 *   pnpm showcase -g "diagnostics"                 # other arguments go to `playwright test`
 *
 * 1. Playwright records video by piping frames to ffmpeg. Instead of
 *    downloading Playwright's own ffmpeg build, this puts a small wrapper
 *    around the ffmpeg already on PATH into a project-local
 *    PLAYWRIGHT_BROWSERS_PATH (web/.playwright, git-ignored). No browser is
 *    downloaded either: the tour runs on the system Google Chrome (channel
 *    "chrome").
 * 2. `playwright test` runs e2e/showcase.spec.ts, writing raw screenshots,
 *    recordings (the browser's own frames in .mkv, Playwright's .webm beside
 *    them) and caption timings to web/.showcase/.
 * 3. scripts/showcase-media.mjs turns those into the committed media.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const testOnly = args.includes("--test-only");
const mediaOnly = args.includes("--media-only");
const passThrough = args.filter((a) => a !== "--test-only" && a !== "--media-only");

function which(cmd) {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], {
    encoding: "utf8",
  });
  return res.status === 0 ? res.stdout.split(/\r?\n/)[0].trim() : null;
}

/** Link the system ffmpeg where Playwright looks for its own build. */
function ffmpegShim() {
  const ffmpeg = which("ffmpeg");
  if (!ffmpeg) {
    console.error(
      "ffmpeg is not on PATH; install it (e.g. `brew install ffmpeg`) to record video.",
    );
    process.exit(1);
  }
  const req = createRequire(path.join(web, "package.json"));
  const pwTest = req.resolve("@playwright/test/package.json");
  const pw = createRequire(pwTest).resolve("playwright/package.json");
  const core = path.dirname(createRequire(pw).resolve("playwright-core/package.json"));
  const browsers = JSON.parse(readFileSync(path.join(core, "browsers.json"), "utf8"));
  const { revision } = browsers.browsers.find((b) => b.name === "ffmpeg");
  const exe =
    process.platform === "darwin"
      ? "ffmpeg-mac"
      : process.platform === "win32"
        ? "ffmpeg-win64.exe"
        : "ffmpeg-linux";
  const root = path.join(web, ".playwright");
  const dir = path.join(root, `ffmpeg-${revision}`);
  const target = path.join(dir, exe);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (process.platform === "win32") {
    symlinkSync(ffmpeg, target);
  } else {
    // A wrapper rather than a plain link. Playwright pipes the browser's JPEG frames to ffmpeg and
    // encodes them as real-time VP9, whose noise changes every frame and so defeats the GIF's
    // frame-to-frame diffing. The wrapper keeps Playwright's webm and also stream-copies the JPEG
    // frames, untouched, to a .mkv beside it: the clean source showcase-media.mjs encodes from.
    writeFileSync(
      target,
      [
        "#!/usr/bin/env bash",
        "# Written by scripts/showcase.mjs: Playwright's recorder, plus a lossless copy of the frames.",
        'out="${@: -1}"',
        'if [[ "$out" == *.webm ]]; then',
        `  exec ${JSON.stringify(ffmpeg)} "$@" -an -c:v copy "\${out%.webm}.mkv"`,
        "fi",
        `exec ${JSON.stringify(ffmpeg)} "$@"`,
        "",
      ].join("\n"),
    );
    chmodSync(target, 0o755);
  }
  return root;
}

function run(cmd, cmdArgs, env = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: web,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (!mediaOnly) {
  const browsersPath = ffmpegShim();
  console.log(`Tour against ${process.env.BASE_URL ?? "https://em-algorithm-lab.vercel.app"}`);
  run("pnpm", ["exec", "playwright", "test", ...passThrough], {
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
  });
}
if (!testOnly) run("node", [path.join("scripts", "showcase-media.mjs")]);
