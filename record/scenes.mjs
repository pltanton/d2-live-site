import { readFileSync, writeFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mouse = {x: 640, y: 380};

async function glide(page, x, y, ms = 650) {
  const from = {...mouse};
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  mouse = {x, y};
}

async function click(page, x, y, ms) {
  await glide(page, x, y, ms);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
}

function token(id) {
  const escaped = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return Buffer.from(escaped, 'utf8').toString('base64');
}

async function at(page, id) {
  const box = await page.evaluate((tok, isEdge) => {
    const g = [...document.querySelectorAll('#scene g[class]')].find((n) => n.getAttribute('class').split(' ')[0] === tok);
    if (!g) return null;
    const el = isEdge ? (g.querySelector('text') || g.querySelector('path')) : g;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  }, token(id), id.startsWith('('));
  if (!box) throw new Error(`nothing on the diagram for ${id}`);
  return box;
}

async function clickId(page, id, ms) {
  const p = await at(page, id);
  await click(page, p.x, p.y, ms);
}

async function selector(page, sel) {
  const r = await page.$eval(sel, (e) => {
    const b = e.getBoundingClientRect();
    return {x: b.left + b.width / 2, y: b.top + b.height / 2};
  });
  return r;
}

async function clickSel(page, sel, ms) {
  const p = await selector(page, sel);
  await click(page, p.x, p.y, ms);
}

async function clickText(page, sel, text, ms) {
  const p = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text || e.textContent.includes(text));
    if (!el) return null;
    el.scrollIntoView({block: 'center'});
    const b = el.getBoundingClientRect();
    return {x: b.left + Math.min(b.width / 2, 120), y: b.top + b.height / 2};
  }, sel, text);
  if (!p) throw new Error(`no ${sel} with ${text}`);
  await click(page, p.x, p.y, ms);
}

async function type(page, text, delay = 55) {
  for (const ch of text) {
    if (ch === '\n') await page.keyboard.press('Enter');
    else await page.keyboard.type(ch);
    await sleep(delay + Math.random() * 30);
  }
}

async function combo(page, key, mods = ['Meta']) {
  for (const m of mods) await page.keyboard.down(m);
  await page.keyboard.press(key);
  for (const m of mods.reverse()) await page.keyboard.up(m);
}

const rendered = (page) => page.waitForFunction(() => document.getElementById('d2l-rendering')?.hidden !== false, {timeout: 15000});

async function settle(page, ms = 900) {
  await sleep(350);
  await rendered(page);
  await sleep(ms);
}

function edit(file, fn) {
  writeFileSync(file, fn(readFileSync(file, 'utf8')));
}

const connectButton = '.d2l-mini > button[title^="Connect"]';

export async function closer(page, ticks, x = 560, y = 430) {
  await page.mouse.move(x, y);
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel({deltaY: -50});
    await sleep(60);
  }
  await sleep(300);
}

async function hud(page) {
  await glide(page, ...Object.values(await selector(page, '#pill')), 700);
  await sleep(500);
}

export const scenes = [
  {
    name: 'view',
    async run(page, {file}) {
      mouse = {x: 900, y: 700};
      await sleep(600);
      edit(file, (s) => s.replace('SHIPPED -> COMPLETED', 'SHIPPED -> CANCELLED: "carrier: LOST" {class: evt}\nSHIPPED -> COMPLETED'));
      await sleep(1500);
      await hud(page);
      await glide(page, ...Object.values(await selector(page, '#layout-select')), 450);
      await page.mouse.down();
      await page.mouse.up();
      await sleep(300);
      await page.select('#layout-select', 'dagre');
      await sleep(1500);
      await clickSel(page, '#panel .switch', 450);
      await sleep(1500);
      const p = await at(page, 'PAYMENT_PENDING');
      await glide(page, p.x, p.y, 700);
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel({deltaY: -50});
        await sleep(70);
      }
      await sleep(500);
      await page.mouse.down();
      await glide(page, p.x - 140, p.y - 160, 800);
      await page.mouse.up();
      await sleep(700);
      await page.keyboard.press('f');
      await sleep(1600);
    },
  },
  {
    name: 'export',
    async run(page) {
      mouse = {x: 900, y: 700};
      await sleep(600);
      await hud(page);
      await clickSel(page, '#copy-png', 600);
      await page.waitForFunction(() => /PNG/.test(document.getElementById('toast').textContent), {timeout: 10000});
      const toast = await page.$eval('#toast', (e) => e.textContent);
      if (toast !== 'copied PNG') throw new Error(`export: toast says "${toast}"`);
      await sleep(1300);
      await clickSel(page, '#copy-svg', 500);
      await sleep(1500);
      await clickSel(page, '#download-png', 500);
      await sleep(1800);
    },
  },
  {
    name: 'edit',
    async run(page) {
      mouse = {x: 900, y: 700};
      await sleep(500);
      await page.keyboard.press('e');
      await page.waitForSelector('.cm-content', {visible: true});
      await sleep(900);
      await closer(page, 2, 420, 430);
      await sleep(400);
      await clickId(page, 'SHIPPED', 800);
      await sleep(800);
      await clickSel(page, connectButton, 600);
      await sleep(500);
      await clickId(page, 'CANCELLED', 900);
      await sleep(400);
      await type(page, 'carrier: LOST', 60);
      await combo(page, 'Enter');
      await settle(page, 1200);
      await clickId(page, 'PAYMENT_CAPTURED', 800);
      await sleep(600);
      await clickSel(page, '[data-focus="id"]', 600);
      await combo(page, 'a');
      await type(page, 'PAID', 90);
      await page.keyboard.press('Enter');
      await settle(page, 2000);
    },
  },
];
