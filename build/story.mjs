// Builds the scroll story: every step is a version of the fixture produced by
// d2-live's own edit ops (POST /edit) and rendered by its own renderer
// (POST /render), so the diffs and pictures on the page are the tool's.
//
//   D2LIVE=/path/to/d2-live node build/story.mjs
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site', 'story');
const bin = process.env.D2LIVE || 'd2-live';
const port = 47800 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;

const steps = [
  {
    title: 'A diagram is a file',
    text: 'Point d2-live at a <code>.d2</code> file and it keeps the picture open next to your work, redrawn on every save — from your editor, a script, anything.',
  },
  {
    title: 'Point at a state',
    text: 'Click it on the diagram and its declaration lights up in the code, every other mention dimmer. Put the cursor on a line and the picture answers back.',
    select: 'PAYMENT_PENDING',
  },
  {
    title: 'Rename it',
    text: 'Type a new name and every transition that mentions it follows: the declaration and the two transitions change, nothing else in the file moves.',
    ops: [{kind: 'rename', id: 'PAYMENT_CAPTURED', to: 'PAID'}],
    select: 'PAID',
  },
  {
    title: 'Restyle it',
    text: 'Pick a class from a menu that shows its colours. The class name changes in place, inside the braces that already hold it.',
    ops: [{kind: 'set', id: 'SHIPPED', key: 'class', value: 'pause'}],
    select: 'SHIPPED',
  },
  {
    title: 'Wire a transition',
    text: 'Connect, click the target, type the event. The new line goes next to the other transitions out of that state, not at the bottom of the file.',
    ops: [{kind: 'createEdge', src: 'SHIPPED', dst: 'CANCELLED', label: 'carrier: LOST', class: 'evt'}],
    select: '(SHIPPED -> CANCELLED)[0]',
  },
  {
    title: 'Grow the machine',
    text: 'Connect into empty canvas and you get a new state already wired in, with the classes you used last.',
    ops: [
      {kind: 'createNodeWithEdge', src: 'COMPLETED', class: 'pause', edgeClass: 'evt'},
      {kind: 'rename', id: 'NEW_STATE', to: 'RETURN_REQUESTED'},
      {kind: 'set', id: '(COMPLETED -> RETURN_REQUESTED)[0]', key: 'label', value: 'customer: RETURN'},
    ],
    select: 'RETURN_REQUESTED',
  },
  {
    title: 'Or just type',
    text: 'The code panel is an editor. The picture follows what you type before you save, and keeps the last good drawing while a line is half-written.',
    edit: (s) => s.replace('SHIPPED -> COMPLETED: "carrier: DELIVERED" {class: evt}\n',
      'SHIPPED -> COMPLETED: "carrier: DELIVERED" {class: evt}\nPAID -> ON_HOLD: "fraud check" {class: evt}\nON_HOLD -> SHIPPED: "cleared" {class: evt}\n'),
    select: 'ON_HOLD',
  },
];

const work = mkdtempSync(join(tmpdir(), 'd2-live-story-'));
mkdirSync(join(work, 'state'));
const file = join(work, 'order-fsm.d2');
copyFileSync(join(root, 'fixture', 'order-fsm.d2'), file);
const server = spawn(bin, ['--port', String(port), '--no-browser', '--idle-timeout', '0', file], {
  env: {...process.env, XDG_RUNTIME_DIR: join(work, 'state')},
  stdio: ['ignore', 'ignore', 'inherit'],
});
const cleanup = () => {
  server.kill();
  rmSync(work, {recursive: true, force: true});
};
process.on('exit', cleanup);

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${base}/healthz`)).ok) break;
  } catch { /* starting */ }
  if (i > 100) throw new Error('d2-live did not start');
  await new Promise((r) => setTimeout(r, 100));
}

async function op(text, o) {
  const res = await fetch(`${base}/edit`, {method: 'POST', body: JSON.stringify({text, op: o})});
  const body = await res.json();
  if (!res.ok) throw new Error(`${o.kind}: ${body.message}`);
  return body.text;
}

async function render(text) {
  const res = await fetch(`${base}/render?file=${encodeURIComponent(file)}&layout=elk`, {method: 'POST', body: text});
  if (!res.ok) throw new Error(`render: ${res.headers.get('X-D2-Error')}`);
  return res.text();
}

function token(id) {
  const escaped = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return Buffer.from(escaped, 'utf8').toString('base64');
}

function lines(text) {
  return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

function diff(a, b) {
  const n = a.length, m = b.length;
  const lcs = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const added = [], removed = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; }
    else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) removed.push({at: j, text: a[i++].replace(/\n$/, '')});
    else added.push(j++);
  }
  return {added, removed};
}

rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
let text = readFileSync(file, 'utf8');
const story = [];
for (const [n, step] of steps.entries()) {
  const before = text;
  for (const o of step.ops || []) text = await op(text, o);
  if (step.edit) text = step.edit(text);
  const svg = await render(text);
  const name = `${String(n).padStart(2, '0')}.svg`;
  writeFileSync(join(out, name), svg);
  const now = lines(text);
  const {added, removed} = n === 0 ? {added: [], removed: []} : diff(lines(before), now);
  story.push({
    title: step.title,
    text: step.text,
    svg: `story/${name}`,
    code: now.map((l) => l.replace(/\n$/, '')),
    added,
    removed,
    select: step.select ? token(step.select) : null,
    selectText: step.select || null,
  });
  console.log(`${name}: ${step.title} (+${added.length} −${removed.length})`);
}
writeFileSync(join(out, 'story.json'), JSON.stringify(story));
cleanup();
process.exit(0);
