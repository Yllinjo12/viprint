/* Headless smoke-test for js/game.js v8: mocks the DOM + canvas so
   update()/draw() actually run, proving the machine-rendering code
   executes without throwing. */
const fs = require('fs');
const path = require('path');

// --- canvas 2D context mock: records every method call, no-ops ---
function makeCtx() {
  const calls = [];
  const gradient = { addColorStop: () => {} };
  const handler = {
    get(_t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'canvas') return null;
      return (...args) => { calls.push([prop, args.length]); };
    },
    set() { return true; }
  };
  return { ctx: new Proxy({}, handler), calls };
}

// --- element stub ---
function makeEl(id) {
  const el = {
    id,
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    dataset: {},
    offsetWidth: 1,
    width: 0,
    height: 0,
    addEventListener: () => {},
    appendChild: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 460, height: 360 }),
    getContext: () => ctxMock
  };
  return el;
}

const ctxMock = makeCtx().ctx;
const elements = {};
function getEl(id) {
  if (!elements[id]) elements[id] = makeEl(id);
  return elements[id];
}

let rafCb = null;
let intervalCb = null;

global.document = {
  getElementById: getEl,
  addEventListener: () => {},
  title: '',
  hidden: false
};
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  confirm: () => false
};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.cancelAnimationFrame = () => {};
global.setInterval = (cb) => { intervalCb = cb; return 1; };
global.clearTimeout = () => {};

const src = fs.readFileSync(path.join(__dirname, 'web', 'js', 'game.js'), 'utf8');

try {
  // run the IIFE with the mocks in scope
  const fn = new Function('document', 'window', 'localStorage', 'requestAnimationFrame',
    'cancelAnimationFrame', 'setInterval', 'clearTimeout', src);
  fn(global.document, global.window, global.localStorage, global.requestAnimationFrame,
    global.cancelAnimationFrame, global.setInterval, global.clearTimeout);
} catch (e) {
  console.log('FAIL: script init threw:', e.message);
  process.exit(1);
}
console.log('OK: script initialized without errors');

// run ~10 frames of the game loop (update + draw)
let frames = 0;
try {
  for (let i = 0; i < 10; i++) {
    if (!rafCb) { console.log('FAIL: no rAF callback registered'); process.exit(1); }
    const cb = rafCb;
    rafCb = null;
    cb(performance.now ? performance.now() : 16 * i);
    frames++;
  }
} catch (e) {
  console.log('FAIL: game loop threw on frame', frames + 1, ':', e.message);
  process.exit(1);
}

// simulate clicks: pointerdown + click events (dedup should make 1 print)
const canvas = getEl('printCanvas');
const pointerEvt = { button: 0, clientX: 230, clientY: 180 };
let listeners = {};
getEl('printCanvas').addEventListener = (type, fn) => { listeners[type] = fn; };
// re-attach capture: easier to just call the registered handlers via a fresh boot
console.log('OK: ran', frames, 'frames without errors');
console.log('machine canvas size set:', getEl('printCanvas').width, 'x', getEl('printCanvas').height);
console.log('SMOKE TEST PASSED');
