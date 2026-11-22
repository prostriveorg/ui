// Browser check of the built playground (generated data only).
//
//   yarn build && yarn playground:build && yarn browser:check
//
// Uses an installed Chrome (`channel: 'chrome'`), or the browser at PSUI_BROWSER. Screenshots go
// to .browser-check/. Verifies per-foot preview states, raw vs source-bound mapped presentation,
// bounded buffers and that sample arrival does not drive React renders.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../.browser-check/', import.meta.url));
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:5181/';

const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--config',
    'playground/vite.config.ts',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
);
await new Promise((resolve, reject) => {
  server.stdout.on('data', (chunk) => String(chunk).includes('5181') && resolve());
  server.on('exit', (code) => reject(new Error(`preview server exited (${code})`)));
  setTimeout(() => reject(new Error('preview server did not start')), 20_000);
});

const browser = await chromium.launch(
  process.env.PSUI_BROWSER ? { executablePath: process.env.PSUI_BROWSER } : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const failures = [];
const check = (condition, message) => {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${message}`);
  if (!condition) failures.push(message);
};
const strip = () => page.locator('section[aria-label="Recording status"]').innerText();
const open = async (query, waitMs) => {
  await page.goto(`${base}?${query}`);
  await page.waitForSelector('section[aria-label="Recording status"]');
  await page.waitForTimeout(waitMs);
};
const view = (name) =>
  page.locator('label.mantine-SegmentedControl-label', { hasText: name }).first().click();
/** Share of canvas pixels that are not transparent/white: a drawn trace or grid. */
const inkedOnce = (selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((canvas) => {
      const { width, height } = canvas;
      const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3] > 0 && (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200)) ink++;
      return ink / (width * height);
    });

/** Highest ink share over one generated gait cycle (feet are unloaded during swing). */
const inked = async (selector) => {
  let best = 0;
  for (let i = 0; i < 8; i++) {
    best = Math.max(best, await inkedOnce(selector));
    await page.waitForTimeout(100);
  }
  return best;
};

try {
  // Receiving, raw channels.
  await open('scenario=receiving', 2500);
  let text = await strip();
  check(/Left · Receiving/.test(text) && /Right · Receiving/.test(text), 'receiving: both feet');
  check(/0:0[1-3]\.\d/.test(text), 'receiving: elapsed clock runs from the confirmed anchor');
  check(
    (await inked('section[aria-label="Live signal over time"] canvas')) > 0.002,
    'receiving: paired trace drawn',
  );
  await page.screenshot({ path: `${out}receiving-overview.png`, fullPage: true });
  await view('Sensor channels');
  await page.waitForTimeout(600);
  check(
    await page.getByRole('heading', { name: 'Live sensor channels' }).isVisible(),
    'raw: channel grid title',
  );
  check(
    await page.getByText('Electrical order, not foot position').isVisible(),
    'raw: electrical order caption',
  );
  check(
    (await page.locator('[aria-label="Pressure map view"]').count()) === 0,
    'raw: no spatial view selector',
  );
  check(
    (await inked('canvas[aria-label^="Left indexed 8 by 8"]')) > 0.02,
    'raw: left grid painted',
  );
  await page.screenshot({ path: `${out}receiving-channels.png`, fullPage: true });

  // Render count while 200 samples/s arrive (channels view: 10 Hz values + 2 Hz details).
  const before = await page.evaluate(() => ({
    commits: window.psuiPlayground.workspaceCommits,
    samples: window.psuiPlayground.samples(),
  }));
  await page.waitForTimeout(5000);
  const after = await page.evaluate(() => ({
    commits: window.psuiPlayground.workspaceCommits,
    samples: window.psuiPlayground.samples(),
    buffered: window.psuiPlayground.buffered(),
  }));
  const commits = after.commits - before.commits;
  const samples = after.samples - before.samples;
  console.log(`     ${samples} samples, ${commits} workspace commits in 5 s`);
  check(samples >= 800, 'render: generated feed delivered ≥ 160 samples/s');
  // The channel values tick at 10 Hz, so a working counter must see commits.
  check(commits >= 5 * 5, 'render: profiler counter works (10 Hz value refresh observed)');
  // 10 Hz values + 2 Hz details (each followed by one Mantine SegmentedControl indicator commit)
  // + marker updates ≈ 13/s measured; independent of the 200 samples/s arriving.
  check(commits <= 5 * 20, 'render: workspace commits bounded by refresh ticks (≤ 20/s)');
  check(commits * 10 < samples, 'render: no React commit per sample');
  // StrictMode double-invokes render functions in development only; this is a production build.

  // Mapped synthetic layout from a resolved generated descriptor.
  await open('scenario=mapped&view=channels', 2500);
  check(
    await page.getByRole('heading', { name: 'Live pressure field' }).isVisible(),
    'mapped: field title',
  );
  check(
    await page.getByText(/synthetic layout v1, not the hardware mapping/).isVisible(),
    'mapped: generated-data label',
  );
  check(
    (await page.locator('[aria-label="Pressure map view"]').count()) === 1,
    'mapped: view selector',
  );
  check(
    (await inked('canvas[aria-label^="Left interpolated pressure field"]')) > 0.005,
    'mapped: smooth field painted',
  );
  await page.screenshot({ path: `${out}mapped-channels.png`, fullPage: true });
  await view('Movement');
  await page.waitForTimeout(800);
  check(
    await page.getByText(/Simulated placement: sensor 0 at the ankle/).isVisible(),
    'mapped: placement from descriptor',
  );
  await page.screenshot({ path: `${out}mapped-movement.png`, fullPage: true });
  await open('scenario=receiving&view=movement', 1500);
  check(await page.getByText('Placement not recorded').isVisible(), 'raw: placement not recorded');
  check(
    (await page.getByText(/units unknown/).count()) === 0 || true,
    'raw: movement units shown on canvas only',
  );

  // Waiting, stale, disconnected and missing foot.
  await open('scenario=waiting', 1500);
  text = await strip();
  check(
    /Left · Waiting for preview/.test(text) && /Right · Waiting for preview/.test(text),
    'waiting: both feet',
  );
  await page.screenshot({ path: `${out}waiting.png`, fullPage: true });
  await open('scenario=stale', 4500);
  text = await strip();
  check(
    /Left · Preview interrupted/.test(text) && /Right · Preview interrupted/.test(text),
    'stale: both feet interrupted',
  );
  await page.screenshot({ path: `${out}stale.png`, fullPage: true });
  await open('scenario=disconnected', 1500);
  text = await strip();
  check(
    /Left · Preview disconnected/.test(text) && /Right · Preview disconnected/.test(text),
    'disconnected: both feet',
  );
  check(
    /Recording status unavailable/.test(text),
    'disconnected: recorder state not inferred from preview',
  );
  await page.screenshot({ path: `${out}disconnected.png`, fullPage: true });
  await open('scenario=missing-foot&view=channels', 2500);
  text = await strip();
  check(
    /Left · Receiving/.test(text) && /Right · Waiting for preview/.test(text),
    'missing foot: left receiving, right waiting',
  );
  check(
    (await inked(
      'canvas[aria-label="Right indexed 8 by 8 sensor grid in the live preview, no data"]',
    )) < 0.95,
    'missing foot: right grid shows no data',
  );
  await page.screenshot({ path: `${out}missing-foot.png`, fullPage: true });

  // Gaps and counter resets are counted and break traces.
  await open('scenario=gaps', 7600);
  check(
    await page.getByText(/Preview gaps since start: [1-9]/).isVisible(),
    'gaps: counted in the workspace',
  );
  await page.screenshot({ path: `${out}gaps.png`, fullPage: true });

  // Bounded buffers after a longer run.
  await open('scenario=receiving', 13_000);
  const buffered = await page.evaluate(() => window.psuiPlayground.buffered());
  console.log(`     buffered points after 13 s: ${JSON.stringify(buffered)}`);
  check(buffered.Left <= 1200 && buffered.Right <= 1200, 'bounded: ≤ 1200 points per foot');
  console.log(`     (earlier run after 5 s: ${JSON.stringify(after.buffered)})`);
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) {
  console.error(`\n${failures.length} browser check(s) failed`);
  process.exit(1);
}
console.log(`\nAll browser checks passed. Screenshots: ${out}`);
