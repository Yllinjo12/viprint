/* ============================================================
   Viprint Press X9 — high-end industrial printing machine
   Press the big glowing button to print sheets and earn money.
   Upgrades: new print head (more per click) and auto-feed
   roller (prints every second).
   The machine is drawn live on canvas: dark gray & white metal
   body, top paper tray with feed rollers, paper roll window,
   CMYK ink cartridges, mechanical output rollers, glowing cyan
   lights, and the big industrial button. No text on the art.
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

  // --- machine geometry (X9: larger, high-end) ---
  const MX = 12, MY = 6, MW = 436, MH = 330;            // body
  const SLOT = { x: 186, y: 150, w: 88, h: 16 };        // paper output
  const PAPER_W = 84, PAPER_MAX = 100;
  const RW = { x: 44, y: 116, w: 140, h: 92 };          // paper roll window
  const ROLL = { cx: 114, cy: 162, R: 44 };
  const IB = { x: 300, y: 124, w: 132, h: 88 };         // ink bay
  const TRAY = { x: 44, y: 30, w: 156, h: 34 };         // top input tray
  // --- big industrial button ---
  const BTN = { cx: 230, cy: 312, mountR: 84, bezelR: 72, ringR: 62, capR: 52 };
  const TRAY_OUT = { x: 54, y: 338, w: 126, h: 20 };    // output tray
  const PILE_BASE = 350;
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
  let ripples = [];  // expanding press rings
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
    ripples.push({ r: BTN.ringR, a: 0.85 });

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
        x: 62 + Math.random() * 108,
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
        if (p.y > H + 40) {
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

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 4.5;
      rp.a -= 0.04;
      if (rp.a <= 0) ripples.splice(i, 1);
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

  function led(x, y, r, color, bright) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + 8 * bright;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    // feed mouth + two vertical rollers
    ctx.fillStyle = '#0d1115';
    roundRectPath(TRAY.x + TRAY.w - 26, TRAY.y + 5, 20, TRAY.h - 10, 4);
    ctx.fill();
    drawVRoller(TRAY.x + TRAY.w - 24, TRAY.y + 7, 6, TRAY.h - 14, t);
    drawVRoller(TRAY.x + TRAY.w - 14, TRAY.y + 7, 6, TRAY.h - 14, t + 1.3);

    // cyan LED strip under the tray
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(34,211,238,' + (0.4 + 0.15 * Math.sin(t * 2.2)).toFixed(3) + ')';
    roundRectPath(TRAY.x + 4, TRAY.y + TRAY.h + 2, TRAY.w - 8, 3, 1.5);
    ctx.fill();
    ctx.restore();
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

  // --- the machine (X9 body) ---
  function drawMachine() {
    const t = time;

    // soft drop shadow
    ctx.fillStyle = 'rgba(28,32,38,0.16)';
    ctx.beginPath();
    ctx.ellipse(MX + MW / 2, MY + MH + 10, MW * 0.46, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // white central body
    const g = ctx.createLinearGradient(0, MY, 0, MY + MH);
    g.addColorStop(0, '#fafbfd');
    g.addColorStop(0.65, '#eef1f5');
    g.addColorStop(1, '#e2e6ec');
    ctx.fillStyle = g;
    roundRectPath(MX, MY, MW, MH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1.5;
    roundRectPath(MX + 0.75, MY + 0.75, MW - 1.5, MH - 1.5, 24);
    ctx.stroke();

    // dark gray frame: top rail, side pillars, base band (clipped to body)
    ctx.save();
    roundRectPath(MX, MY, MW, MH, 24);
    ctx.clip();
    ctx.fillStyle = '#2c3036';
    ctx.fillRect(MX, MY, MW, 24);            // top rail
    ctx.fillRect(MX, MY, 24, MH);            // left pillar
    ctx.fillRect(MX + MW - 24, MY, 24, MH);  // right pillar
    ctx.fillRect(MX, MY + MH - 62, MW, 62);  // base band
    ctx.restore();

    // rail highlights
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MX + 6, MY + 2);
    ctx.lineTo(MX + MW - 6, MY + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MX + 2, MY + 6);
    ctx.lineTo(MX + 2, MY + MH - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MX + MW - 2, MY + 6);
    ctx.lineTo(MX + MW - 2, MY + MH - 6);
    ctx.stroke();

    // divider between top and middle sections
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.moveTo(MX + 26, 112);
    ctx.lineTo(MX + MW - 26, 112);
    ctx.stroke();

    // corner LEDs on the dark rail
    led(MX + 34, MY + 14, 3, '#3b82f6', 0.55 + 0.45 * Math.sin(t * 2.8));
    led(MX + MW - 34, MY + 14, 3, '#22d3ee', 0.55 + 0.45 * Math.sin(t * 2.8 + 1.6));

    // status strip (center-top) — cyan, brightens while printing
    const stripA = Math.min(0.16 + 0.12 * Math.sin(t * 2.2) + 0.55 * flash, 0.9);
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(34,211,238,' + stripA.toFixed(3) + ')';
    roundRectPath(215, 27, 80, 9, 4.5);
    ctx.fill();
    ctx.restore();

    // top input tray
    drawTopTray();

    // control panel (top-right)
    const px = 310, py = 28, pw = 122, ph = 92;
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, '#d9dde3');
    pg.addColorStop(1, '#c8cdd5');
    ctx.fillStyle = pg;
    roundRectPath(px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    roundRectPath(px + 0.5, py + 0.5, pw - 1, ph - 1, 12);
    ctx.stroke();

    const sx = px + 12, sy = py + 10, sw = 98, sh = 36;
    ctx.fillStyle = '#0c1116';
    roundRectPath(sx, sy, sw, sh, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.25)';
    ctx.lineWidth = 1;
    roundRectPath(sx + 0.5, sy + 0.5, sw - 1, sh - 1, 7);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const bh = 6 + 15 * Math.abs(Math.sin(t * 2 + i * 0.9));
      const bx = sx + 7 + i * 14;
      ctx.save();
      ctx.shadowColor = '#19e3ff';
      ctx.shadowBlur = 7;
      ctx.fillStyle = '#19e3ff';
      ctx.fillRect(bx, sy + sh - 7 - bh, 8, bh);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(34,211,238,0.35)';
    ctx.fillRect(sx + 6, sy + sh - 6, sw - 12, 1.5);

    led(sx + 8, sy + sh + 14, 3, '#3b82f6', 0.5 + 0.5 * Math.sin(t * 3));
    led(sx + 36, sy + sh + 14, 3, '#22d3ee', 0.5 + 0.5 * Math.sin(t * 3 + 2));
    led(sx + 64, sy + sh + 14, 3, '#34d399', 0.5 + 0.5 * Math.sin(t * 3 + 4));

    ctx.fillStyle = '#262a30';
    ctx.beginPath();
    ctx.arc(sx + 20, sy + sh + 32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx + 20, sy + sh + 32, 9, 0, Math.PI * 2);
    ctx.stroke();
    led(sx + 20, sy + sh + 32, 2.5, '#22d3ee', 0.4 + 0.3 * Math.sin(t * 4));

    ctx.fillStyle = '#262a30';
    ctx.beginPath();
    ctx.arc(sx + 50, sy + sh + 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,130,246,0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + 50, sy + sh + 32, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(sx + 50, sy + sh + 32, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#262a30';
    roundRectPath(sx + 68, sy + sh + 24, 20, 15, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
    ctx.lineWidth = 1.5;
    roundRectPath(sx + 68, sy + sh + 24, 20, 15, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRectPath(sx + 68, sy + sh + 25, 20, 5, 3);
    ctx.fill();

    // paper roll window (middle-left)
    drawRollCompartment();

    // ink cartridge bay (middle-right)
    drawInkBay();

    // vents (lower-left)
    for (let i = 0; i < 4; i++) {
      const vx = 44, vy = 228 + i * 10;
      ctx.fillStyle = 'rgba(28,32,38,0.10)';
      roundRectPath(vx, vy, 96, 6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(28,32,38,0.15)';
      roundRectPath(vx, vy + 3, 96, 2, 1);
      ctx.fill();
    }

    // status cluster (lower-right)
    ctx.fillStyle = '#d5d9df';
    roundRectPath(330, 226, 96, 30, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    roundRectPath(330.5, 226.5, 95, 29, 6);
    ctx.stroke();
    led(344, 241, 3, '#3b82f6', 0.5 + 0.5 * Math.sin(t * 3));
    led(364, 241, 3, '#22d3ee', 0.5 + 0.5 * Math.sin(t * 3 + 2));
    led(384, 241, 3, '#34d399', 0.5 + 0.5 * Math.sin(t * 3 + 4));
    ctx.fillStyle = '#262a30';
    roundRectPath(398, 234, 18, 14, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 1;
    roundRectPath(398, 234, 18, 14, 3);
    ctx.stroke();

    // base band details (power button, brand plate, screws)
    const by = MY + MH - 62;
    const powY = by + 28;
    ctx.fillStyle = '#14171a';
    ctx.beginPath();
    ctx.arc(MX + 56, powY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,' + (0.5 + 0.4 * Math.sin(t * 2.5)).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(MX + 56, powY, 9, 0, Math.PI * 2);
    ctx.stroke();
    led(MX + 56, powY, 2.3, '#22d3ee', 0.6);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRectPath(MX + MW - 126, by + 16, 84, 24, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    roundRectPath(MX + MW - 126.5, by + 16.5, 83, 23, 6);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const screws = [
      [MX + 20, by + 10], [MX + MW - 20, by + 10],
      [MX + 20, by + 50], [MX + MW - 20, by + 50]
    ];
    for (const [ssx, ssy] of screws) {
      ctx.beginPath();
      ctx.arc(ssx, ssy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // feet
    ctx.fillStyle = '#1c1e22';
    roundRectPath(40, MY + MH, 28, 8, 2);
    ctx.fill();
    roundRectPath(MX + MW - 68, MY + MH, 28, 8, 2);
    ctx.fill();
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

    // cyan accent lights
    led(RW.x + 6, RW.y + 8, 2.5, '#22d3ee', 0.5 + 0.4 * Math.sin(t * 2.2));
    led(RW.x + RW.w - 6, RW.y + 8, 2.5, '#3b82f6', 0.5 + 0.4 * Math.sin(t * 2.2 + 1.4));
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(34,211,238,' + (0.35 + 0.15 * Math.sin(t * 2.2)).toFixed(3) + ')';
    roundRectPath(RW.x + 8, RW.y + RW.h - 8, RW.w - 16, 3, 1.5);
    ctx.fill();
    ctx.restore();

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
    ctx.restore();
  }

  // --- CMYK ink cartridge bay ---
  function drawInkBay() {
    const t = time;
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

      led(cx + cw / 2, cBase - 3, 2, ink.led, 0.5 + 0.4 * Math.sin(t * 3 + i * 1.2));
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

    if (flash > 0) {
      ctx.save();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(34,211,238,' + (0.7 * flash).toFixed(3) + ')';
      ctx.lineWidth = 2.5;
      roundRectPath(SLOT.x - 2, SLOT.y - 2, SLOT.w + 4, SLOT.h + 4, 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- the big industrial button ---
  function drawButton() {
    const t = time;
    const { cx, cy, mountR, bezelR, ringR, capR } = BTN;
    const press = pressT;
    const capY = cy + press * 5;
    const ringA = Math.min(0.55 + 0.30 * Math.sin(t * 2.4) + 0.6 * press, 1);

    const mg = ctx.createRadialGradient(cx - 25, cy - 28, 10, cx, cy, mountR);
    mg.addColorStop(0, '#4a4e55');
    mg.addColorStop(0.75, '#2c2f34');
    mg.addColorStop(1, '#1d2024');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(cx, cy, mountR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, mountR - 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, mountR - 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, mountR - 1.5, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();

    ctx.fillStyle = '#111419';
    ctx.beginPath();
    ctx.arc(cx, cy, bezelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, bezelR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14 + 22 * press;
    ctx.strokeStyle = 'rgba(34,211,238,' + ringA.toFixed(3) + ')';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(190,245,255,' + (0.5 + 0.4 * press).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR - 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, capY);
    const cg = ctx.createLinearGradient(-capR, -capR, capR, capR);
    cg.addColorStop(0, '#767c84');
    cg.addColorStop(0.45, '#45494f');
    cg.addColorStop(1, '#24272c');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, capR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, capR - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, capR - 2, 0, Math.PI * 2);
    ctx.clip();
    const sg2 = ctx.createLinearGradient(-capR, -capR, capR, capR);
    sg2.addColorStop(0, 'rgba(255,255,255,0.30)');
    sg2.addColorStop(0.35, 'rgba(255,255,255,0.05)');
    sg2.addColorStop(0.62, 'rgba(0,0,0,0.05)');
    sg2.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = sg2;
    ctx.fillRect(-capR, -capR, capR * 2, capR * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, capR - 5, Math.PI * 1.05, Math.PI * 1.7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, capR - 6, Math.PI * -0.15, Math.PI * 0.45);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, capR * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(0, 0, capR * 0.74 + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const rx = Math.cos(a) * capR * 0.8;
      const ry = Math.sin(a) * capR * 0.8;
      ctx.beginPath();
      ctx.arc(rx, ry, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRectPath(-9, -3, 18, 6, 3); ctx.fill();
    roundRectPath(-3, -9, 6, 18, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectPath(-9, -4, 18, 2, 1); ctx.fill();
    roundRectPath(-4, -9, 2, 18, 1); ctx.fill();
    ctx.restore();

    for (const rp of ripples) {
      ctx.strokeStyle = 'rgba(34,211,238,' + rp.a.toFixed(3) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rp.r, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  // --- output tray + pile ---
  function drawOutputTray() {
    ctx.fillStyle = '#e6e9ee';
    roundRectPath(TRAY_OUT.x, TRAY_OUT.y, TRAY_OUT.w, TRAY_OUT.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(TRAY_OUT.x + 0.5, TRAY_OUT.y + 0.5, TRAY_OUT.w - 1, TRAY_OUT.h - 1, 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    roundRectPath(TRAY_OUT.x, TRAY_OUT.y, TRAY_OUT.w, 5, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    roundRectPath(TRAY_OUT.x, TRAY_OUT.y + TRAY_OUT.h - 2, TRAY_OUT.w, 2, 1);
    ctx.stroke();
  }

  function drawPile() {
    drawOutputTray();
    if (pileCount === 0) return;
    ctx.fillStyle = 'rgba(28,32,38,0.10)';
    roundRectPath(58, PILE_BASE - pileCount * 3 - 2, 116, pileCount * 3 + 6, 6);
    ctx.fill();
    for (let i = 0; i < pileCount; i++) {
      const y = PILE_BASE - i * 3;
      const x = 62 + Math.sin(i * 1.7) * 3;
      ctx.fillStyle = i % 2 ? '#f4f6f8' : '#ffffff';
      ctx.fillRect(x, y, 108, 3);
      ctx.fillStyle = PAPER_COLORS[i % PAPER_COLORS.length];
      ctx.fillRect(x, y, 5, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 107, 2);
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

    drawButton();

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
      ripples = [];
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

  // marker so the game's live status is visible in the page title
  document.title = 'Viprint Press — Quality Printing Solutions';
})();
