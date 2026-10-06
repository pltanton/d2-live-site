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

export const scenes = [
  {
    name: 'hero',
    edit: true,
    async run(page, {file}) {
      mouse = {x: 900, y: 600};
      await sleep(1200);
      edit(file, (s) => s.replace('CANCELLED: {class: done_bad}',
        'CANCELLED: {class: done_bad}\nRETURN_REQUESTED: "RETURN_REQUESTED\\nwaits for the parcel back" {class: pause}'));
      await settle(page, 1300);
      edit(file, (s) => s + 'COMPLETED -> RETURN_REQUESTED: "customer: RETURN" {class: evt}\nRETURN_REQUESTED -> CANCELLED: "parcel: RECEIVED" {class: evt}\n');
      await settle(page, 900);
      await page.keyboard.press('f');
      await sleep(1300);
      await clickId(page, 'RETURN_REQUESTED', 900);
      await sleep(1100);
      await clickSel(page, '[data-focus="id"]', 700);
      await combo(page, 'a');
      await sleep(250);
      await type(page, 'RETURNING', 70);
      await sleep(300);
      await page.keyboard.press('Enter');
      await settle(page, 2200);
    },
  },
  {
    name: 'select',
    edit: true,
    async run(page) {
      mouse = {x: 820, y: 640};
      await sleep(700);
      await clickId(page, 'PAYMENT_PENDING');
      await sleep(1500);
      await clickId(page, '(PAYMENT_CAPTURED -> SHIPPED)[0]');
      await sleep(1500);
      await clickId(page, 'CANCELLED');
      await sleep(1500);
      await clickText(page, '.cm-line', 'SHIPPED: {class: active}');
      await sleep(1500);
      await clickText(page, '.cm-line', 'CART_LOCKED -> PAYMENT_PENDING');
      await sleep(1700);
      await page.keyboard.press('Escape');
      await sleep(600);
    },
  },
  {
    name: 'diagram',
    edit: true,
    async run(page) {
      mouse = {x: 820, y: 640};
      await sleep(600);
      await clickId(page, 'SHIPPED');
      await sleep(900);
      await clickSel(page, '.d2l-mini-class');
      await sleep(700);
      await clickText(page, '.d2l-menu button', 'pause');
      await settle(page, 900);
      await clickSel(page, '.d2l-mini > button[title^="Connect"]', 700);
      await sleep(900);
      await clickId(page, 'CANCELLED', 900);
      await sleep(700);
      await type(page, 'carrier: LOST', 65);
      await combo(page, 'Enter');
      await settle(page, 1200);
      await clickId(page, 'SHIPPED');
      await sleep(700);
      await clickSel(page, '.d2l-mini > button[title^="Connect"]', 700);
      await sleep(700);
      const p = await at(page, 'COMPLETED');
      await click(page, p.x - 170, p.y + 40, 800);
      await sleep(700);
      await type(page, 'RETURNED', 70);
      await page.keyboard.press('Enter');
      await settle(page, 2000);
    },
  },
  {
    name: 'code',
    edit: true,
    async run(page) {
      mouse = {x: 1000, y: 500};
      await clickText(page, '.cm-line', 'SHIPPED -> COMPLETED');
      await page.keyboard.press('End');
      await sleep(500);
      await type(page, '\nPAYMENT_CAPTURED -> ON_HOLD: ', 55);
      await sleep(1500);
      await type(page, '"fraud check" {class: evt}', 55);
      await sleep(1200);
      await type(page, '\nON_HOLD -> SHIPPED: "cleared" {class: evt}', 50);
      await sleep(1600);
      await combo(page, 's');
      await settle(page, 2200);
    },
  },
  {
    name: 'external',
    edit: true,
    async run(page, {file}) {
      mouse = {x: 820, y: 640};
      await sleep(500);
      await clickId(page, 'PAYMENT_PENDING');
      await sleep(1300);
      edit(file, (s) => s.replace('"PAYMENT_PENDING\\nwaits for the card network"', '"PAYMENT_PENDING\\nwaits for the card network (3DS)"'));
      await settle(page, 1800);
      await clickText(page, '.cm-line', 'SHIPPED -> COMPLETED');
      await page.keyboard.press('End');
      await type(page, '\n# carriers report within a day', 45);
      await sleep(500);
      edit(file, (s) => s + 'COMPLETED -> CART_LOCKED: "reorder" {class: sync}\n');
      await sleep(1800);
      await clickText(page, '.d2l-banner button', 'Keep mine', 800);
      await settle(page, 2200);
    },
  },
];
