// Records the site's videos from a real d2-live: one server on a copy of the
// fixture, one scene per video, driven by puppeteer in headless Chrome.
//
// Run through ../record.sh, which provides d2-live, Chrome and ffmpeg in a container.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { overlay } from './overlay.mjs';
import { closer, scenes } from './scenes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.ROOT || resolve(here, '..');
const out = resolve(root, process.env.OUT || 'videos');
const bin = process.env.D2LIVE || 'd2-live';
const chrome = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
].find((p) => existsSync(p));
const port = 47300 + Math.floor(Math.random() * 500);

const work = mkdtempSync(join(tmpdir(), 'd2-live-site-'));
const state = join(work, 'state');
const diagrams = join(work, 'diagrams');
mkdirSync(state);
mkdirSync(diagrams);
const fixture = join(root, 'fixture', 'order-fsm.d2');
const file = join(diagrams, 'order-fsm.d2');
copyFileSync(fixture, file);
mkdirSync(out, { recursive: true });

const server = spawn(bin, ['--port', String(port), '--no-browser', '--idle-timeout', '0', diagrams], {
  env: { ...process.env, XDG_RUNTIME_DIR: state },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stop = () => {
  server.kill();
  rmSync(work, { recursive: true, force: true });
};


async function waitHealthy() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('d2-live did not start');
}

const browser = await (async () => {
  await waitHealthy();
  return puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
    defaultViewport: { width: 1360, height: 820, deviceScaleFactor: 2 },
  });
})();

// 1600 px: the page shows a recording at up to ~800 CSS px, twice that for retina.
function encode(raw, base) {
  const run = (...args) => {
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, ...args], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${base}`);
  };
  run('-vf', 'scale=1600:-2', '-c:v', 'libx264', '-crf', '26', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', `${base}.mp4`);
  run('-ss', '0.8', '-frames:v', '1', '-vf', 'scale=1600:-2', '-q:v', '4', `${base}.jpg`);
  rmSync(raw);
}

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !scenes.some((s) => s.name === w));
if (unknown.length) {
  console.error(`no such scene: ${unknown.join(', ')} (have: ${scenes.map((s) => s.name).join(', ')})`);
  process.exit(2);
}
try {
  for (const scene of scenes) {
    if (wanted.length && !wanted.includes(scene.name)) continue;
    writeFileSync(file, readFileSync(fixture));
    await new Promise((r) => setTimeout(r, 400));
    await browser.defaultBrowserContext().overridePermissions(`http://127.0.0.1:${port}`, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(overlay);
    await page.evaluateOnNewDocument(() => localStorage.setItem('d2-live:panel-width', '400'));
    const url = `http://127.0.0.1:${port}/?file=${encodeURIComponent(file)}${scene.edit ? '&edit=1' : ''}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector(scene.edit ? '.cm-content' : '#scene svg');
    await new Promise((r) => setTimeout(r, 1200));
    if (!scene.edit) await closer(page, 2, 680, 430);
    const raw = join(out, `${scene.name}.raw.webm`);
    const recorder = await page.screencast({ path: raw });
    const t0 = Date.now();
    await Promise.race([
      scene.run(page, { file, fixture }),
      new Promise((_, fail) => setTimeout(() => fail(new Error(`${scene.name}: stuck for 120s`)), 120000)),
    ]);
    await recorder.stop();
    encode(raw, join(out, scene.name));
    console.log(`${scene.name}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await page.close();
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
  stop();
  process.exit(process.exitCode ?? 0);
}
