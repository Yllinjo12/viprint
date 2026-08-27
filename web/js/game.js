/* ============================================================
   Viprint Press X9 — high-end digital printing press
   Click the machine to print sheets and earn money.
   Upgrades: new print head (more per click) and auto-feed
   roller (prints every second).
   The machine is drawn live on canvas: white press body with a
   lid + handle, top paper input tray, sliding CMYK print-head
   carriage, paper roll window, ink cartridges, output slot with
   rollers and a wide catch tray. No text on the art.
   Progress is saved automatically.
   ============================================================ */

(function () {
  'use strict';

  // --- elements ---
  const canvas = document.getElementById('printCanvas');
  const ctx = canvas.getContext('2d');
  const moneyEl = document.getElementById('clickerMoney');
  const perClickEl = document.getElementById('clickerPerClick');
  const perSecEl = document.getElementById('clickerPerSec');
  const fxLayer = document.getElementById('clickerFx');
  const muteBtn = document.getElementById('gameMute');
  const buyClickBtn = document.getElementById('buyClick');
  const buyAutoBtn = document.getElementById('buyAuto');
  const costClickEl = document.getElementById('costClick');
  const costAutoEl = document.getElementById('costAuto');
  const lvlClickEl = document.getElementById('lvlClick');
  const lvlAutoEl = document.getElementById('lvlAuto');
  const descClickEl = document.getElementById('descClick');
  const descAutoEl = document.getElementById('descAuto');
  const resetBtn = document.getElementById('clickerReset');

  // --- canvas setup ---
  const W = 460;
  const H = 400;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.scale(DPR, DPR);

  // --- machine geometry (X9: high-end digital press) ---
  const MX = 12, MY = 6, MW = 436, MH = 330;            // body
  const SLOT = { x: 200, y: 150, w: 84, h: 16 };        // paper output slot
  const PAPER_W = 84, PAPER_MAX = 100;
  const RW = { x: 44, y: 130, w: 138, h: 88 };          // paper roll window
  const ROLL = { cx: 113, cy: 174, R: 40 };
  const IB = { x: 304, y: 130, w: 128, h: 88 };         // CMYK ink bay
  const TRAY = { x: 44, y: 34, w: 150, h: 30 };         // top input tray
  const PANEL = { x: 298, y: 30, w: 132, h: 92 };       // control panel
  const CARRIAGE = { x: 48, y: 74, w: 244, h: 44 };     // print-head window
  const TRAY_OUT = { x: 62, y: 316, w: 236, h: 18 };    // output catch tray
  const PILE_BASE = 316;
  const LAND_Y = 322;                                   // sheets land on the tray
  // --- colorful printed paper ---
  const PAPER_COLORS = ['#d4001f', '#3b82f6', '#facc15', '#22d3ee', '#a855f7', '#22c55e'];
  // --- CMYK ink cartridges ---
  const INKS = [
    { ink: '#22d3ee', led: '#22d3ee' },   // cyan
    { ink: '#ec4899', led: '#ec4899' },   // magenta
    { ink: '#facc15', led: '#facc15' },   // yellow
    { ink: '#2b2e33', led: '#94a3b8' }    // black
  ];

  // --- state ---
  const SAVE_KEY = 'viprintPress';
  let money = 0;
  let headLv = 0;    // "New print head" → sheets per click
  let feedLv = 0;    // "Auto-feed roller" → sheets per second
  let papers = [];   // {x, prog, state: out|fall, y, vy, vx, rot, vrot}
  let bits = [];     // paper scatter on pile clear
  let pileCount = 0;
  let flash = 0;     // slot glow / LED boost on print
  let pressT = 0;    // button press animation
  let rollAngle = 0; // paper roll rotation
  let rollSpin = 0;  // extra spin speed while printing
  let time = 0;
  let muted = false;
  let audioCtx = null;
  let raf = null;
  let lastEvt = 0;   // dedupe stamp for pointer/mouse/click triple-fire

  // --- formulas ---
  const costClick = (lv) => Math.floor(50 * Math.pow(1.5, lv));
  const costAuto = (lv) => Math.floor(100 * Math.pow(1.6, lv));
  const perClick = () => 1 + headLv;
  const perSec = () => feedLv;
  const fmt = (n) => '$' + Math.floor(n).toLocaleString();

  // --- save / load ---
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ money: money, headLv: headLv, feedLv: feedLv }));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && typeof d.money === 'number') {
        money = d.money;
        headLv = d.headLv || 0;
        feedLv = d.feedLv || 0;
      }
    } catch (e) { /* corrupted save — start fresh */ }
  }

  // --- tiny WebAudio synth (no files) ---
  function sfx(kind) {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;

      if (kind === 'thunk') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.13);

        const tick = audioCtx.createOscillator();
        const tg = audioCtx.createGain();
        tick.connect(tg); tg.connect(audioCtx.destination);
        tick.type = 'square';
        tick.frequency.setValueAtTime(900, t);
        tick.frequency.exponentialRampToValueAtTime(300, t + 0.03);
        tg.gain.setValueAtTime(0.05, t);
        tg.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        tick.start(t); tick.stop(t + 0.04);
      } else if (kind === 'buy') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.setValueAtTime(780, t + 0.07);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.start(t); osc.stop(t + 0.15);
      }
    } catch (e) { /* audio unavailable — ignore */ }
  }

  // --- floating text feedback ---
  function float(x, y, text, cls) {
    const el = document.createElement('span');
    el.className = 'clicker-float' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    fxLayer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // --- print sheets ---
  function printSheets(n, auto) {
    money += n;

    const count = Math.min(n, 4);
    for (let i = 0; i < count; i++) {
      papers.push({
        x: SLOT.x + SLOT.w / 2 + (i - (count - 1) / 2) * 12,
        prog: 0,
        state: 'out',
        pat: Math.floor(Math.random() * PAPER_COLORS.length),
        y: 0, vy: 0, vx: 0, rot: 0, vrot: 0
      });
    }

    flash = 1;
    pressT = 1;
    rollSpin = 0.06;

    const sr = fxLayer.getBoundingClientRect();
    float(sr.width / 2 - 35 + Math.random() * 70, sr.height * 0.24,
          (auto ? '⚙️ ' : '🖨️ ') + '+' + fmt(n), auto ? 'auto' : '');

    sfx('thunk');
    updateUI();
    save();
  }

  function pressButton(e) {
    if (e.button === 2 || e.button === 1) return;
    const now = Date.now();
    if (now - lastEvt < 120) return;
    lastEvt = now;
    printSheets(perClick(), false);
  }

  // --- pile clear: paper bits scatter ---
  function clearPile() {
    for (let i = 0; i < 8; i++) {
      bits.push({
        x: TRAY_OUT.x + 20 + Math.random() * (TRAY_OUT.w - 40),
        y: PILE_BASE - 4,
        vx: (Math.random() - 0.5) * 3,
        vy: -2 - Math.random() * 2,
        life: 42,
        w: 12 + Math.random() * 12,
        h: 3
      });
    }
    pileCount = 0;
  }

  // --- update ---
  function update() {
    time += 0.016;
    flash = Math.max(0, flash - 0.04);
    pressT = Math.max(0, pressT - 0.04);
    rollAngle += 0.008 + rollSpin;
    rollSpin = Math.max(0, rollSpin - 0.002);

    for (let i = papers.length - 1; i >= 0; i--) {
      const p = papers[i];
      if (p.state === 'out') {
        p.prog += 0.06;
        if (p.prog >= 1) {
          p.prog = 1;
          p.state = 'fall';
          p.y = SLOT.y + SLOT.h + 8 + PAPER_MAX;
          p.vy = 1.5;
          p.vx = -3 + (Math.random() - 0.5) * 1.2;   // drift into the output tray
          p.vrot = (Math.random() - 0.5) * 0.05;
        }
      } else {
        p.vy += 0.35;
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vrot;
        if (p.y >= LAND_Y) {
          papers.splice(i, 1);
          pileCount += 1;
          if (pileCount >= 25) clearPile();
        }
      }
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.vy += 0.15;
      b.x += b.vx;
      b.y += b.vy;
      b.life -= 1;
      if (b.life <= 0) bits.splice(i, 1);
    }
  }

  // --- drawing helpers ---
  function roundRectPath(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function led(x, y, r, color) {
    // plain status dot — no glow, no pulsing
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- top input paper tray with feed rollers ---
  function drawTopTray() {
    const t = time;
    // tray frame (dark gray)
    ctx.fillStyle = '#31353b';
    roundRectPath(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    roundRectPath(TRAY.x + 0.5, TRAY.y + 0.5, TRAY.w - 1, TRAY.h - 1, 8);
    ctx.stroke();
    // light interior
    ctx.fillStyle = '#dfe3e8';
    roundRectPath(TRAY.x + 6, TRAY.y + 4, TRAY.w - 12, TRAY.h - 8, 5);
    ctx.fill();

    // paper stack (fan)
    for (let i = 0; i < 5; i++) {
      const sx = TRAY.x + 14 + i * 1.6;
      const sy = TRAY.y + 8 + i * 1.2;
      ctx.fillStyle = i === 4 ? '#ffffff' : '#f2f4f7';
      roundRectPath(sx, sy, 118, 16, 2);
      ctx.fill();
      // colorful printed edge
      ctx.fillStyle = PAPER_COLORS[i % PAPER_COLORS.length];
      ctx.fillRect(sx, sy, 4, 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      roundRectPath(sx + 0.5, sy + 0.5, 117, 15, 2);
      ctx.stroke();
    }

    // paper width guides
    ctx.fillStyle = '#565c64';
    ctx.beginPath();
    ctx.moveTo(TRAY.x + 10, TRAY.y + 6);
    ctx.lineTo(TRAY.x + 16, TRAY.y + 6);
    ctx.lineTo(TRAY.x + 13, TRAY.y + 13);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(TRAY.x + 140, TRAY.y + 6);
    ctx.lineTo(TRAY.x + 134, TRAY.y + 6);
    ctx.lineTo(TRAY.x + 137, TRAY.y + 13);
    ctx.closePath();
    ctx.fill();

    // cassette front lip
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRectPath(TRAY.x + 2, TRAY.y + TRAY.h - 5, TRAY.w - 4, 3, 1.5);
    ctx.fill();

    // feed mouth + two vertical rollers
    ctx.fillStyle = '#0d1115';
    roundRectPath(TRAY.x + TRAY.w - 26, TRAY.y + 5, 20, TRAY.h - 10, 4);
    ctx.fill();
    drawVRoller(TRAY.x + TRAY.w - 24, TRAY.y + 7, 6, TRAY.h - 14, t);
    drawVRoller(TRAY.x + TRAY.w - 14, TRAY.y + 7, 6, TRAY.h - 14, t + 1.3);

    // plain paper guide strip (no glow)
    ctx.fillStyle = 'rgba(28,32,38,0.10)';
    roundRectPath(TRAY.x + 4, TRAY.y + TRAY.h + 2, TRAY.w - 8, 3, 1.5);
    ctx.fill();
  }

  // vertical mini roller (for the feed mouth)
  function drawVRoller(x, y, w, h, t) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#6b7078');
    g.addColorStop(0.5, '#454a51');
    g.addColorStop(1, '#2a2e33');
    ctx.fillStyle = g;
    roundRectPath(x, y, w, h, w / 2);
    ctx.fill();
    const hy = ((t * 24) % Math.max(h - 14, 1)) + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRectPath(x + 0.8, y + hy, w - 1.6, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRectPath(x, y, w, 1.2, 0.6);
    ctx.fill();
  }

  // --- the machine (X9 press body) ---
  function drawMachine() {
    const t = time;

    // soft drop shadow
    ctx.fillStyle = 'rgba(28,32,38,0.16)';
    ctx.beginPath();
    ctx.ellipse(MX + MW / 2, MY + MH + 12, MW * 0.46, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // white body (like an office digital press)
    const g = ctx.createLinearGradient(0, MY, 0, MY + MH);
    g.addColorStop(0, '#fbfcfe');
    g.addColorStop(0.6, '#f0f2f6');
    g.addColorStop(1, '#e3e7ec');
    ctx.fillStyle = g;
    roundRectPath(MX, MY, MW, MH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1.5;
    roundRectPath(MX + 0.75, MY + 0.75, MW - 1.5, MH - 1.5, 20);
    ctx.stroke();

    // lid (top band, dark) + handle + hinges — clipped to the body
    ctx.save();
    roundRectPath(MX, MY, MW, MH, 20);
    ctx.clip();

    const lg = ctx.createLinearGradient(0, MY, 0, MY + 30);
    lg.addColorStop(0, '#3a3f46');
    lg.addColorStop(1, '#2b2f35');
    ctx.fillStyle = lg;
    ctx.fillRect(MX, MY, MW, 30);
    // lid highlights + seam
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(MX + 4, MY + 2, MW - 8, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(MX + 4, MY + 26, MW - 8, 2);
    // handle (center) with grip ridges
    ctx.fillStyle = '#4b5159';
    roundRectPath(208, MY + 8, 36, 14, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRectPath(213, MY + 12, 26, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(216 + i * 6, MY + 13, 1, 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRectPath(213, MY + 8, 26, 2, 1);
    ctx.fill();
    // hinges on the left edge
    ctx.fillStyle = '#4b5159';
    roundRectPath(MX + 8, MY + 20, 10, 8, 2);
    ctx.fill();
    roundRectPath(MX + 22, MY + 20, 10, 8, 2);
    ctx.fill();
    // lid rivets
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.arc(MX + 74, MY + 15, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(MX + MW - 74, MY + 15, 1.6, 0, Math.PI * 2); ctx.fill();

    // small corner status dots (static)
    led(MX + 40, MY + 15, 2.2, '#22d3ee');
    led(MX + MW - 40, MY + 15, 2.2, '#34d399');

    // paper-in indicator (under the lid, center) — plain line, no glow
    ctx.fillStyle = 'rgba(34,211,238,0.55)';
    roundRectPath(222, MY + 27, 62, 5, 2.5);
    ctx.fill();

    // thin dark base strip
    ctx.fillStyle = '#2b2f35';
    ctx.fillRect(MX, MY + MH - 22, MW, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(MX + 4, MY + MH - 20, MW - 8, 2);
    ctx.restore();

    // panel seams + corner screws
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(296, 30); ctx.lineTo(296, 122);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MX + 8, 222); ctx.lineTo(MX + MW - 8, 222);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const screws = [[26, 44], [422, 44], [26, 292], [422, 292]];
    for (const [sx2, sy2] of screws) {
      ctx.beginPath(); ctx.arc(sx2, sy2, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // control panel (top-right)
    drawPanel();

    // top input tray
    drawTopTray();

    // print-head carriage window (the printer signature)
    drawCarriage();

    // paper roll window (middle-left)
    drawRollCompartment();

    // ink cartridge bay (middle-right)
    drawInkBay();

    // vents (lower-left)
    for (let i = 0; i < 4; i++) {
      const vx = 48, vy = 232 + i * 9;
      ctx.fillStyle = 'rgba(28,32,38,0.12)';
      roundRectPath(vx, vy, 108, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(28,32,38,0.18)';
      roundRectPath(vx, vy + 2.5, 108, 1.5, 0.8);
      ctx.fill();
    }

    // status LEDs (lower-right)
    ctx.fillStyle = '#d5d9df';
    roundRectPath(316, 230, 104, 30, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    roundRectPath(316.5, 230.5, 103, 29, 6);
    ctx.stroke();
    led(330, 245, 3, '#3b82f6');
    led(350, 245, 3, '#22d3ee');
    led(370, 245, 3, '#34d399');
    ctx.fillStyle = '#262a30';
    roundRectPath(384, 238, 26, 14, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 1;
    roundRectPath(384, 238, 26, 14, 3);
    ctx.stroke();

    // front access door (toner-style) with handle
    ctx.fillStyle = '#e8ebf0';
    roundRectPath(200, 232, 96, 40, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(200.5, 232.5, 95, 39, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    roundRectPath(204, 236, 88, 32, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.arc(208, 240, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(288, 240, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa1ab';
    roundRectPath(242, 244, 12, 20, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    roundRectPath(242.5, 244.5, 11, 19, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRectPath(246, 248, 4, 12, 2);
    ctx.fill();

    // Viprint red brand stripe
    ctx.fillStyle = '#d4001f';
    roundRectPath(MX + 8, 274, MW - 16, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRectPath(MX + 8, 274, MW - 16, 2, 1);
    ctx.fill();

    // brand plate with the red triangle mark (no text)
    const baseY = MY + MH - 22; // 314
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRectPath(316, 282, 92, 24, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    roundRectPath(316.5, 282.5, 91, 23, 5);
    ctx.stroke();
    ctx.fillStyle = '#d4001f';
    ctx.beginPath();
    ctx.moveTo(330, 291);
    ctx.lineTo(322, 300);
    ctx.lineTo(338, 300);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(344, 291, 30, 2);
    ctx.fillRect(344, 296, 22, 2);
    ctx.fillRect(344, 301, 26, 2);

    // power button (small, left)
    ctx.fillStyle = '#14171a';
    ctx.beginPath();
    ctx.arc(70, 294, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(70, 294, 8, 0, Math.PI * 2);
    ctx.stroke();
    led(70, 294, 2, '#22d3ee');

    // feet with casters
    ctx.fillStyle = '#1c1e22';
    roundRectPath(40, MY + MH, 28, 8, 2);
    ctx.fill();
    roundRectPath(MX + MW - 68, MY + MH, 28, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#101216';
    ctx.beginPath(); ctx.arc(54, MY + MH + 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(MX + MW - 54, MY + MH + 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.arc(52.5, MY + MH + 7, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(MX + MW - 55.5, MY + MH + 7, 2, 0, Math.PI * 2); ctx.fill();

    // power cord (bottom-right)
    ctx.strokeStyle = '#191c20';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(MX + MW - 6, MY + MH - 8);
    ctx.quadraticCurveTo(MX + MW + 14, MY + MH - 4, MX + MW + 12, MY + MH + 22);
    ctx.stroke();
    ctx.fillStyle = '#191c20';
    roundRectPath(MX + MW + 8, MY + MH + 22, 10, 6, 2);
    ctx.fill();
  }

  // --- control panel (top-right): LCD + small buttons + print button ---
  function drawPanel() {
    const t = time;
    const { x: px, y: py, w: pw, h: ph } = PANEL;

    // panel body
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, '#dde1e7');
    pg.addColorStop(1, '#c9ced6');
    ctx.fillStyle = pg;
    roundRectPath(px, py, pw, ph, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    roundRectPath(px + 0.5, py + 0.5, pw - 1, ph - 1, 10);
    ctx.stroke();

    // LCD display: sheet icon + job meter
    const sx = px + 10, sy = py + 8, sw = pw - 20, sh = 32;
    ctx.fillStyle = '#0c1116';
    roundRectPath(sx, sy, sw, sh, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.25)';
    ctx.lineWidth = 1;
    roundRectPath(sx + 0.5, sy + 0.5, sw - 1, sh - 1, 6);
    ctx.stroke();
    // sheet-of-paper glyph
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRectPath(sx + 7, sy + 8, 9, 13, 2);
    ctx.fill();
    ctx.fillStyle = '#0c1116';
    ctx.beginPath();
    ctx.moveTo(sx + 13, sy + 8);
    ctx.lineTo(sx + 16, sy + 11);
    ctx.lineTo(sx + 13, sy + 11);
    ctx.closePath();
    ctx.fill();
    // job progress bars
    for (let i = 0; i < 5; i++) {
      const bh = 7 + (i % 3) * 4;
      const bx = sx + 30 + i * 13;
      ctx.fillStyle = '#19e3ff';
      ctx.fillRect(bx, sy + sh - 9 - bh, 8, bh);
    }
    ctx.fillStyle = 'rgba(34,211,238,0.35)';
    ctx.fillRect(sx + 5, sy + sh - 5, sw - 10, 1.5);
    // tiny round keys under the display
    for (let i = 0; i < 4; i++) {
      const kx = sx + 14 + i * 22;
      ctx.fillStyle = '#262a30';
      ctx.beginPath();
      ctx.arc(kx, sy + sh + 9, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(kx, sy + sh + 9, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // small square buttons (like a real printer's keypad)
    const by = py + ph - 22;
    for (let i = 0; i < 3; i++) {
      const bx = px + 14 + i * 24;
      ctx.fillStyle = '#262a30';
      roundRectPath(bx, by, 12, 12, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      roundRectPath(bx + 0.5, by + 0.5, 11, 11, 3);
      ctx.stroke();
    }
    led(px + 20, by + 6, 1.8, '#3b82f6');
    led(px + 44, by + 6, 1.8, '#22d3ee');
    led(px + 68, by + 6, 1.8, '#34d399');

    // print button (small, lights up solid while printing)
    const bx2 = px + pw - 34, by2 = py + ph - 26;
    const on = pressT > 0 || flash > 0;
    ctx.fillStyle = on ? '#1c2b2e' : '#262a30';
    roundRectPath(bx2, by2, 22, 16, 5);
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(34,211,238,0.9)' : 'rgba(34,211,238,0.4)';
    ctx.lineWidth = 2;
    roundRectPath(bx2, by2, 22, 16, 5);
    ctx.stroke();
    led(bx2 + 11, by2 + 8, on ? 3 : 2.2, '#22d3ee');
  }

  // --- print-head carriage window (sliding CMYK head, the printer signature) ---
  function drawCarriage() {
    const t = time;
    const { x, y, w, h } = CARRIAGE;

    // dark window
    const wg = ctx.createLinearGradient(0, y, 0, y + h);
    wg.addColorStop(0, '#171c23');
    wg.addColorStop(1, '#0d1116');
    ctx.fillStyle = wg;
    roundRectPath(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    roundRectPath(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 8);
    ctx.stroke();

    // metal guide rail
    const railY = y + h - 14;
    const rg = ctx.createLinearGradient(0, railY, 0, railY + 4);
    rg.addColorStop(0, '#5a6068');
    rg.addColorStop(0.5, '#3a3f46');
    rg.addColorStop(1, '#23272c');
    ctx.fillStyle = rg;
    roundRectPath(x + 6, railY, w - 12, 4, 2);
    ctx.fill();

    // ruler ticks under the rail
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const tx = x + 10 + i * 9.4;
      ctx.beginPath();
      ctx.moveTo(tx, railY + 5);
      ctx.lineTo(tx, railY + (i % 4 === 0 ? 8 : 6.5));
      ctx.stroke();
    }

    // head position — sweeps faster while printing
    const speed = 0.9 + 7 * pressT + 2.5 * flash;
    const headX = x + 30 + (w - 60) * (0.5 + 0.5 * Math.sin(t * speed));

    // flex cable (ribbon) from the head to the right wall
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(headX + 2, y + 12);
    ctx.quadraticCurveTo(headX + (x + w - headX) * 0.5, y + 4, x + w - 6, y + 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX + 2, y + 13.5);
    ctx.quadraticCurveTo(headX + (x + w - headX) * 0.5, y + 5.5, x + w - 6, y + 13.5);
    ctx.stroke();

    // CMYK ink trail behind the head while printing
    const trail = 26 + 20 * Math.max(pressT, flash * 0.6);
    const inkColors = ['#22d3ee', '#ec4899', '#facc15', '#2b2e33'];
    ctx.save();
    roundRectPath(x, y, w, h, 8);
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = inkColors[i];
      ctx.globalAlpha = 0.35;   // plain ink, no glow
      ctx.fillRect(headX - trail, y + 8 + i * 6, trail, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ink specks on the window glass
    ctx.fillStyle = 'rgba(20,24,30,0.35)';
    const specks = [[70, 82], [110, 88], [150, 80], [190, 90], [240, 84], [270, 92]];
    for (const [px2, py2] of specks) {
      ctx.beginPath(); ctx.arc(px2, py2, 1.1, 0, Math.PI * 2); ctx.fill();
    }

    // head body
    const hw = 40, hh = 18, hx = headX - hw / 2, hy = y + 8;
    const hg = ctx.createLinearGradient(0, hy, 0, hy + hh);
    hg.addColorStop(0, '#e8ebef');
    hg.addColorStop(1, '#c3c8d0');
    ctx.fillStyle = hg;
    roundRectPath(hx, hy, hw, hh, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    roundRectPath(hx + 0.5, hy + 0.5, hw - 1, hh - 1, 5);
    ctx.stroke();
    // CMYK nozzles on the head's underside
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = inkColors[i];
      ctx.beginPath();
      ctx.arc(hx + 9 + i * 8, hy + hh - 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // head highlight + status LED
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRectPath(hx + 3, hy + 2, hw - 6, 3, 1.5);
    ctx.fill();
    led(hx + hw - 6, hy + 5, 2, '#22d3ee');
  }

  // --- paper roll compartment (window, middle-left) ---
  function drawRollCompartment() {
    const t = time;
    const { cx, cy, R } = ROLL;

    // dark interior
    ctx.fillStyle = '#0d1115';
    roundRectPath(RW.x, RW.y, RW.w, RW.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    roundRectPath(RW.x + 1, RW.y + 1, RW.w - 2, RW.h - 2, 11);
    ctx.stroke();

    // metal axle rod (behind the roll)
    ctx.fillStyle = '#3a3f46';
    roundRectPath(RW.x + 2, cy - 4, RW.w - 4, 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRectPath(RW.x + 2, cy - 4, RW.w - 4, 3, 1.5);
    ctx.fill();

    // --- the paper roll ---
    ctx.save();
    ctx.translate(cx, cy);
    const pg = ctx.createRadialGradient(-8, -10, 4, 0, 0, R);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.85, '#f1f3f6');
    pg.addColorStop(1, '#dfe3e9');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.045)';
    ctx.lineWidth = 1;
    for (let r = 18; r < R; r += 6) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(rollAngle);
    ctx.strokeStyle = 'rgba(160,170,185,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, R - 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,170,185,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, R - 8);
    ctx.stroke();
    ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, R - 8);
    ctx.stroke();
    ctx.restore();
    // cardboard core
    const cg = ctx.createLinearGradient(-10, -10, 10, 10);
    cg.addColorStop(0, '#cba46f');
    cg.addColorStop(0.5, '#b98c52');
    cg.addColorStop(1, '#9c713c');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1c1f24';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4f57';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-2.5, -2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();

    // holder brackets
    ctx.fillStyle = '#2c3036';
    roundRectPath(RW.x + 2, cy - 6, 6, 12, 2);
    ctx.fill();
    roundRectPath(RW.x + RW.w - 8, cy - 6, 6, 12, 2);
    ctx.fill();

    // paper path (sheet leaving the roll toward the machine)
    ctx.strokeStyle = '#eef1f5';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(RW.x + 48, cy - 8);
    ctx.quadraticCurveTo(RW.x + 60, RW.y + 18, RW.x + 88, RW.y + 6);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RW.x + 48, cy - 8);
    ctx.quadraticCurveTo(RW.x + 60, RW.y + 18, RW.x + 88, RW.y + 6);
    ctx.stroke();

    // small static accent dots
    led(RW.x + 6, RW.y + 8, 2.5, '#22d3ee');
    led(RW.x + RW.w - 6, RW.y + 8, 2.5, '#3b82f6');
    ctx.fillStyle = 'rgba(28,32,38,0.25)';
    roundRectPath(RW.x + 8, RW.y + RW.h - 8, RW.w - 16, 3, 1.5);
    ctx.fill();

    // glass window frame + reflection
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = 2.5;
    roundRectPath(RW.x - 1, RW.y - 1, RW.w + 2, RW.h + 2, 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    roundRectPath(RW.x + 1, RW.y + 1, RW.w - 2, RW.h - 2, 10);
    ctx.stroke();
    ctx.save();
    roundRectPath(RW.x, RW.y, RW.w, RW.h, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(RW.x + 8, RW.y + 16);
    ctx.lineTo(RW.x + 44, RW.y + 4);
    ctx.lineTo(RW.x + 48, RW.y + 16);
    ctx.lineTo(RW.x + 12, RW.y + 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(RW.x + 96, RW.y + 4);
    ctx.lineTo(RW.x + 58, RW.y + RW.h - 4);
    ctx.stroke();
    ctx.restore();

    // window latch on the frame
    ctx.fillStyle = '#7d858f';
    roundRectPath(RW.x + RW.w / 2 - 8, RW.y + RW.h - 3, 16, 6, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRectPath(RW.x + RW.w / 2 - 7.5, RW.y + RW.h - 2.5, 15, 5, 2);
    ctx.stroke();
  }

  // --- CMYK ink cartridge bay ---
  function drawInkBay() {
    const cw = 26, gap = 4, cH = 78;
    const cBase = IB.y + IB.h - 2;
    const startX = IB.x + (IB.w - (INKS.length * cw + (INKS.length - 1) * gap)) / 2;

    const g = ctx.createLinearGradient(0, IB.y, 0, IB.y + IB.h);
    g.addColorStop(0, '#171c22');
    g.addColorStop(1, '#0c1014');
    ctx.fillStyle = g;
    roundRectPath(IB.x, IB.y, IB.w, IB.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    roundRectPath(IB.x + 0.75, IB.y + 0.75, IB.w - 1.5, IB.h - 1.5, 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    roundRectPath(IB.x + 1.5, IB.y + 1.5, IB.w - 3, IB.h - 3, 11);
    ctx.stroke();

    for (let i = 0; i < INKS.length; i++) {
      const ink = INKS[i];
      const cx = startX + i * (cw + gap);
      const top = cBase - cH;

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx + cw / 2, cBase + 1, cw * 0.55, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ink.ink;
      roundRectPath(cx, top, cw, 6, 2.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRectPath(cx, top, cw, 2, 1);
      ctx.fill();
      // cap grip ridges
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(cx + 2, top + 2, cw - 4, 1);
      ctx.fillRect(cx + 2, top + 4, cw - 4, 1);

      const bg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
      bg.addColorStop(0, '#f2f4f7');
      bg.addColorStop(1, '#dde1e7');
      ctx.fillStyle = bg;
      roundRectPath(cx, top + 5, cw, cH - 5, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      roundRectPath(cx + 0.5, top + 5.5, cw - 1, cH - 6, 4);
      ctx.stroke();

      const wx = cx + 4, wy = top + 12, ww = 10, wh = 22;
      ctx.fillStyle = '#0c1116';
      roundRectPath(wx, wy, ww, wh, 2);
      ctx.fill();
      ctx.fillStyle = ink.ink;
      roundRectPath(wx + 1, wy + wh - 14, ww - 2, 13, 1.5);
      ctx.fill();
      // level tick marks on the window
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx, wy + 6); ctx.lineTo(wx + ww, wy + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, wy + 12); ctx.lineTo(wx + ww, wy + 12); ctx.stroke();

      // gold chip contacts at the base
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(cx + 5, cBase - 4, 4, 2);
      ctx.fillRect(cx + 12, cBase - 4, 4, 2);
      ctx.fillRect(cx + 19, cBase - 4, 4, 2);

      led(cx + cw / 2, cBase - 3, 2, ink.led);
    }
  }

  // --- paper output slot with visible mechanical rollers ---
  function drawRoller(x, y, w, h, t) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#70767e');
    g.addColorStop(0.5, '#454a51');
    g.addColorStop(1, '#2a2e33');
    ctx.fillStyle = g;
    roundRectPath(x, y, w, h, h / 2);
    ctx.fill();
    const hx = ((t * 30) % Math.max(w - 16, 1)) + 7;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRectPath(x + hx, y + 0.8, 8, h - 1.6, (h - 1.6) / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(x + 1, y + 1, 2, h - 2, 1);
    ctx.fill();
    roundRectPath(x + w - 3, y + 1, 2, h - 2, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRectPath(x, y, w, 1.2, 0.6);
    ctx.fill();
  }

  function drawSlot() {
    const t = time;
    const sg = ctx.createLinearGradient(0, SLOT.y, 0, SLOT.y + SLOT.h);
    sg.addColorStop(0, '#151a21');
    sg.addColorStop(1, '#0a0d11');
    ctx.fillStyle = sg;
    roundRectPath(SLOT.x, SLOT.y, SLOT.w, SLOT.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    roundRectPath(SLOT.x + 0.5, SLOT.y + 0.5, SLOT.w - 1, SLOT.h - 1, 8);
    ctx.stroke();

    drawRoller(SLOT.x + 5, SLOT.y + 1.5, SLOT.w - 10, 5, t);
    drawRoller(SLOT.x + 5, SLOT.y + SLOT.h - 6.5, SLOT.w - 10, 5, t + 1.4);
  }

  function drawSheet(x, y, w, h, rot, wobble, pat) {
    ctx.save();
    ctx.translate(x + w / 2 + (wobble || 0), y);
    if (rot) ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#f2f4f7');
    ctx.fillStyle = g;
    roundRectPath(-w / 2, 0, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    roundRectPath(-w / 2, 0, w, h, 3);
    ctx.stroke();

    if (h > 40) {
      const shift = pat || 0;
      const py = h - 32;
      const bandW = (w - 24) / 4;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = PAPER_COLORS[(shift + i) % PAPER_COLORS.length];
        roundRectPath(-w / 2 + 12 + i * bandW, py, bandW - 3, 7, 2);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = PAPER_COLORS[(shift + i + 2) % PAPER_COLORS.length];
        ctx.beginPath();
        ctx.arc(-w / 2 + 20 + i * bandW, py + 15, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- output catch tray + pile ---
  function drawOutputTray() {
    // dark mouth above the tray
    ctx.fillStyle = 'rgba(20,24,30,0.35)';
    roundRectPath(TRAY_OUT.x, TRAY_OUT.y - 6, TRAY_OUT.w, 8, 3);
    ctx.fill();
    // tray ledge
    const tg = ctx.createLinearGradient(0, TRAY_OUT.y, 0, TRAY_OUT.y + TRAY_OUT.h);
    tg.addColorStop(0, '#eef1f5');
    tg.addColorStop(1, '#d6dbe2');
    ctx.fillStyle = tg;
    roundRectPath(TRAY_OUT.x, TRAY_OUT.y, TRAY_OUT.w, TRAY_OUT.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    roundRectPath(TRAY_OUT.x + 0.5, TRAY_OUT.y + 0.5, TRAY_OUT.w - 1, TRAY_OUT.h - 1, 6);
    ctx.stroke();
    // backstop band
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    roundRectPath(TRAY_OUT.x + 2, TRAY_OUT.y, TRAY_OUT.w - 4, 4, 2);
    ctx.fill();
    // ribbed floor
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
      const rx = TRAY_OUT.x + 12 + i * (TRAY_OUT.w - 24) / 10;
      ctx.beginPath();
      ctx.moveTo(rx, TRAY_OUT.y + 5);
      ctx.lineTo(rx, TRAY_OUT.y + TRAY_OUT.h - 3);
      ctx.stroke();
    }
    // side walls
    ctx.fillStyle = '#c3c9d2';
    roundRectPath(TRAY_OUT.x - 5, TRAY_OUT.y - 2, 8, TRAY_OUT.h + 4, 2);
    ctx.fill();
    roundRectPath(TRAY_OUT.x + TRAY_OUT.w - 3, TRAY_OUT.y - 2, 8, TRAY_OUT.h + 4, 2);
    ctx.fill();
    // front lip highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TRAY_OUT.x + 4, TRAY_OUT.y + TRAY_OUT.h - 2.5);
    ctx.lineTo(TRAY_OUT.x + TRAY_OUT.w - 4, TRAY_OUT.y + TRAY_OUT.h - 2.5);
    ctx.stroke();
  }

  function drawPile() {
    drawOutputTray();
    // a couple of resting sheets always visible in the tray
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(TRAY_OUT.x + 26, PILE_BASE + 2, TRAY_OUT.w - 52, 3);
    ctx.fillStyle = PAPER_COLORS[3];
    ctx.fillRect(TRAY_OUT.x + 26, PILE_BASE + 2, 5, 3);
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(TRAY_OUT.x + 30, PILE_BASE + 5, TRAY_OUT.w - 60, 3);
    ctx.fillStyle = PAPER_COLORS[0];
    ctx.fillRect(TRAY_OUT.x + 30, PILE_BASE + 5, 5, 3);
    if (pileCount === 0) return;
    ctx.fillStyle = 'rgba(28,32,38,0.12)';
    roundRectPath(TRAY_OUT.x + 16, PILE_BASE - pileCount * 3 - 2, TRAY_OUT.w - 32, pileCount * 3 + 6, 6);
    ctx.fill();
    for (let i = 0; i < pileCount; i++) {
      const y = PILE_BASE - i * 3;
      const x = TRAY_OUT.x + 22 + Math.sin(i * 1.7) * 3;
      ctx.fillStyle = i % 2 ? '#f4f6f8' : '#ffffff';
      ctx.fillRect(x, y, TRAY_OUT.w - 44, 3);
      ctx.fillStyle = PAPER_COLORS[i % PAPER_COLORS.length];
      ctx.fillRect(x, y, 5, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TRAY_OUT.w - 45, 2);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawMachine();

    // papers emerging from the slot (behind the rollers, subtle sway)
    for (const p of papers) {
      if (p.state === 'out') {
        drawSheet(p.x - PAPER_W / 2, SLOT.y + SLOT.h, PAPER_W, 8 + PAPER_MAX * p.prog, 0,
                  Math.sin(time * 9) * 0.6, p.pat);
      }
    }

    drawSlot();

    // falling papers (drift into the output tray)
    for (const p of papers) {
      if (p.state === 'fall') {
        drawSheet(p.x - PAPER_W / 2, p.y, PAPER_W, PAPER_MAX, p.rot,
                  Math.sin(time * 9 + p.y * 0.05) * 0.4, p.pat);
      }
    }

    drawPile();

    for (const b of bits) {
      ctx.globalAlpha = Math.max(b.life / 42, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  // --- buy an upgrade ---
  function buy(kind) {
    if (kind === 'click') {
      const c = costClick(headLv);
      if (money < c) return;
      money -= c;
      headLv += 1;
    } else {
      const c = costAuto(feedLv);
      if (money < c) return;
      money -= c;
      feedLv += 1;
    }
    sfx('buy');
    updateUI();
    save();
  }

  // --- auto-feed tick ---
  function tick() {
    if (feedLv > 0) printSheets(feedLv, true);
  }

  // --- UI ---
  function updateUI() {
    moneyEl.textContent = fmt(money);
    perClickEl.textContent = fmt(perClick()).replace('$', '');
    perSecEl.textContent = fmt(perSec()).replace('$', '');

    const c = costClick(headLv);
    const a = costAuto(feedLv);
    costClickEl.textContent = fmt(c);
    costAutoEl.textContent = fmt(a);
    lvlClickEl.textContent = 'Lv ' + headLv;
    lvlAutoEl.textContent = 'Lv ' + feedLv;
    descClickEl.textContent = '+' + fmt(perClick()) + ' per click';
    descAutoEl.textContent = '+' + fmt(perSec()) + ' every second';

    buyClickBtn.disabled = money < c;
    buyAutoBtn.disabled = money < a;
  }

  // --- events ---
  function onAnyClick(el, fn) {
    let last = 0;
    const run = (e) => {
      if (e.button === 2 || e.button === 1) return;
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      fn(e);
    };
    el.addEventListener('pointerdown', run);
    el.addEventListener('mousedown', run);
    el.addEventListener('click', run);
  }

  canvas.addEventListener('pointerdown', pressButton);
  canvas.addEventListener('mousedown', pressButton);
  canvas.addEventListener('click', pressButton);

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.code === 'Space') {
      e.preventDefault();
      printSheets(perClick(), false);
    }
  });

  onAnyClick(muteBtn, () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });
  onAnyClick(buyClickBtn, () => buy('click'));
  onAnyClick(buyAutoBtn, () => buy('auto'));
  onAnyClick(resetBtn, () => {
    if (window.confirm('Reset all Viprint Press progress?')) {
      money = 0;
      headLv = 0;
      feedLv = 0;
      papers = [];
      bits = [];
      pileCount = 0;
      save();
      updateUI();
    }
  });

  window.addEventListener('beforeunload', save);

  // pause rendering when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = null;
    } else if (!document.hidden && !raf) {
      loop();
    }
  });

  // --- init ---
  load();
  updateUI();
  loop();
  setInterval(tick, 1000);
})();
