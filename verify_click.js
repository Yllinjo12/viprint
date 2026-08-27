/* End-to-end click verification for js/game.js: boots the real engine with
   mocked DOM/canvas, dispatches a pointerdown on the canvas, and checks the
   money HUD increments — proving the click->print->payout path works. */
const fs = require('fs');
const path = require('path');

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

const ctxMock = makeCtx().ctx;
const elements = {};
const listeners = {};
function makeEl(id) {
  return {
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
    addEventListener: (type, fn) => { listeners[id + ':' + type] = fn; },
    appendChild: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 460, height: 360 }),
    getContext: () => ctxMock
  };
}
function getEl(id) {
  if (!elements[id]) elements[id] = makeEl(id);
  return elements[id];
}

let rafCb = null;
global.document = {
  getElementById: getEl,
  addEventListener: () => {},
  createElement: () => ({ className: '', textContent: '', style: {}, addEventListener: () => {}, remove: () => {} }),
  title: '',
  hidden: false
};
global.window = { devicePixelRatio: 1, addEventListener: () => {}, confirm: () => false };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.cancelAnimationFrame = () => {};
global.setInterval = () => 1;
global.clearTimeout = () => {};

const src = fs.readFileSync(path.join(__dirname, 'web', 'js', 'game.js'), 'utf8');
const fn = new Function('document', 'window', 'localStorage', 'requestAnimationFrame',
  'cancelAnimationFrame', 'setInterval', 'clearTimeout', src);
fn(global.document, global.window, global.localStorage, global.requestAnimationFrame,
  global.cancelAnimationFrame, global.setInterval, global.clearTimeout);

const moneyEl = getEl('clickerMoney');
const before = moneyEl.textContent;
console.log('money before click:', before);

// simulate one physical gesture: pointerdown -> mousedown -> click (dedupe should allow 1)
const evt = { button: 0 };
for (const type of ['pointerdown', 'mousedown', 'click']) {
  const h = listeners['printCanvas:' + type];
  if (!h) { console.log('FAIL: no listener for', type); process.exit(1); }
  h(evt);
}

const after = moneyEl.textContent;
console.log('money after click:', after);

// run one frame to exercise the new draw path (carriage, panel, tray, ripples)
if (rafCb) { const cb = rafCb; rafCb = null; cb(16); }

const ok = before !== after;
console.log(ok ? 'CLICK VERIFY PASSED' : 'CLICK VERIFY FAILED: money did not change');
process.exit(ok ? 0 : 1);
