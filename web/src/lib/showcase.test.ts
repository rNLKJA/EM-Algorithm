import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCREENSHOTS,
  WALKTHROUGHS,
  clock,
  screenshotMedia,
  spokenDuration,
  walkthroughMedia,
} from "./showcase";
import { MANIFEST } from "./showcase-manifest";

const publicDir = path.resolve(__dirname, "..", "..", "public");
const docsDir = path.resolve(__dirname, "..", "..", "..", "docs", "showcase");

describe("showcase content", () => {
  it("has unique walkthrough and screenshot ids", () => {
    const w = WALKTHROUGHS.map((x) => x.id);
    const s = SCREENSHOTS.map((x) => x.id);
    expect(new Set(w).size).toBe(w.length);
    expect(new Set(s).size).toBe(s.length);
  });

  it("numbers the screenshots in order, NN-name", () => {
    SCREENSHOTS.forEach((s, i) => {
      expect(s.id).toMatch(/^\d{2}-[a-z0-9-]+$/);
      expect(Number(s.id.slice(0, 2))).toBe(i + 1);
    });
  });

  it("keeps captions short enough for the banner", () => {
    for (const w of WALKTHROUGHS) {
      expect(w.steps.length).toBeGreaterThanOrEqual(5);
      for (const step of w.steps) expect(step.length).toBeLessThanOrEqual(100);
    }
  });

  it("labels every mocked AI screenshot as mocked", () => {
    for (const s of SCREENSHOTS.filter((x) => /ai-(explanation|log)/.test(x.id)))
      expect(s.caption).toMatch(/^Mocked AI response for illustration/);
  });
});

describe("showcase manifest", () => {
  it("only describes known walkthroughs and screenshots", () => {
    const w = new Set<string>(WALKTHROUGHS.map((x) => x.id));
    const s = new Set<string>(SCREENSHOTS.map((x) => x.id));
    for (const id of Object.keys(MANIFEST.walkthroughs)) expect(w.has(id)).toBe(true);
    for (const id of Object.keys(MANIFEST.screenshots)) expect(s.has(id)).toBe(true);
  });

  it("has one cue per step, in order, inside the video", () => {
    for (const w of WALKTHROUGHS) {
      const info = MANIFEST.walkthroughs[w.id];
      if (!info) continue;
      expect(info.cues).toHaveLength(w.steps.length);
      info.cues.forEach((c, i) => {
        expect(c).toBeGreaterThanOrEqual(i === 0 ? 0 : info.cues[i - 1]);
        expect(c).toBeLessThan(info.duration);
      });
    }
  });

  it("points at files that exist", () => {
    for (const w of WALKTHROUGHS) {
      if (!MANIFEST.walkthroughs[w.id]) continue;
      const m = walkthroughMedia(w.id);
      for (const f of [m.mp4, m.poster, m.captions])
        expect(existsSync(path.join(publicDir, f))).toBe(true);
      expect(existsSync(path.join(docsDir, `${w.id}.gif`))).toBe(true);
    }
    for (const id of Object.keys(MANIFEST.screenshots)) {
      const m = screenshotMedia(id);
      expect(existsSync(path.join(publicDir, m.full))).toBe(true);
      expect(existsSync(path.join(publicDir, m.thumb))).toBe(true);
      expect(existsSync(path.join(docsDir, `${id}.png`))).toBe(true);
    }
  });
});

describe("README showcase", () => {
  const readme = readFileSync(path.resolve(__dirname, "..", "..", "..", "README.md"), "utf8");

  it("repeats every walkthrough's on-screen steps, in order", () => {
    for (const w of WALKTHROUGHS) {
      expect(readme).toContain(w.title);
      w.steps.forEach((step, i) => expect(readme).toContain(`${i + 1}. ${step}\n`));
    }
  });

  it("shows every screenshot and links the tour", () => {
    for (const s of SCREENSHOTS) expect(readme).toContain(`docs/showcase/${s.id}.png`);
    for (const w of WALKTHROUGHS) expect(readme).toContain(`/tour#${w.id}`);
  });
});

describe("time formatting", () => {
  it("formats clock times and spoken durations", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(84.6)).toBe("1:24");
    expect(clock(-3)).toBe("0:00");
    expect(spokenDuration(42.9)).toBe("42 s");
    expect(spokenDuration(84.6)).toBe("1 min 24 s");
  });
});
