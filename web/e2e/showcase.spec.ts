/**
 * The guided tour, as an end-to-end test.
 *
 *   pnpm showcase                                   # production, records media
 *   BASE_URL=http://localhost:3410 pnpm showcase    # a local `pnpm build` first
 *   pnpm showcase:test                              # journeys only: no pauses, no video
 *
 * Each journey checks what it shows (the explainer's corrected densities, the notebook's
 * log-likelihood at 15 iterations and at convergence, the lower local maximum a bad start reaches,
 * the bootstrap interval for π₁ and a browser re-run that reproduces it, BIC's choice of K and the
 * bootstrap LRT), so a broken feature fails the tour instead of producing a misleading video.
 * Everything is deterministic: the data are the notebook's exported ratings and every simulation
 * on the site is seeded.
 *
 * No API key is entered anywhere. The AI settings dialog is only opened, with its key box empty.
 * The one AI explanation in the screenshots is a mocked response: a placeholder (not a key) is put
 * in sessionStorage, every request to the providers is intercepted and answered inside the test
 * browser, so nothing leaves it, and the screenshot carries a visible "Mocked AI response for
 * illustration" label.
 */
import path from "node:path";

import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  expect,
  test,
} from "@playwright/test";

import {
  MOCKED_AI,
  MOCK_MODEL_ID,
  SCREENSHOTS,
  WALKTHROUGHS,
  walkthroughMedia,
  type WalkthroughId,
} from "../src/lib/showcase";
import { mockAiProviders } from "./mock-ai";
import {
  FAST,
  SHOT_DIR,
  Tour,
  ensureDirs,
  finishRecording,
  recordingContext,
} from "./showcase-helpers";

const walkthrough = (id: WalkthroughId) => WALKTHROUGHS.find((w) => w.id === id)!;

const nav = (page: Page, label: string) =>
  page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: label });

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const h2 = (page: Page, name: string | RegExp) => page.getByRole("heading", { level: 2, name });
const h3 = (page: Page, name: string | RegExp) => page.getByRole("heading", { level: 3, name });
const slider = (page: Page, name: string) => page.getByRole("slider", { name, exact: true });

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
}

/** Press arrow keys on a focused slider until its value is within `tol` of `target`. */
async function nudge(page: Page, thumb: Locator, target: number, step: number, tol = step / 2) {
  for (let i = 0; i < 200; i++) {
    const now = Number(await thumb.getAttribute("aria-valuenow"));
    if (Math.abs(now - target) <= tol) return;
    await page.keyboard.press(now < target ? "ArrowRight" : "ArrowLeft");
    if (!FAST) await page.waitForTimeout(70);
  }
  throw new Error(`Could not move the slider to ${target}`);
}

/**
 * Viewport screenshot to .showcase/screens/<id>.png, optionally with `align` scrolled to `offset`
 * px from the top (applied twice, after layout settles).
 */
async function shot(page: Page, id: string, align?: { target: Locator; offset: number }) {
  if (!SCREENSHOTS.some((s) => s.id === id)) throw new Error(`Unknown screenshot ${id}`);
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  for (let i = 0; i < 2; i++) {
    if (align) {
      await align.target.evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "instant" });
      }, align.offset);
    }
    await page.waitForTimeout(450);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`) });
}

/** A fixed label burned into the screenshots that show a mocked AI response. */
async function mockedLabel(page: Page) {
  await page.evaluate((text) => {
    const el = document.createElement("div");
    el.id = "__showcase-mocked";
    el.setAttribute("aria-hidden", "true");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:20px;bottom:20px;z-index:2147483647;padding:8px 14px;border-radius:999px;" +
      "background:#ad3f25;color:#fff;font:600 15px/1.3 ui-sans-serif,system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none";
    document.body.appendChild(el);
  }, `${MOCKED_AI} · no API key, no provider call`);
}

test.beforeAll(() => ensureDirs());

test.describe("journeys (recorded)", () => {
  test("1. step through EM: four ratings, two iterations, the explainer's numbers", async ({
    browser,
  }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("step-through-em"));

    await page.goto("/");
    await expect(h1(page)).toContainText("one step");
    await settle(page);
    tour.markStart();

    // 1. the landing page, into the stepper
    await tour.caption(1);
    await tour.pause(1400);
    await tour.hover(page.getByRole("img", { name: /^Histogram of the notebook's 200 ratings/ }));
    await tour.pause(1200);
    await tour.click(page.getByRole("link", { name: "Step through four ratings" }));
    await expect(page).toHaveURL(/\/stepper$/);
    await expect(h1(page)).toHaveText("Four ratings, two groups, one step at a time");
    await settle(page);
    await tour.pause(900);

    // 2. the starting guess
    await tour.caption(2);
    const stagePanel = page.getByRole("region", { name: "Current stage", exact: true });
    await tour.scrollTo(page.getByRole("region", { name: "Starting guess", exact: true }), {
      offset: 68,
      ms: 1100,
    });
    await expect(stagePanel.getByRole("heading", { level: 2 })).toHaveText(
      "Initial guess (iteration 0)",
    );
    await expect(stagePanel.getByRole("table")).toContainText("2.5000");
    await expect(stagePanel.getByRole("table")).toContainText("7.5000");
    await tour.hover(stagePanel.getByRole("table"), 800);
    await tour.pause(1600);
    const chart = page.getByRole("img", { name: /^Four ratings 2, 3, 7 and 8/ });
    await tour.hover(chart, 800);
    await tour.pause(1000);

    // 3. E-step 1
    await tour.caption(3);
    const next = page.getByRole("button", { name: "Next step" });
    await tour.click(next);
    await expect(stagePanel.getByRole("heading", { level: 2 })).toHaveText(
      "Iteration 1 · E-step: which group does each rating probably belong to?",
    );
    const resp = page.getByRole("list", { name: "Responsibilities for each rating" });
    await expect(resp.getByRole("listitem")).toHaveCount(4);
    await expect(resp.getByRole("listitem").first()).toContainText("explainer: 0.9999 / 0.0001");
    await tour.hover(resp.getByRole("listitem").first(), 800);
    await tour.pause(1400);
    await tour.hover(resp.getByRole("listitem").nth(2), 700);
    await tour.pause(1200);

    // 4. the explainer's densities are off
    await tour.caption(4);
    await tour.hover(
      resp.getByRole("listitem").first().getByText("off", { exact: true }).first(),
      700,
    );
    await tour.pause(1200);
    const note = stagePanel.getByText(/^The explainer plugs in densities of 0\.8 and 0\.6/);
    await expect(note).toContainText("0.4839");
    await tour.hover(note, 800);
    await tour.pause(2200);

    // 5. M-step 1
    await tour.caption(5);
    await tour.scrollTo(page.getByRole("region", { name: "Starting guess", exact: true }), {
      offset: 68,
      ms: 900,
    });
    await tour.click(next);
    await expect(stagePanel.getByRole("heading", { level: 2 })).toHaveText(
      "Iteration 1 · M-step: update what each group looks like",
    );
    const mu1 = stagePanel.getByRole("listitem").filter({ hasText: /^μ₁/ });
    await expect(mu1).toContainText("2.5000 (was 2.5000)");
    await expect(mu1).toContainText("explainer:");
    await tour.hover(stagePanel.getByRole("listitem").first(), 700);
    await tour.pause(900);
    await tour.hover(mu1, 700);
    await tour.pause(1200);
    await tour.hover(stagePanel.getByRole("listitem").filter({ hasText: /^σ₂/ }), 700);
    await tour.pause(1400);

    // 6. iteration 2: the same numbers again
    await tour.caption(6);
    await tour.scrollTo(page.getByRole("region", { name: "Starting guess", exact: true }), {
      offset: 68,
      ms: 900,
    });
    await tour.click(next);
    await expect(stagePanel.getByRole("heading", { level: 2 })).toHaveText(
      "Iteration 2 · E-step: which group does each rating probably belong to?",
    );
    const repeat = stagePanel.getByText(/^The explainer notes that iteration 2 repeats/);
    await expect(repeat).toBeVisible();
    await tour.hover(repeat, 800);
    await tour.pause(1600);
    await tour.scrollTo(page.getByRole("region", { name: "Starting guess", exact: true }), {
      offset: 68,
      ms: 700,
    });
    await tour.click(next);
    await expect(stagePanel.getByRole("heading", { level: 2 })).toHaveText(
      "Iteration 2 · M-step: update what each group looks like",
    );
    await expect(next).toBeDisabled();
    await tour.pause(900);

    // 7. the log-likelihood is unchanged; every correction in one table
    await tour.caption(7);
    const ll = page.getByRole("region", { name: "Log-likelihood", exact: true });
    await expect(ll).toContainText("5.6758");
    await expect(stagePanel).toContainText("(change +0.000000)");
    await tour.hover(ll, 800);
    await tour.pause(1600);
    const corrections = h2(page, "What the hand-worked numbers got wrong (and right)");
    await tour.scrollTo(corrections, { offset: 90, ms: 1300 });
    const table = page.getByRole("table", { name: "Corrections to the worked example" });
    await expect(
      table.getByRole("row").filter({ hasText: "normal_pdf(2; 2.5, 0.5)" }),
    ).toContainText("0.4839");
    await expect(
      table.getByRole("row").filter({ hasText: "normal_pdf(2; 7.5, 0.5)" }),
    ).toContainText("4.24 × 10⁻²⁷");
    for (const row of [1, 2, 3, 4]) {
      await tour.hover(table.getByRole("row").nth(row), 600);
      await tour.pause(700);
    }
    await tour.pause(1600);

    await finishRecording(context, page, tour);
  });

  test("2. fit the mixture: the notebook's run, convergence, and a local maximum", async ({
    browser,
  }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("fit-the-mixture"));

    await page.goto("/playground");
    await expect(h1(page)).toHaveText("Two hidden groups in 200 ratings");
    await settle(page);
    tour.markStart();

    const mixture = page.getByRole("region", { name: "Mixture", exact: true });
    const settings = page.getByRole("complementary", { name: "Settings" });
    const status = mixture.locator("p", { has: page.getByText(/^t = \d+$/) });
    const llPanel = page.getByRole("region", { name: "Log-likelihood", exact: true });
    const llFooter = llPanel.getByText(/^start /);

    // 1. the notebook's data and start
    await tour.caption(1);
    await tour.pause(1200);
    await tour.scrollTo(mixture, { offset: 64, ms: 1200 });
    await expect(settings.getByRole("radio", { name: "Notebook's 200" })).toHaveAttribute(
      "data-state",
      "on",
    );
    await tour.hover(settings.getByRole("radio", { name: "Notebook's 200" }), 800);
    await tour.pause(1100);
    await tour.hover(settings.getByText(/^The notebook's own random start/), 700);
    await tour.pause(1300);
    await expect(slider(page, "max iterations")).toHaveAttribute("aria-valuenow", "15");

    // 2. run EM from the start
    await tour.caption(2);
    await tour.click(page.getByRole("button", { name: "Back to the start" }));
    await expect(status).toContainText("t = 0");
    await tour.pause(600);
    await tour.click(page.getByRole("button", { name: "Play", exact: true }));
    // an image until the means become draggable, then a group of two sliders
    const chart = page.locator('svg[aria-label^="Histogram of 200 ratings"]');
    await tour.hover(chart, 900);
    await tour.pause(2600);
    await tour.scrollTo(llPanel, { offset: 300, ms: 1200 });
    const llBox = (await llPanel.boundingBox())!;
    await tour.glide(llBox.x + llBox.width * 0.3, llBox.y + llBox.height * 0.55, 900);
    await tour.glide(llBox.x + llBox.width * 0.8, llBox.y + llBox.height * 0.45, 2400);

    // 3. stopped at the cap, not converged
    await expect(status).toContainText(
      "Stopped at the cap of 15 iterations, still improving by 0.0293 per step (not converged).",
      { timeout: 30_000 },
    );
    await tour.caption(3);
    await expect(llFooter).toContainText("after iteration 1 = -425.50");
    await expect(llFooter).toContainText("last = -416.51");
    await tour.hover(llFooter, 800);
    await tour.pause(1500);
    await tour.scrollTo(mixture, { offset: 64, ms: 1100 });
    await tour.hover(status, 800);
    await tour.pause(1800);

    // 4. raise the cap and finish the run
    await tour.caption(4);
    const cap = slider(page, "max iterations");
    await tour.click(cap);
    await page.keyboard.press("End");
    await expect(cap).toHaveAttribute("aria-valuenow", "500");
    await tour.pause(700);
    await tour.click(mixture.getByRole("radio", { name: "16×" }));
    await tour.click(page.getByRole("button", { name: "Play", exact: true }));
    await expect(status).toContainText("Converged after 90 iterations", { timeout: 30_000 });
    await tour.hover(status, 700);
    await tour.pause(900);
    await tour.scrollTo(llPanel, { offset: 300, ms: 1000 });
    await expect(llFooter).toContainText("last = -415.37");
    await tour.hover(llFooter, 700);
    await tour.pause(1800);

    // 5. a bad start: drag μ₁ into the middle, narrow σ₁
    await tour.caption(5);
    await tour.scrollTo(mixture, { offset: 64, ms: 1000 });
    await tour.click(settings.getByRole("radio", { name: "Drag" }));
    await expect(
      settings.getByText("Your guess: the means you dragged, π = 0.5 each."),
    ).toBeVisible();
    const h1Handle = page.getByRole("slider", { name: "Mean of component 1" });
    const h2Handle = page.getByRole("slider", { name: "Mean of component 2" });
    await expect(h1Handle).toHaveAttribute("aria-valuenow", "3");
    await expect(h2Handle).toHaveAttribute("aria-valuenow", "8.5");
    const b1 = (await h1Handle.boundingBox())!;
    const b2 = (await h2Handle.boundingBox())!;
    const perUnit = (b2.x - b1.x) / (8.5 - 3);
    await tour.drag(h1Handle, [b1.x + b1.width / 2 + (6.3 - 3) * perUnit], {
      ms: 1800,
      hold: 400,
    });
    // the drag sets μ₁ from the pointer; if it missed, settle it with the μ₁ slider's arrow keys
    const mu1 = slider(page, "μ₁");
    if (Math.abs(Number(await mu1.getAttribute("aria-valuenow")) - 6.3) > 0.15) {
      await mu1.focus();
      await nudge(page, mu1, 6.3, 0.05, 0.1);
    }
    await tour.pause(800);
    const sigma1 = slider(page, "σ₁");
    await tour.click(sigma1);
    await nudge(page, sigma1, 0.2, 0.05, 0.001);
    await expect(sigma1).toHaveAttribute("aria-valuenow", "0.2");
    await tour.pause(1000);

    // 6. EM converges to a local maximum
    await tour.caption(6);
    await tour.click(page.getByRole("button", { name: "Play", exact: true }));
    await expect(status).toContainText(/Converged after \d+ iterations/, { timeout: 30_000 });
    await tour.hover(chart, 800);
    await tour.pause(1400);
    await tour.scrollTo(llPanel, { offset: 300, ms: 1000 });
    await expect(llFooter).toContainText("last = -423.63");
    await tour.hover(llFooter, 700);
    await tour.pause(1200);
    const params = page.getByRole("region", { name: "Parameters", exact: true });
    await tour.scrollTo(params, { offset: 120, ms: 1100 });
    await expect(params).toContainText("6.476");
    await expect(params).toContainText("0.035");
    await tour.hover(params.getByRole("row").nth(1), 800);
    await tour.pause(2000);

    // 7. the guarantee holds, the answer is still worse
    await tour.caption(7);
    await tour.scrollTo(llPanel, { offset: 200, ms: 1000 });
    const badge = llPanel.getByText("never decreased ✓");
    await expect(badge).toBeVisible();
    await tour.hover(badge, 800);
    await tour.pause(1600);
    await tour.hover(llFooter, 700);
    await tour.pause(2400);

    await finishRecording(context, page, tour);
  });

  test("3. how sure are we: bootstrap intervals, a browser re-run, and BIC choosing K", async ({
    browser,
  }) => {
    test.setTimeout(10 * 60_000);
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("how-sure"));

    await page.goto("/inference");
    await expect(h1(page)).toHaveText("How sure? How many? How stable?");
    await settle(page);
    tour.markStart();

    // 1. the questions
    await tour.caption(1);
    await tour.pause(1400);
    const questions = page.getByRole("navigation", { name: "Questions on this page" });
    await tour.scrollTo(questions, { offset: 200, ms: 1000 });
    for (const i of [0, 1, 2, 3]) {
      await tour.hover(questions.getByRole("listitem").nth(i), 600);
      await tour.pause(500);
    }
    await tour.pause(600);

    // 2. finish the run, standard errors from the Hessian
    await tour.caption(2);
    const uncertainty = page.locator("#uncertainty");
    await tour.scrollTo(uncertainty, { offset: 72, ms: 1300 });
    await expect(uncertainty).toContainText("170 iterations");
    await tour.hover(uncertainty.getByText(/170 iterations/).first(), 700);
    await tour.pause(1600);
    const table = page.getByRole("table", { name: /^Fitted parameters with observed-information/ });
    await tour.scrollTo(table, { offset: 120, ms: 1200 });
    await tour.hover(table.getByRole("columnheader", { name: "SE (Hessian)" }), 700);
    await tour.pause(900);
    await tour.hover(table.getByRole("columnheader", { name: "95% Wald" }), 600);
    await tour.pause(1100);

    // 3. the bootstrap interval for π₁
    await tour.caption(3);
    const pi1 = table.getByRole("row").filter({ hasText: "share of the low group" });
    await expect(pi1).toContainText("0.221");
    await expect(pi1).toContainText("0.110 to 0.359");
    await tour.hover(table.getByRole("columnheader", { name: "95% bootstrap" }), 700);
    await tour.pause(800);
    await tour.hover(pi1, 700);
    await tour.pause(1800);

    // 4. re-run the bootstrap in the browser, with the published seed
    await tour.caption(4);
    const run = uncertainty.getByRole("button", { name: "Run in your browser" });
    await tour.scrollTo(run, { offset: 560, ms: 1300 });
    await expect(uncertainty.getByText("Published result:")).toContainText("seed 42");
    await tour.click(run);
    const reproduced = uncertainty.getByText(
      "Same seed, same numbers: your browser reproduced the published result.",
    );
    const hist = page.getByRole("list").filter({ has: page.getByText("share of the low group") });
    // the worker runs 1,000 refits; walk over the histograms while it works
    await tour.idleWhile(async () => {
      for (const i of [0, 1, 2, 3, 4]) {
        await tour.tryHover(hist.last().getByRole("listitem").nth(i), 700);
        await tour.pause(900);
      }
      await expect(reproduced).toBeVisible({ timeout: 300_000 });
    });

    // 5. same seed, same numbers
    await tour.caption(5);
    await tour.hover(reproduced, 800);
    await tour.pause(1200);
    await expect(uncertainty.getByText("Your run in this browser:")).toContainText("seed 42");
    await tour.hover(uncertainty.getByText("Your run in this browser:"), 700);
    await tour.pause(1800);

    // 6. how many groups: AIC and BIC
    await tour.caption(6);
    const choosing = page.locator("#choosing-k");
    await tour.scrollTo(choosing, { offset: 72, ms: 1500 });
    await expect(choosing).toContainText("BIC prefers 3 components and AIC 4");
    await tour.hover(choosing.getByText("BIC prefers 3 components and AIC 4"), 800);
    await tour.pause(1600);
    const ktable = page.getByRole("table", {
      name: /^Log-likelihood, AIC and BIC for one to four/,
    });
    await tour.scrollTo(ktable, { offset: 150, ms: 1300 });
    const k3 = ktable.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "3" }) });
    const k4 = ktable.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "4" }) });
    await expect(k3).toContainText("403.23");
    await tour.hover(k3, 700);
    await tour.pause(1200);
    await tour.hover(k4, 600);
    await tour.pause(1000);

    // 7. without the clipped ratings, and on fresh samples
    await tour.caption(7);
    await tour.hover(ktable.getByRole("columnheader", { name: "ΔBIC without the 7 at 10.0" }), 800);
    await tour.pause(1200);
    const selection = page.getByRole("table", { name: /^Share of 100 simulated data sets/ });
    await tour.scrollTo(selection, { offset: 200, ms: 1300 });
    const picked2 = selection.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "2" }),
    });
    await expect(picked2.getByRole("cell").nth(1)).toContainText("91");
    await tour.hover(picked2.getByRole("cell").nth(1), 700);
    await tour.pause(2000);

    // 8. the bootstrap likelihood-ratio test
    await tour.caption(8);
    const lrt = h3(page, "One group or two? A bootstrap likelihood-ratio test");
    await tour.scrollTo(lrt, { offset: 90, ms: 1400 });
    const pCard = page.getByText("bootstrap p-value", { exact: true }).locator("..");
    await expect(pCard).toContainText("0.002");
    const falseAlarm = page
      .getByText("χ²₃ test's real false-alarm rate", { exact: true })
      .locator("..");
    await expect(falseAlarm).toContainText("16%");
    const plot = page.getByRole("img", { name: /^Bootstrap null distribution/ });
    await tour.tryHover(plot, 900);
    await tour.pause(1400);
    await tour.scrollTo(pCard, { offset: 420, ms: 1000 });
    await tour.hover(pCard, 700);
    await tour.pause(1400);
    await tour.hover(falseAlarm, 700);
    await tour.pause(2600);

    await finishRecording(context, page, tour);
  });
});

async function desktop(browser: Browser, colorScheme: "light" | "dark" = "light") {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  });
}

async function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
}

test.describe("screenshots", () => {
  test("landing, light and dark", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const context = await desktop(browser, scheme);
      const page = await context.newPage();
      await page.goto("/");
      await expect(h1(page)).toContainText("one step");
      await settle(page);
      await shot(page, `0${scheme === "light" ? 1 : 2}-landing-${scheme}`);
      await context.close();
    }
  });

  test("key features at 1440 × 900", async ({ browser }) => {
    const context = await desktop(browser);
    const page = await context.newPage();

    // stepper: the E-step and the M-step of iteration 1
    await page.goto("/stepper");
    await settle(page);
    const stagePanel = page.getByRole("region", { name: "Current stage", exact: true });
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(stagePanel).toContainText("Iteration 1 · E-step");
    await shot(page, "03-stepper-e-step", {
      target: page.getByRole("region", { name: "Starting guess", exact: true }),
      offset: 72,
    });
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(stagePanel).toContainText("Iteration 1 · M-step");
    await shot(page, "04-stepper-m-step", {
      target: page.getByRole("region", { name: "Starting guess", exact: true }),
      offset: 72,
    });

    // playground: the notebook's run, then a bad start
    await page.goto("/playground");
    await settle(page);
    const mixture = page.getByRole("region", { name: "Mixture", exact: true });
    await expect(mixture).toContainText("Stopped at the cap of 15 iterations");
    await shot(page, "05-playground", { target: mixture, offset: 72 });
    const settings = page.getByRole("complementary", { name: "Settings" });
    await slider(page, "max iterations").focus();
    await page.keyboard.press("End");
    await settings.getByRole("radio", { name: "Drag" }).click();
    const mu1 = slider(page, "μ₁");
    await mu1.focus();
    await nudge(page, mu1, 6.3, 0.05, 0.001);
    const sigma1 = slider(page, "σ₁");
    await sigma1.focus();
    await nudge(page, sigma1, 0.2, 0.05, 0.001);
    await page.getByRole("button", { name: "Jump to the end" }).click();
    await expect(mixture).toContainText(/Converged after \d+ iterations/);
    await expect(page.getByRole("region", { name: "Log-likelihood", exact: true })).toContainText(
      "last = -423.63",
    );
    await shot(page, "06-playground-local-maximum", { target: mixture, offset: 72 });

    // pitfalls
    await page.goto("/pitfalls");
    await settle(page);
    await shot(page, "07-pitfalls-label-switching", {
      target: page.locator("#label-switching"),
      offset: 64,
    });
    const gallery = page.getByRole("list", { name: "Restarts, best log-likelihood first" });
    await expect(gallery.getByRole("listitem")).toHaveCount(24, { timeout: 60_000 });
    await expect(page.getByText(/^(\d+ different answers|Every start reached)/)).toBeVisible({
      timeout: 60_000,
    });
    await shot(page, "08-pitfalls-local-maxima", {
      target: page.getByRole("radiogroup", { name: "Data for the restarts" }),
      offset: 150,
    });

    // inference
    await page.goto("/inference");
    await settle(page);
    await shot(page, "09-inference-uncertainty", {
      target: page.getByRole("table", { name: /^Fitted parameters with observed-information/ }),
      offset: 96,
    });
    await shot(page, "10-inference-coverage", { target: page.locator("#coverage"), offset: 64 });
    await shot(page, "11-inference-choosing-k", {
      target: page.getByRole("table", { name: /^Log-likelihood, AIC and BIC for one to four/ }),
      offset: 120,
    });
    await shot(page, "12-inference-lrt", {
      target: h3(page, "One group or two? A bootstrap likelihood-ratio test"),
      offset: 80,
    });

    // maths, methods, a decision record and the model card
    await page.goto("/maths");
    await settle(page);
    await shot(page, "13-maths");
    await page.goto("/methods");
    await settle(page);
    await shot(page, "14-methods");
    await shot(page, "15-decision-record", { target: page.locator("#dr-002"), offset: 72 });
    await shot(page, "16-model-card", { target: page.locator("#model-card"), offset: 64 });

    // the BYOK dialog, opened with no key: nothing is typed into it
    await page.goto("/stepper");
    await settle(page);
    await page.getByRole("button", { name: /^AI settings/ }).click();
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Anthropic" })).toHaveAttribute(
      "data-state",
      "on",
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, "17-ai-settings.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await context.close();
  });

  test("AI explanation and audit log (mocked AI response for illustration)", async ({
    browser,
  }) => {
    const context = await desktop(browser);
    const mock = await mockAiProviders(context);
    const page = await context.newPage();

    // the playground opens on the notebook's last iteration (t = 15)
    await page.goto("/playground");
    await settle(page);
    await expect(page.getByRole("region", { name: "Mixture", exact: true })).toContainText(
      "Stopped at the cap of 15 iterations",
    );
    const panel = page.getByRole("region", { name: "Explain this iteration" });
    await panel.getByRole("button", { name: "Explain", exact: true }).click();
    const answer = panel.getByRole("article", { name: "AI-generated explanation" });
    await expect(answer.getByText("AI-generated", { exact: true })).toBeVisible();
    await expect(answer).toContainText(MOCK_MODEL_ID);
    await expect(answer).toContainText("Mocked response for illustration");
    await expect(answer).toContainText("every number it checks matches the numbers that were sent");
    expect(mock.calls).toBe(1);
    await mockedLabel(page);
    await shot(page, "18-ai-explanation", { target: panel, offset: 120 });

    await answer.getByRole("button", { name: "Accept" }).click();
    await expect(answer).toContainText("accepted by you");
    // The decision is written to IndexedDB just after the panel updates. Leaving the page before
    // the write lands would abort it, so wait for it in the database itself.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string[]>((resolve) => {
              const req = indexedDB.open("emlab-ai-audit");
              req.onerror = () => resolve([]);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const all = db.transaction("calls").objectStore("calls").getAll();
                  all.onsuccess = () => {
                    resolve((all.result as { decision?: string }[]).map((e) => e.decision ?? ""));
                    db.close();
                  };
                  all.onerror = () => resolve([]);
                } catch {
                  db.close();
                  resolve([]);
                }
              };
            }),
        ),
      )
      .toContain("accepted");
    await page.goto("/ai-log");
    await settle(page);
    // entries are read from IndexedDB after the page renders
    await expect(page.getByText(MOCK_MODEL_ID).first()).toBeVisible();
    await expect(page.getByText("accepted", { exact: true }).first()).toBeVisible();
    await page.getByText("Input, output and decision").first().click();
    await mockedLabel(page);
    await shot(page, "19-ai-log", {
      target: page.getByText(/AI calls? recorded in this browser/),
      offset: 150,
    });
    expect(mock.leaks).toEqual([]);
    await context.close();
  });

  test("mobile at 390 × 844", async ({ browser }) => {
    const context = await mobile(browser);
    const page = await context.newPage();

    await page.goto("/");
    await settle(page);
    await shot(page, "20-mobile-landing");

    await page.goto("/stepper");
    await settle(page);
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.getByRole("region", { name: "Current stage", exact: true })).toContainText(
      "Iteration 1 · E-step",
    );
    await shot(page, "21-mobile-stepper", {
      target: page.getByRole("region", { name: "Current stage", exact: true }),
      offset: 64,
    });

    await page.goto("/inference");
    await settle(page);
    await shot(page, "22-mobile-inference", {
      target: page
        .getByRole("list")
        .filter({ has: page.getByText("share of the low group") })
        .last(),
      offset: 120,
    });
    await context.close();
  });
});

test.describe("tour page", () => {
  test("is linked from the nav and the landing page, and serves its videos", async ({
    browser,
  }) => {
    const context = await desktop(browser);
    const page = await context.newPage();

    await page.goto("/");
    await page.getByRole("link", { name: /Watch the guided tour/ }).click();
    await expect(page).toHaveURL(/\/tour$/);
    await expect(h1(page)).toHaveText("EM in three walkthroughs");
    await expect(nav(page, "Tour")).toHaveAttribute("aria-current", "page");

    for (const w of WALKTHROUGHS) {
      const section = page.locator(`#${w.id}`);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(w.title);
      const video = section.locator("video");
      if ((await video.count()) === 0) continue; // no media recorded yet
      const steps = section.getByRole("button", { name: /^Step \d+ of \d+, play from/ });
      await expect(steps).toHaveCount(w.steps.length);
      const media = walkthroughMedia(w.id);
      await expect(video).toHaveAttribute("poster", media.poster);
      // the video is attached when it nears the viewport; pressing a step plays from there
      await steps.nth(1).click();
      await expect(video).toHaveAttribute("src", media.mp4);
      await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(1);
      const duration = await video.evaluate((v: HTMLVideoElement) => v.duration);
      expect(duration).toBeGreaterThan(20);
      await video.evaluate((v: HTMLVideoElement) => v.pause());
      const res = await page.request.get(media.mp4);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("video/mp4");
    }

    const thumbs = page.getByRole("button", { name: /^Enlarge screenshot:/ });
    // counted before the lightbox opens: the modal hides the grid from the accessibility tree
    const shots = await thumbs.count();
    if (shots > 0) {
      expect(shots).toBe(SCREENSHOTS.length);
      await thumbs.first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(dialog.getByText(`2 / ${shots}`)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await context.close();
  });
});
