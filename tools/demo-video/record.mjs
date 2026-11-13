// Records the demo: launches headless Chrome, opens the site, runs the scripted
// timeline in timeline.js and saves every painted frame with its timestamp.
// Uses only Node built-ins (Chrome DevTools Protocol over WebSocket).
//
//   node tools/demo-video/record.mjs [http://localhost:5174/]
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const framesDir = join(out, 'frames');
const url = process.argv[2] ?? 'http://localhost:5174/?tilt=12';
const W = 1280;
const H = 720;
const PORT = 9333;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(out, 'chrome-profile')}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--ignore-gpu-blocklist',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageSocketUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await pageSocketUrl());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    listeners.get(msg.method)?.(msg.params);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => listeners.set('Page.loadEventFired', r));
// Wait for Three.js (from the CDN) and the first frames
for (let i = 0; i < 100 && !(await evaluate('!!window.__cat')); i++) await sleep(100);
await sleep(1500);

// Clean frame: no HUD, hints or bottom caption; skip the intro card via mouse mode.
await evaluate(`(() => {
  const s = document.createElement('style');
  s.textContent = '#hud,#hint,#capBottom,#pip,#levelPanel{display:none!important}';
  document.head.appendChild(s);
  document.getElementById('mouseBtn').click();
})()`);
await sleep(800);

// Record every painted frame
const frames = [];
listeners.set('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = `${String(frames.length).padStart(5, '0')}.jpg`;
  writeFileSync(join(framesDir, file), Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp * 1000 }); // epoch ms
  send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await sleep(300);

const timeline = readFileSync(join(here, 'timeline.js'), 'utf8');
const { marks, timeOrigin } = await evaluate(`(async () => { ${timeline}; const marks = await runDemo(); return { marks, timeOrigin: performance.timeOrigin }; })()`, true);
await sleep(300);
await send('Page.stopScreencast');

// Scene marks as epoch ms, to line up with frame timestamps
const epochMarks = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, timeOrigin + v]));
writeFileSync(join(out, 'frames.json'), JSON.stringify({ frames, marks: epochMarks }, null, 1));
const span = (frames.at(-1).t - frames[0].t) / 1000;
console.log(`recorded ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps)`);

ws.close();
chrome.kill();
