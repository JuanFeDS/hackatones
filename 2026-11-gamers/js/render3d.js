(function () {
  'use strict';

  const G = (window.G = window.G || {});
  const TAU = Math.PI * 2;
  const FONT_SERIF = '"Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif';
  const FONT_UI = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const FONT_GLYPH = '"Times New Roman", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
  const PIECE_NAME = { pawn: 'PEÓN', knight: 'CABALLO', bishop: 'ALFIL', rook: 'TORRE', queen: 'DAMA', king: 'REY' };
  const WRAITH_COLOR = '#B49CFF';
  const FOV = (80 * Math.PI) / 180;
  const TAN_HALF = Math.tan(FOV / 2);
  const MAX_DIST = 11;
  const MAP_RADIUS = 7.5;

  let canvas = null;
  let ctx = null;
  let listening = false;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let colW = 2;
  let zbuf = new Float32Array(0);
  let camX = 0;
  let camY = 0;
  let yaw = 0;
  let camReady = false;
  let lastNow = 0;
  let curMaze = null;
  let flick = 1;
  let frameId = 0;
  let bannerEnd = 0;
  let hurtAt = -1e9;
  let moveAt = -1e9;
  let aimX = 0;
  let aimY = 0;
  const visEnemies = new Map();
  const banners = [];
  const noisePatterns = [];
  const TILE_SIZE = 32;
  const TILE_VARIANTS = 16;
  const FLOOR_FAR = 16;
  let tileTex = [[], []];
  let floorCanvas = null;
  let floorCtx = null;
  let floorImage = null;
  let floorBuf = null;
  let floorGauss = null;
  let floorScale = 3;
  let floorW = 0;
  let floorH = 0;
  const rgbCache = {};

  function clamp(value, lo, hi) {
    return value < lo ? lo : value > hi ? hi : value;
  }

  function sstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function rgbOf(hexColor) {
    let rgb = rgbCache[hexColor];
    if (!rgb) {
      const n = parseInt(hexColor.slice(1), 16);
      rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache[hexColor] = rgb;
    }
    return rgb;
  }

  function rgba(hexColor, alpha) {
    const rgb = rgbOf(hexColor);
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
  }

  function colors() {
    return G.CFG.colors;
  }

  function setSpacing(px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  }

  function hash(x, y, z) {
    return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z | 0, 83492791)) >>> 0;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.style.display = 'block';
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    colW = Math.max(2, Math.round(cssW / 640));
    zbuf = new Float32Array(Math.ceil(cssW / colW));
    floorScale = cssW > 900 ? 3 : 2;
    floorW = Math.ceil(cssW / floorScale);
    floorH = Math.ceil(cssH / floorScale);
    floorCanvas = document.createElement('canvas');
    floorCanvas.width = floorW;
    floorCanvas.height = floorH;
    floorCtx = floorCanvas.getContext('2d');
    floorImage = floorCtx.createImageData(floorW, floorH);
    floorBuf = new Uint32Array(floorImage.data.buffer);
    floorGauss = new Float32Array(floorW);
    for (let col = 0; col < floorW; col++) floorGauss[col] = Math.exp(-Math.pow((col / floorW - 0.5) / 0.17, 2));
  }

  function seeded(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgbStr(color, k) {
    const m = k === undefined ? 1 : k;
    return 'rgb(' + (clamp(color[0] * m, 0, 255) | 0) + ',' + (clamp(color[1] * m, 0, 255) | 0) + ',' + (clamp(color[2] * m, 0, 255) | 0) + ')';
  }

  function rgbaStr(color, alpha) {
    return 'rgba(' + (clamp(color[0], 0, 255) | 0) + ',' + (clamp(color[1], 0, 255) | 0) + ',' + (clamp(color[2], 0, 255) | 0) + ',' + alpha + ')';
  }

  function mulRgb(hexColor, k) {
    const c = rgbOf(hexColor);
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function makeCanvas(w, h) {
    const element = document.createElement('canvas');
    element.width = w;
    element.height = h;
    return element;
  }

  function seedOf(text) {
    let h = 7;
    for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  function walkLine(g, rand, x, y, ang, steps, stepLen, wobble) {
    g.beginPath();
    g.moveTo(x, y);
    for (let n = 0; n < steps; n++) {
      ang += (rand() - 0.5) * wobble;
      x += Math.cos(ang) * stepLen;
      y += Math.sin(ang) * stepLen;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  let scratchG = null;

  function scratchCtx() {
    if (!scratchG) scratchG = makeCanvas(TILE_SIZE, TILE_SIZE).getContext('2d', { willReadFrequently: true });
    return scratchG;
  }

  function texToCanvas(g, tex) {
    const image = g.createImageData(TILE_SIZE, TILE_SIZE);
    for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
      image.data[i * 4] = tex[i * 3];
      image.data[i * 4 + 1] = tex[i * 3 + 1];
      image.data[i * 4 + 2] = tex[i * 3 + 2];
      image.data[i * 4 + 3] = 255;
    }
    g.putImageData(image, 0, 0);
  }

  function canvasToTex(g) {
    const data = g.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
    const tex = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
    for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
      tex[i * 3] = data[i * 4];
      tex[i * 3 + 1] = data[i * 4 + 1];
      tex[i * 3 + 2] = data[i * 4 + 2];
    }
    return tex;
  }

  function pixelTile(base, parity, variant, saltExtra) {
    const size = TILE_SIZE;
    const rand = seeded(parity * 1000 + variant * 7919 + 13 + saltExtra);
    const tex = new Uint8Array(size * size * 3);
    const tone = 0.84 + rand() * 0.34;
    const hue = (rand() - 0.5) * 0.12;
    const veinAngle = rand() * TAU;
    const veinFreq = 0.16 + rand() * 0.18;
    const veinPhase = rand() * TAU;
    const veinAmp = 0.05 + rand() * 0.09;
    const stains = [];
    const stainCount = rand() < 0.55 ? 1 + ((rand() * 2) | 0) : 0;
    for (let k = 0; k < stainCount; k++) stains.push({ x: rand() * size, y: rand() * size, r: 5 + rand() * 9 });
    const mask = new Float32Array(size * size);
    if (rand() < 0.4) {
      let cx = rand() * size;
      let cy = rand() * size;
      let ang = rand() * TAU;
      const len = 10 + ((rand() * 18) | 0);
      for (let n = 0; n < len; n++) {
        mask[((cy | 0) & (size - 1)) * size + ((cx | 0) & (size - 1))] = 1;
        ang += (rand() - 0.5) * 1.1;
        cx += Math.cos(ang);
        cy += Math.sin(ang);
        if (cx < 1 || cy < 1 || cx > size - 2 || cy > size - 2) break;
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let gain = tone;
        const wave = Math.sin((x * Math.cos(veinAngle) + y * Math.sin(veinAngle)) * veinFreq * TAU + veinPhase + Math.sin(y * 0.35 + variant) * 1.3);
        gain += Math.pow(Math.max(0, wave), 14) * veinAmp * 3;
        gain += (rand() - 0.5) * 0.09;
        let damp = 0;
        for (let k = 0; k < stains.length; k++) {
          const dist = Math.hypot(x - stains[k].x, y - stains[k].y) / stains[k].r;
          if (dist < 1) damp = Math.max(damp, 1 - dist * dist);
        }
        gain *= 1 - damp * 0.38;
        if (mask[y * size + x]) gain *= 0.35;
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
        let joint = 1;
        if (edge === 0) joint = 0.12;
        else if (edge === 1) joint = 0.55;
        else if (edge === 2) joint = 1.12;
        const idx = (y * size + x) * 3;
        tex[idx] = clamp(base[0] * (gain + hue) * joint * (1 - damp * 0.1), 0, 255);
        tex[idx + 1] = clamp(base[1] * gain * joint * (1 + damp * 0.12), 0, 255);
        tex[idx + 2] = clamp(base[2] * (gain - hue) * joint * (1 + damp * 0.18), 0, 255);
      }
    }
    return tex;
  }

  function mossOverlay(g, rand) {
    const greens = [[34, 62, 26], [44, 78, 34], [26, 52, 30], [58, 92, 40]];
    const blobs = 1 + ((rand() * 3) | 0);
    for (let b = 0; b < blobs; b++) {
      const cx = rand() * TILE_SIZE;
      const cy = rand() * TILE_SIZE;
      const spread = 3 + rand() * 6;
      for (let m = 0; m < 16; m++) {
        g.fillStyle = rgbaStr(greens[(rand() * greens.length) | 0], 0.5 + rand() * 0.45);
        circle(g, cx + (rand() - 0.5) * spread * 2, cy + (rand() - 0.5) * spread * 2, 1 + rand() * 2.8);
      }
    }
    for (let n = 0; n < 14; n++) {
      g.fillStyle = rgbaStr(greens[(rand() * greens.length) | 0], 0.5);
      g.fillRect((rand() * TILE_SIZE) | 0, (rand() * TILE_SIZE) | 0, 1, 1);
    }
  }

  function dirtTile(g, base, rand) {
    const image = g.createImageData(TILE_SIZE, TILE_SIZE);
    const tone = 0.82 + rand() * 0.3;
    const blots = [];
    for (let k = 0; k < 3; k++) blots.push({ x: rand() * TILE_SIZE, y: rand() * TILE_SIZE, r: 5 + rand() * 9 });
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        let gain = tone + (rand() - 0.5) * 0.24;
        for (let k = 0; k < 3; k++) {
          const d = Math.hypot(x - blots[k].x, y - blots[k].y) / blots[k].r;
          if (d < 1) gain *= 1 - (1 - d * d) * 0.3;
        }
        const idx = (y * TILE_SIZE + x) * 4;
        image.data[idx] = clamp(base[0] * gain, 0, 255);
        image.data[idx + 1] = clamp(base[1] * gain, 0, 255);
        image.data[idx + 2] = clamp(base[2] * gain, 0, 255);
        image.data[idx + 3] = 255;
      }
    }
    g.putImageData(image, 0, 0);
  }

  function tileBones(g, rand) {
    const bone = [92, 84, 64];
    const count = rand() < 0.8 ? 1 + ((rand() * 2) | 0) : 0;
    for (let k = 0; k < count; k++) {
      const len = 9 + rand() * 7;
      g.save();
      g.translate(6 + rand() * 20, 6 + rand() * 20);
      g.rotate(rand() * Math.PI);
      g.lineCap = 'round';
      g.strokeStyle = rgbStr(bone, 0.35);
      g.lineWidth = 3.6;
      g.beginPath();
      g.moveTo(-len / 2, 1.2);
      g.lineTo(len / 2, 1.2);
      g.stroke();
      g.strokeStyle = rgbStr(bone, 0.95);
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(-len / 2, 0);
      g.lineTo(len / 2, 0);
      g.stroke();
      g.fillStyle = rgbStr(bone, 1);
      for (let e = -1; e <= 1; e += 2) {
        circle(g, (e * len) / 2, -1.4, 2);
        circle(g, (e * len) / 2, 1.4, 2);
      }
      g.restore();
    }
    if (rand() < 0.16) {
      const cx = 9 + rand() * 14;
      const cy = 9 + rand() * 14;
      g.fillStyle = rgbStr(bone, 1.05);
      circle(g, cx, cy, 4.6);
      g.fillStyle = 'rgba(8,5,3,0.95)';
      circle(g, cx - 1.7, cy - 0.4, 1.1);
      circle(g, cx + 1.7, cy - 0.4, 1.1);
      g.fillStyle = rgbStr(bone, 0.7);
      g.fillRect(cx - 2.4, cy + 3.2, 4.8, 2.4);
    }
    for (let n = 0; n < 5; n++) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      circle(g, rand() * TILE_SIZE, rand() * TILE_SIZE, 0.8 + rand() * 1.2);
    }
  }

  function parquetTile(g, base, parity, rand) {
    const planks = 4;
    const width = TILE_SIZE / planks;
    g.fillStyle = rgbStr(base, 0.28);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    for (let p = 0; p < planks; p++) {
      const tone = 0.72 + rand() * 0.5;
      const warmShift = (rand() - 0.5) * 0.18;
      g.fillStyle = rgbStr([base[0] * (1 + warmShift), base[1], base[2] * (1 - warmShift)], tone);
      const px = parity === 0 ? 0 : p * width + 0.5;
      const py = parity === 0 ? p * width + 0.5 : 0;
      const pw = parity === 0 ? TILE_SIZE : width - 1;
      const ph = parity === 0 ? width - 1 : TILE_SIZE;
      g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(255,225,170,0.1)';
      if (parity === 0) g.fillRect(px, py, pw, 1);
      else g.fillRect(px, py, 1, ph);
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 0.7;
      for (let line = 0; line < 3; line++) {
        const off = rand() * (width - 2) + 1;
        g.beginPath();
        if (parity === 0) {
          g.moveTo(0, p * width + off);
          g.lineTo(TILE_SIZE, p * width + off + (rand() - 0.5) * 1.5);
        } else {
          g.moveTo(p * width + off, 0);
          g.lineTo(p * width + off + (rand() - 0.5) * 1.5, TILE_SIZE);
        }
        g.stroke();
      }
      if (rand() < 0.25) {
        g.fillStyle = 'rgba(0,0,0,0.32)';
        if (parity === 0) g.fillRect(4 + rand() * 24, py, 1, ph);
        else g.fillRect(px, 4 + rand() * 24, pw, 1);
      }
    }
  }

  function marbleTile(g, parity, base, rand) {
    const color = parity ? [base[0] * 0.55, base[1] * 0.55, base[2] * 0.55] : [base[0] * 1.3, base[1] * 1.3, base[2] * 1.3];
    const grad = g.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE);
    grad.addColorStop(0, rgbStr(color, 1.12 + rand() * 0.1));
    grad.addColorStop(1, rgbStr(color, 0.86));
    g.fillStyle = grad;
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineWidth = 0.9;
    const veins = 1 + ((rand() * 3) | 0);
    for (let v = 0; v < veins; v++) {
      g.strokeStyle = parity ? 'rgba(70,68,86,0.5)' : 'rgba(130,130,160,0.34)';
      walkLine(g, rand, rand() * TILE_SIZE, rand() * TILE_SIZE, rand() * TAU, 12, 3, 1.4);
    }
    g.strokeStyle = 'rgb(78,62,22)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  function buildTile(theme, parity, variant) {
    const kind = theme.texture;
    const salt = seedOf(theme.id) & 0xfff;
    const rand = seeded(parity * 1000 + variant * 7919 + 13 + salt);
    const base = rgbOf(parity ? theme.floorLight : theme.floorDark);
    const g = scratchCtx();
    if (kind === 'bone') {
      dirtTile(g, base, rand);
      tileBones(g, rand);
      return canvasToTex(g);
    }
    if (kind === 'shelves') {
      parquetTile(g, base, parity, rand);
      return canvasToTex(g);
    }
    if (kind === 'marble') {
      marbleTile(g, parity, base, rand);
      return canvasToTex(g);
    }
    const tex = pixelTile(base, parity, variant, kind === 'moss' ? salt : 0);
    if (kind !== 'moss') return tex;
    texToCanvas(g, tex);
    mossOverlay(g, rand);
    return canvasToTex(g);
  }

  function buildTileSet(theme) {
    const set = [[], []];
    for (let parity = 0; parity < 2; parity++) {
      for (let variant = 0; variant < TILE_VARIANTS; variant++) set[parity].push(buildTile(theme, parity, variant));
    }
    return set;
  }

  const TEX_W = 128;
  const TEX_H = 204;

  function paintBrickWall(g, theme, rand) {
    const base = mulRgb(theme.wall, 2.7);
    g.fillStyle = rgbStr(base, 0.22);
    g.fillRect(0, 0, TEX_W, TEX_H);
    const rows = 6;
    const rowH = TEX_H / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < 3; k++) {
        const x = k * 64 - (r & 1) * 32;
        const y = r * rowH;
        g.fillStyle = rgbStr(base, 0.8 + rand() * 0.4);
        g.fillRect(x + 2, y + 2, 60, rowH - 4);
        g.fillStyle = 'rgba(190,175,255,0.12)';
        g.fillRect(x + 2, y + 2, 60, 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 2, y + rowH - 5, 60, 3);
        for (let n = 0; n < 10; n++) {
          g.fillStyle = 'rgba(0,0,0,0.14)';
          g.fillRect(x + 3 + rand() * 56, y + 3 + rand() * (rowH - 7), 1 + rand() * 2, 1);
        }
      }
    }
    g.strokeStyle = 'rgba(4,3,9,0.6)';
    g.lineWidth = 1;
    for (let c = 0; c < 3; c++) walkLine(g, rand, rand() * TEX_W, rand() * TEX_H, rand() * TAU, 14, 3, 1.6);
  }

  function paintMossWall(g, theme, rand) {
    const base = mulRgb(theme.wall, 2.7);
    g.fillStyle = rgbStr(base, 0.18);
    g.fillRect(0, 0, TEX_W, TEX_H);
    const joints = [0];
    let y = 0;
    while (y < TEX_H) {
      let rowH = 30 + rand() * 22;
      if (TEX_H - y < rowH + 20) rowH = TEX_H - y;
      let x = 0;
      while (x < TEX_W) {
        let blockW = 34 + rand() * 36;
        if (TEX_W - x < blockW + 22) blockW = TEX_W - x;
        g.fillStyle = rgbStr(base, 0.7 + rand() * 0.5);
        g.fillRect(x + 2, y + 2, blockW - 4, rowH - 4);
        g.fillStyle = 'rgba(160,230,220,0.07)';
        g.fillRect(x + 2, y + 2, blockW - 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x + 2, y + rowH - 6, blockW - 4, 4);
        x += blockW;
      }
      y += rowH;
      joints.push(y);
    }
    for (let n = 0; n < 260; n++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(180,240,230,0.08)';
      g.fillRect(rand() * TEX_W, rand() * TEX_H, 1 + rand() * 2, 1 + rand() * 2);
    }
    for (let n = 0; n < 9; n++) {
      const cx = rand() * TEX_W;
      const cy = rand() * TEX_H;
      const r = 14 + rand() * 26;
      const stain = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      stain.addColorStop(0, 'rgba(0,12,10,0.5)');
      stain.addColorStop(1, 'rgba(0,12,10,0)');
      g.fillStyle = stain;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const greens = [[47, 107, 52], [63, 138, 60], [82, 160, 72], [42, 90, 48]];
    for (let j = 0; j < joints.length; j++) {
      for (let x = 0; x < TEX_W; x += 3 + rand() * 4) {
        if (rand() > 0.62) continue;
        g.fillStyle = rgbaStr(greens[(rand() * greens.length) | 0], 0.55 + rand() * 0.4);
        circle(g, x, joints[j] + rand() * 4 - 1, 2 + rand() * 4.5);
      }
    }
    for (let n = 0; n < 10; n++) {
      const cx = rand() * TEX_W;
      const cy = TEX_H * (0.25 + rand() * 0.75);
      for (let m = 0; m < 12; m++) {
        g.fillStyle = rgbaStr(greens[(rand() * greens.length) | 0], 0.45 + rand() * 0.4);
        circle(g, cx + (rand() - 0.5) * 22, cy + (rand() - 0.5) * 16, 1.5 + rand() * 3.5);
      }
    }
    const wet = g.createLinearGradient(0, TEX_H * 0.6, 0, TEX_H);
    wet.addColorStop(0, 'rgba(30,90,50,0)');
    wet.addColorStop(1, 'rgba(30,90,50,0.32)');
    g.fillStyle = wet;
    g.fillRect(0, TEX_H * 0.6, TEX_W, TEX_H * 0.4);
    for (let n = 0; n < 20; n++) {
      const x = (rand() * TEX_W) | 0;
      const startY = joints[(rand() * joints.length) | 0] + 2;
      const len = 14 + rand() * 52;
      for (let yy = 0; yy < len; yy += 2) {
        g.fillStyle = rgbaStr([70, 150, 80], 0.75 * (1 - yy / len));
        g.fillRect(x, startY + yy, 1.5, 2);
      }
      g.fillStyle = 'rgba(180,255,220,0.7)';
      circle(g, x + 0.7, startY + len, 1.5);
    }
  }

  function boneSkull(g, cx, cy, s, bone, rand) {
    const tone = 0.85 + rand() * 0.2;
    g.save();
    g.translate(cx, cy);
    g.rotate((rand() - 0.5) * 0.35);
    const cran = g.createRadialGradient(-s * 0.3, -s * 0.55, s * 0.1, 0, -s * 0.25, s * 1.1);
    cran.addColorStop(0, rgbStr(bone, 1.15 * tone));
    cran.addColorStop(1, rgbStr(bone, 0.5 * tone));
    g.fillStyle = cran;
    g.beginPath();
    g.ellipse(0, -s * 0.25, s * 0.92, s * 0.85, 0, 0, TAU);
    g.fill();
    g.fillStyle = rgbStr(bone, 0.68 * tone);
    g.fillRect(-s * 0.5, s * 0.34, s, s * 0.5);
    g.fillStyle = 'rgba(20,12,6,0.7)';
    for (let i = -2; i <= 2; i++) g.fillRect(i * s * 0.2 - 0.5, s * 0.42, 1, s * 0.42);
    g.fillStyle = 'rgba(8,5,3,0.96)';
    g.beginPath();
    g.ellipse(-s * 0.38, -s * 0.15, s * 0.24, s * 0.29, 0, 0, TAU);
    g.ellipse(s * 0.38, -s * 0.15, s * 0.24, s * 0.29, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(0, s * 0.08);
    g.lineTo(-s * 0.1, s * 0.3);
    g.lineTo(s * 0.1, s * 0.3);
    g.fill();
    g.restore();
  }

  function boneFemur(g, cx, cy, len, bone, rand) {
    const tone = 0.85 + rand() * 0.2;
    g.save();
    g.translate(cx, cy);
    g.rotate((rand() - 0.5) * 0.12);
    g.lineCap = 'round';
    g.strokeStyle = rgbStr(bone, 0.4);
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-len / 2, 1.8);
    g.lineTo(len / 2, 1.8);
    g.stroke();
    g.strokeStyle = rgbStr(bone, 0.92 * tone);
    g.lineWidth = 5.5;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.strokeStyle = rgbStr(bone, 1.2 * tone);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-len / 2, -1.5);
    g.lineTo(len / 2, -1.5);
    g.stroke();
    g.fillStyle = rgbStr(bone, tone);
    for (let e = -1; e <= 1; e += 2) {
      circle(g, (e * len) / 2, -2.6, 3.4);
      circle(g, (e * len) / 2, 2.8, 3.4);
    }
    g.restore();
  }

  function boneRibs(g, cx, cy, bone, rand) {
    g.lineCap = 'round';
    g.strokeStyle = rgbStr(bone, 0.5);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx, cy - 15);
    g.lineTo(cx, cy + 15);
    g.stroke();
    g.fillStyle = rgbStr(bone, 0.95);
    for (let v = -2; v <= 2; v++) circle(g, cx, cy + v * 6, 2.8);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = -2; i <= 2; i++) {
        const y0 = cy + i * 6;
        const reach = 22 + rand() * 4 - Math.abs(i) * 2;
        g.strokeStyle = rgbStr(bone, 0.4);
        g.lineWidth = 3.4;
        g.beginPath();
        g.moveTo(cx, y0 + 1);
        g.bezierCurveTo(cx + side * reach * 0.6, y0 - 4, cx + side * reach, y0, cx + side * reach * 0.9, y0 + 7);
        g.stroke();
        g.strokeStyle = rgbStr(bone, 0.95);
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(cx, y0);
        g.bezierCurveTo(cx + side * reach * 0.6, y0 - 5, cx + side * reach, y0 - 1, cx + side * reach * 0.9, y0 + 6);
        g.stroke();
      }
    }
  }

  function paintBoneWall(g, theme, rand) {
    const base = mulRgb(theme.wall, 2.7);
    const bone = mulRgb(theme.wallEdge, 0.8);
    g.fillStyle = rgbStr(base, 0.2);
    g.fillRect(0, 0, TEX_W, TEX_H);
    const rows = 6;
    const rowH = TEX_H / rows;
    for (let r = 0; r < rows; r++) {
      const cy = r * rowH + rowH / 2;
      const kind = r % 3;
      if (kind === 0) {
        for (let k = 0; k < 2; k++) boneFemur(g, 32 + k * 64, cy - 8, 56, bone, rand);
        for (let k = 0; k < 3; k++) boneFemur(g, k * 64, cy + 9, 58, bone, rand);
      } else if (kind === 1) {
        const off = r === 4 ? 16 : 0;
        for (let k = 0; k < 5; k++) boneSkull(g, 16 + off + k * 32, cy + 1, 11, bone, rand);
      } else {
        for (let k = 0; k < 2; k++) boneRibs(g, 32 + k * 64, cy, bone, rand);
      }
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(0, r * rowH + rowH - 3, TEX_W, 3);
    }
    for (let n = 0; n < 120; n++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(240,225,180,0.07)';
      g.fillRect(rand() * TEX_W, rand() * TEX_H, 1 + rand() * 2, 1);
    }
  }

  function cobweb(g, x, y, dirX, dirY, size) {
    g.strokeStyle = 'rgba(235,232,225,0.4)';
    g.lineWidth = 0.7;
    const spokes = 6;
    for (let s = 0; s <= spokes; s++) {
      const ang = (s / spokes) * (Math.PI / 2);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dirX * Math.cos(ang) * size, y + dirY * Math.sin(ang) * size);
      g.stroke();
    }
    for (let ring = 1; ring <= 4; ring++) {
      const r = (size * ring) / 4;
      g.beginPath();
      for (let s = 0; s <= spokes; s++) {
        const ang = (s / spokes) * (Math.PI / 2);
        const px = x + dirX * Math.cos(ang) * r;
        const py = y + dirY * Math.sin(ang) * r;
        const sag = s > 0 ? r * 0.1 : 0;
        if (s === 0) g.moveTo(px, py);
        else g.quadraticCurveTo(px - dirX * sag * 0.6, py - dirY * sag * 0.6, px, py);
      }
      g.stroke();
    }
  }

  function paintShelvesWall(g, theme, rand) {
    const wood = mulRgb(theme.wall, 2.7);
    g.fillStyle = rgbStr(wood, 0.28);
    g.fillRect(0, 0, TEX_W, TEX_H);
    const palette = [[104, 44, 46], [48, 86, 64], [50, 62, 104], [112, 78, 42], [82, 48, 84], [124, 108, 62], [66, 64, 66], [92, 58, 30], [128, 70, 52]];
    const shelves = 4;
    const shelfH = TEX_H / shelves;
    for (let s = 0; s < shelves; s++) {
      const top = s * shelfH;
      const plankY = top + shelfH - 8;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, top, TEX_W, shelfH - 8);
      let x = 3;
      while (x < TEX_W - 3) {
        if (rand() < 0.07) {
          x += 3 + rand() * 6;
          continue;
        }
        const bw = Math.min(5 + rand() * 7, TEX_W - 3 - x);
        const bh = 26 + rand() * (shelfH - 8 - 28);
        const color = palette[(rand() * palette.length) | 0];
        const tone = 0.8 + rand() * 0.35;
        const by = plankY - bh;
        const lean = rand() < 0.08 ? (rand() - 0.5) * 0.25 : 0;
        g.save();
        g.translate(x + bw / 2, plankY);
        g.rotate(lean);
        g.translate(-bw / 2, -plankY);
        g.fillStyle = rgbStr(color, tone);
        g.fillRect(0, by, bw, bh);
        g.fillStyle = 'rgba(255,240,210,0.14)';
        g.fillRect(0, by, 1.2, bh);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(bw - 1.3, by, 1.3, bh);
        const gold = rand() < 0.5 ? 'rgba(214,178,90,0.85)' : 'rgba(180,170,150,0.6)';
        g.fillStyle = gold;
        g.fillRect(0, by + 3, bw, 1.4);
        g.fillRect(0, by + bh - 5, bw, 1.4);
        if (rand() < 0.55) g.fillRect(1.5, by + bh * (0.3 + rand() * 0.25), Math.max(1, bw - 3), 3 + rand() * 4);
        if (rand() < 0.3) g.fillRect(0, by + bh * 0.62, bw, 1.2);
        g.restore();
        x += bw + (rand() < 0.15 ? 1 : 0);
      }
      const plank = g.createLinearGradient(0, plankY, 0, plankY + 8);
      plank.addColorStop(0, rgbStr(wood, 1.25));
      plank.addColorStop(1, rgbStr(wood, 0.55));
      g.fillStyle = plank;
      g.fillRect(0, plankY, TEX_W, 8);
      g.fillStyle = 'rgba(255,220,160,0.25)';
      g.fillRect(0, plankY, TEX_W, 1);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, plankY + 8 - 1, TEX_W, 1);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 0.7;
      for (let line = 0; line < 3; line++) {
        const gy = plankY + 2 + rand() * 4;
        g.beginPath();
        g.moveTo(0, gy);
        g.lineTo(TEX_W, gy + (rand() - 0.5));
        g.stroke();
      }
    }
    g.fillStyle = rgbStr(wood, 0.55);
    g.fillRect(0, 0, 3, TEX_H);
    g.fillRect(TEX_W - 3, 0, 3, TEX_H);
    g.fillStyle = 'rgba(255,220,160,0.18)';
    g.fillRect(3, 0, 1, TEX_H);
    cobweb(g, 4, 1, 1, 1, 28);
    cobweb(g, TEX_W - 4, shelfH + 1, -1, 1, 20);
    cobweb(g, 4, shelfH * 3 + 1, 1, 1, 16);
    for (let n = 0; n < 90; n++) {
      g.fillStyle = 'rgba(230,215,180,0.07)';
      g.fillRect(rand() * TEX_W, rand() * TEX_H, 1, 1);
    }
  }

  function paintMarbleWall(g, theme, rand) {
    const body = g.createLinearGradient(0, 0, 0, TEX_H);
    body.addColorStop(0, '#0a0a11');
    body.addColorStop(0.5, '#15151f');
    body.addColorStop(1, '#09090e');
    g.fillStyle = body;
    g.fillRect(0, 0, TEX_W, TEX_H);
    const vein = rgbOf(theme.wallEdge);
    const bright = mixRgb(vein, [255, 255, 255], 0.35);
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (let v = 0; v < 7; v++) {
      const sx = rand() * TEX_W;
      const sy = rand() * TEX_H;
      const ang = rand() * TAU;
      const seed = (rand() * 1e9) | 0;
      for (let pass = 0; pass < 3; pass++) {
        const rnd = seeded(seed);
        g.shadowColor = rgbStr(vein);
        g.shadowBlur = pass === 0 ? 10 : 0;
        g.strokeStyle = pass === 0 ? rgbaStr(vein, 0.5) : pass === 1 ? rgbaStr(vein, 0.8) : rgbaStr(bright, 0.9);
        g.lineWidth = pass === 0 ? 3.2 : pass === 1 ? 1.6 : 0.8;
        walkLine(g, rnd, sx, sy, ang, 16, 5, 1.7);
        walkLine(g, rnd, sx, sy, ang + Math.PI, 12, 5, 1.7);
      }
    }
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
    const gloss = g.createLinearGradient(0, 0, TEX_W, TEX_H * 0.7);
    gloss.addColorStop(0, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.42, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    gloss.addColorStop(0.58, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, TEX_W, TEX_H);
    const frame = g.createLinearGradient(0, 0, TEX_W, TEX_H);
    frame.addColorStop(0, '#c9c5d4');
    frame.addColorStop(0.5, '#a4a0b2');
    frame.addColorStop(1, '#bdb9c9');
    g.fillStyle = frame;
    g.fillRect(0, 0, TEX_W, 13);
    g.fillRect(0, TEX_H - 17, TEX_W, 17);
    g.fillRect(0, 0, 6, TEX_H);
    g.fillRect(TEX_W - 6, 0, 6, TEX_H);
    g.strokeStyle = 'rgba(80,78,98,0.5)';
    g.lineWidth = 0.8;
    for (let n = 0; n < 5; n++) {
      walkLine(g, rand, rand() * TEX_W, 1 + rand() * 10, rand() * 0.8, 10, 4, 1);
      walkLine(g, rand, rand() * TEX_W, TEX_H - 15 + rand() * 12, rand() * 0.8, 10, 4, 1);
    }
    g.fillStyle = 'rgba(30,28,40,0.55)';
    g.fillRect(0, TEX_H - 17, TEX_W, 2);
    g.strokeStyle = 'rgba(214,176,86,0.85)';
    g.lineWidth = 1;
    g.strokeRect(6.5, 13.5, TEX_W - 13, TEX_H - 31);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, TEX_W, 1);
  }

  const WALL_PAINTERS = { brick: paintBrickWall, moss: paintMossWall, bone: paintBoneWall, shelves: paintShelvesWall, marble: paintMarbleWall };

  function buildWallSet(theme) {
    const full = makeCanvas(TEX_W, TEX_H);
    const g = full.getContext('2d');
    (WALL_PAINTERS[theme.texture] || paintBrickWall)(g, theme, seeded(seedOf(theme.id)));
    const half = makeCanvas(TEX_W / 2, TEX_H / 2);
    const quarter = makeCanvas(TEX_W / 4, TEX_H / 4);
    const gh = half.getContext('2d');
    gh.imageSmoothingQuality = 'high';
    gh.drawImage(full, 0, 0, half.width, half.height);
    const gq = quarter.getContext('2d');
    gq.imageSmoothingQuality = 'high';
    gq.drawImage(half, 0, 0, quarter.width, quarter.height);
    return { mips: [full, half, quarter] };
  }

  let theme = null;
  let wallSet = null;
  let fogRgb = [7, 6, 11];
  let glowRgb = [201, 179, 126];
  let edgeRgb = [150, 132, 240];
  let backdrop = null;
  const floorSets = {};
  const wallSets = {};
  const backdropSets = {};

  function applyTheme(next) {
    theme = next;
    if (!floorSets[next.id]) floorSets[next.id] = buildTileSet(next);
    if (!wallSets[next.id]) wallSets[next.id] = buildWallSet(next);
    if (!backdropSets[next.id]) {
      const fog = rgbOf(next.fog);
      const edge = rgbOf(next.wallEdge);
      const floorDark = rgbOf(next.floorDark);
      backdropSets[next.id] = {
        ceilTop: rgbStr(mixRgb(fog, edge, 0.16)),
        ceilMid: rgbStr(mixRgb(fog, edge, 0.04)),
        ceilLow: rgbStr(fog),
        floorMid: rgbStr(mixRgb(fog, floorDark, 0.5)),
        floorLow: rgbStr(floorDark)
      };
    }
    tileTex = floorSets[next.id];
    wallSet = wallSets[next.id];
    backdrop = backdropSets[next.id];
    fogRgb = rgbOf(next.fog);
    glowRgb = rgbOf(next.glow);
    edgeRgb = rgbOf(next.wallEdge);
  }

  function buildNoise() {
    for (let n = 0; n < 3; n++) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = 128;
      tileCanvas.height = 128;
      const tileCtx = tileCanvas.getContext('2d');
      const image = tileCtx.createImageData(128, 128);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = (Math.random() * 255) | 0;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
      }
      tileCtx.putImageData(image, 0, 0);
      noisePatterns.push(ctx.createPattern(tileCanvas, 'repeat'));
    }
  }

  const render3d = (G.render3d = {});

  render3d.init = function (targetCanvas) {
    canvas = targetCanvas;
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    if (!listening) {
      window.addEventListener('resize', resize);
      listening = true;
    }
    if (!noisePatterns.length) buildNoise();
    applyTheme(G.THEMES[0]);
  };

  render3d.cellAt = function () {
    return null;
  };

  function pushBanner(title, sub, color, now, duration) {
    if (banners.length >= 5) return;
    const start = Math.max(now, bannerEnd);
    bannerEnd = start + duration;
    banners.push({ title: title, sub: sub, color: color, start: start, dur: duration });
  }

  function handleEvents(state, player, now) {
    const events = state.events || [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'wave') {
        pushBanner('OLEADA ' + ev.n, ev.boss ? 'UN JEFE ACECHA' : 'LAS SOMBRAS SE AGITAN', ev.boss ? colors().blood : colors().ghost, now, 2400);
      } else if (ev.type === 'unlock') {
        pushBanner('NUEVA PIEZA', (G.PIECE_GLYPH[ev.piece] || '') + '︎  ' + (PIECE_NAME[ev.piece] || String(ev.piece).toUpperCase()), colors().player, now, 2800);
      } else if (ev.type === 'spawn' && ev.kind === 'boss') {
        for (let k = 0; k < state.enemies.length; k++) {
          const boss = state.enemies[k];
          if (boss.kind === 'boss' && boss.name) pushBanner(boss.name.toUpperCase(), 'HA DESPERTADO', colors().blood, now, 2400);
        }
      } else if (ev.type === 'hurt' && (ev.pid === undefined || ev.pid === player.id)) {
        hurtAt = now;
      } else if (ev.type === 'move' && (ev.pid === undefined || ev.pid === player.id)) {
        moveAt = now;
      }
    }
  }

  function syncState(state) {
    if (state.maze !== curMaze) {
      curMaze = state.maze;
      visEnemies.clear();
      camReady = false;
      banners.length = 0;
      bannerEnd = 0;
      hurtAt = -1e9;
      moveAt = -1e9;
    }
  }

  function updateCamera(player, dt) {
    const targetX = player.x + 0.5 - Math.cos(yaw) * CAMERA_BACK;
    const targetY = player.y + 0.5 - Math.sin(yaw) * CAMERA_BACK;
    const dir = player.dir && (player.dir.dx || player.dir.dy) ? player.dir : { dx: 0, dy: -1 };
    const targetYaw = Math.atan2(dir.dy, dir.dx);
    if (!camReady || Math.abs(targetX - camX) > 5 || Math.abs(targetY - camY) > 5) {
      camX = targetX;
      camY = targetY;
      yaw = targetYaw;
      camReady = true;
      return;
    }
    const kPos = 1 - Math.exp(-dt / ((G.CFG.cooldowns[player.piece] || 300) * 0.28));
    camX += (targetX - camX) * kPos;
    camY += (targetY - camY) * kPos;
    if (G.view.free) {
      yaw += (G.view.yaw - yaw) * (1 - Math.exp(-dt / G.view.turnSmoothMs));
      return;
    }
    let diff = targetYaw - yaw;
    diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    yaw += diff * (1 - Math.exp(-dt / 75));
  }

  function visualOf(id, x, y, dt) {
    let visual = visEnemies.get(id);
    if (!visual) {
      visual = { x: x, y: y, seen: frameId };
      visEnemies.set(id, visual);
      return visual;
    }
    if (Math.abs(x - visual.x) > 5 || Math.abs(y - visual.y) > 5) {
      visual.x = x;
      visual.y = y;
    } else {
      const k = 1 - Math.exp(-dt / 90);
      visual.x += (x - visual.x) * k;
      visual.y += (y - visual.y) * k;
    }
    visual.seen = frameId;
    return visual;
  }

  function prune() {
    visEnemies.forEach(function (visual, id) {
      if (visual.seen !== frameId) visEnemies.delete(id);
    });
  }

  function inRoom(room, x, y, pad) {
    return room && x >= room.x - pad && y >= room.y - pad && x < room.x + room.w + pad && y < room.y + room.h + pad;
  }

  function horizonOf(now, f) {
    const p = (now - moveAt) / 380;
    let offset = 0;
    if (p >= 0 && p < 1) offset = Math.sin(p * TAU) * (1 - p) * f * 0.011;
    const k = (now - hurtAt) / 500;
    if (k >= 0 && k < 1) offset += Math.sin(k * 18) * (1 - k) * f * 0.012;
    return cssH / 2 + offset + (G.view.free ? G.view.pitch * f : 0);
  }

  function drawBackdrop(horizon, f) {
    const pad = 40;
    const ceil = ctx.createLinearGradient(0, 0, 0, horizon);
    ceil.addColorStop(0, backdrop.ceilTop);
    ceil.addColorStop(0.55, backdrop.ceilMid);
    ceil.addColorStop(1, backdrop.ceilLow);
    ctx.fillStyle = ceil;
    ctx.fillRect(0, -pad, cssW, horizon + pad);
    const floor = ctx.createLinearGradient(0, horizon, 0, cssH);
    floor.addColorStop(0, backdrop.ceilLow);
    floor.addColorStop(0.45, backdrop.floorMid);
    floor.addColorStop(1, backdrop.floorLow);
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, cssW, cssH - horizon + pad);

    const along = camX * Math.cos(yaw) + camY * Math.sin(yaw);
    for (let k = Math.ceil(along + 0.35); k < along + 8; k++) {
      const depth = k - along;
      const fog = Math.exp(-depth * 0.45);
      const offset = (f * 0.5) / depth;
      ctx.fillStyle = rgbaStr(edgeRgb, (0.1 * fog).toFixed(3));
      ctx.fillRect(0, horizon + offset, cssW, 1);
      ctx.fillStyle = rgbaStr(edgeRgb, (0.05 * fog).toFixed(3));
      ctx.fillRect(0, horizon - offset, cssW, 1);
    }
  }

  function drawFloor(horizon, f) {
    if (!floorBuf || !tileTex[0].length) return;
    const scale = floorScale;
    const voidRgb = fogRgb;
    const gloss = theme.texture === "marble";
    const dirX = Math.cos(yaw);
    const dirY = Math.sin(yaw);
    const planeX = -dirY * TAN_HALF;
    const planeY = dirX * TAN_HALF;
    const lastIdx = TILE_SIZE - 1;
    floorBuf.fill(0);
    const rowFrom = Math.max(0, Math.floor(horizon / scale));
    for (let row = rowFrom; row < floorH; row++) {
      const py = (row + 0.5) * scale - horizon;
      if (py < 0.6) continue;
      const dist = (EYE_HEIGHT * f) / py;
      if (dist > FLOOR_FAR) continue;
      const vis = Math.exp(-dist * 0.42) * flick;
      const mixv = clamp(vis, 0, 1);
      const shade = vis * 2.5;
      const warm = 0.1 * vis * vis * vis;
      const addR = voidRgb[0] * (1 - mixv) + glowRgb[0] * warm;
      const addG = voidRgb[1] * (1 - mixv) + glowRgb[1] * warm;
      const addB = voidRgb[2] * (1 - mixv) + glowRgb[2] * warm;
      const glossAmt = gloss ? 0.2 * vis * Math.min(1, dist / 3) : 0;
      const camL = -1 + scale / cssW;
      let fx = camX + dist * (dirX + planeX * camL);
      let fy = camY + dist * (dirY + planeY * camL);
      const stepX = (dist * planeX * 2 * scale) / cssW;
      const stepY = (dist * planeY * 2 * scale) / cssW;
      let lastCx = 1e9;
      let lastCy = 1e9;
      let tex = tileTex[0][0];
      let flip = 0;
      const base = row * floorW;
      for (let col = 0; col < floorW; col++, fx += stepX, fy += stepY) {
        const tileX = Math.floor(fx);
        const tileY = Math.floor(fy);
        if (tileX !== lastCx || tileY !== lastCy) {
          lastCx = tileX;
          lastCy = tileY;
          const code = hash(tileX, tileY, 7);
          tex = tileTex[(tileX + tileY) & 1][code % TILE_VARIANTS];
          flip = (code >>> 8) & 7;
        }
        let tu = ((fx - tileX) * TILE_SIZE) | 0;
        let tv = ((fy - tileY) * TILE_SIZE) | 0;
        if (flip & 1) tu = lastIdx - tu;
        if (flip & 2) tv = lastIdx - tv;
        if (flip & 4) { const swap = tu; tu = tv; tv = swap; }
        const idx = (tv * TILE_SIZE + tu) * 3;
        const spec = glossAmt * floorGauss[col];
        let red = tex[idx] * shade + addR + glowRgb[0] * spec;
        let green = tex[idx + 1] * shade + addG + glowRgb[1] * spec;
        let blue = tex[idx + 2] * shade + addB + glowRgb[2] * spec;
        if (red > 255) red = 255;
        if (green > 255) green = 255;
        if (blue > 255) blue = 255;
        floorBuf[base + col] = 0xff000000 | ((blue | 0) << 16) | ((green | 0) << 8) | (red | 0);
      }
    }
    floorCtx.putImageData(floorImage, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(floorCanvas, 0, 0, floorW * scale, floorH * scale);
  }

  const WALL_SCALE = 1.6;
  const CAMERA_BACK = 0.35;
  const EYE_HEIGHT = 0.6;

  function drawWalls(maze, horizon, f, now) {
    const bloodRgb = rgbOf(colors().blood);
    const dirX = Math.cos(yaw);
    const dirY = Math.sin(yaw);
    const planeX = -dirY * TAN_HALF;
    const planeY = dirX * TAN_HALF;
    const cols = zbuf.length;
    const centerCol = Math.floor(cols / 2);
    const mirrorable = theme.texture !== 'marble';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    for (let i = 0; i < cols; i++) {
      const camPos = (2 * (i + 0.5) * colW) / cssW - 1;
      const rayX = dirX + planeX * camPos;
      const rayY = dirY + planeY * camPos;
      let mapX = Math.floor(camX);
      let mapY = Math.floor(camY);
      const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
      const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
      let stepX;
      let stepY;
      let sideX;
      let sideY;
      if (rayX < 0) { stepX = -1; sideX = (camX - mapX) * deltaX; } else { stepX = 1; sideX = (mapX + 1 - camX) * deltaX; }
      if (rayY < 0) { stepY = -1; sideY = (camY - mapY) * deltaY; } else { stepY = 1; sideY = (mapY + 1 - camY) * deltaY; }
      let side = 0;
      let perp = MAX_DIST;
      let hit = false;
      for (let n = 0; n < 40; n++) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; } else { sideY += deltaY; mapY += stepY; side = 1; }
        if (G.isWall(maze, mapX, mapY)) {
          perp = side === 0 ? sideX - deltaX : sideY - deltaY;
          hit = true;
          break;
        }
        if ((side === 0 ? sideX - deltaX : sideY - deltaY) > MAX_DIST) break;
      }
      if (perp < 0.02) perp = 0.02;
      zbuf[i] = hit ? perp : MAX_DIST + 1;
      if (i === centerCol) {
        aimX = camX + dirX * perp;
        aimY = camY + dirY * perp;
      }
      if (!hit || perp > MAX_DIST) continue;

      const vis = Math.exp(-perp * 0.42) * flick;
      if (vis < 0.012) continue;
      const baseHeight = f / perp;
      const height = baseHeight * WALL_SCALE;
      const top = horizon + baseHeight * EYE_HEIGHT - height;
      const u0 = side === 0 ? camY + perp * rayY : camX + perp * rayX;
      const u = u0 - Math.floor(u0);
      const uTex = mirrorable && hash(mapX, mapY, side) & 1 ? 1 - u : u;
      const face = side === 1 ? 1 : 0.66;
      const x = i * colW;
      const y0 = Math.max(top, -2);
      const y1 = Math.min(top + height, cssH + 2);
      if (y1 <= y0) continue;

      const mip = height > TEX_H * 0.75 ? 0 : height > TEX_H * 0.38 ? 1 : 2;
      const img = wallSet.mips[mip];
      let srcX = Math.floor(uTex * img.width);
      if (srcX >= img.width) srcX = img.width - 1;
      const srcY = ((y0 - top) / height) * img.height;
      const srcH = ((y1 - y0) / height) * img.height;
      ctx.drawImage(img, srcX, srcY, 1, srcH, x, y0, colW, y1 - y0);

      const keep = vis * face;
      const alpha = 1 - keep;
      if (alpha > 0.002) {
        const warm = 0.2 * vis * vis * vis;
        const fogK = Math.max(0, 1 - vis);
        const inv = 1 / alpha;
        const red = Math.min(255, (fogRgb[0] * fogK + glowRgb[0] * warm) * inv);
        const green = Math.min(255, (fogRgb[1] * fogK + glowRgb[1] * warm) * inv);
        const blue = Math.min(255, (fogRgb[2] * fogK + glowRgb[2] * warm) * inv);
        ctx.fillStyle = 'rgba(' + (red | 0) + ',' + (green | 0) + ',' + (blue | 0) + ',' + (alpha > 1 ? 1 : alpha).toFixed(3) + ')';
        ctx.fillRect(x, y0, colW, y1 - y0);
      }
      if (inRoom(maze.bossRoom, mapX, mapY, 1)) {
        ctx.fillStyle = 'rgba(' + bloodRgb[0] + ',' + bloodRgb[1] + ',' + bloodRgb[2] + ',' + (0.2 * vis).toFixed(3) + ')';
        ctx.fillRect(x, y0, colW, y1 - y0);
      }
      if (u < 0.025 || u > 0.975) {
        ctx.fillStyle = rgbaStr(edgeRgb, (0.32 * vis).toFixed(3));
        ctx.fillRect(x, y0, colW, y1 - y0);
      }
    }
  }

  function drawGhostBody(cx, cy, r, color, alpha, now, seed, stretch) {
    const t = now * 0.006 + seed;
    ctx.save();
    ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.6);
    glow.addColorStop(0, rgba(color, 0.38 * alpha));
    glow.addColorStop(1, rgba(color, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.scale(1, stretch);
    const base = r * 0.95;
    const teeth = 7;
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r, Math.PI, 0, false);
    ctx.lineTo(r, base);
    for (let i = 1; i <= teeth; i++) {
      const fx = r - (2 * r * i) / teeth;
      const fy = base + Math.sin(t * 1.4 + i * 1.3) * r * 0.16 + (i % 2 === 0 ? 0 : r * 0.16);
      ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    const body = ctx.createLinearGradient(0, -r * 1.1, 0, base + r * 0.3);
    body.addColorStop(0, rgba(color, 0.95 * alpha));
    body.addColorStop(0.6, rgba(color, 0.55 * alpha));
    body.addColorStop(1, rgba(color, 0.1 * alpha));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = rgba('#E9FFFB', 0.45 * alpha);
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();

    const eyeAlpha = alpha * alpha;
    const eyeX = r * 0.36;
    const eyeY = -r * 0.15;
    ctx.fillStyle = rgba('#07060B', 0.9 * eyeAlpha);
    ctx.beginPath();
    ctx.ellipse(-eyeX, eyeY, r * 0.17, r * 0.25, 0, 0, TAU);
    ctx.ellipse(eyeX, eyeY, r * 0.17, r * 0.25, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.32, r * 0.14, r * 0.2 + Math.sin(t) * r * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#E9FFFB', 0.9 * eyeAlpha);
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, r * 0.06, 0, TAU);
    ctx.arc(eyeX, eyeY, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function bossPiece(enemy) {
    const name = (enemy.name || '').toLowerCase();
    if (name.indexOf('obispo') >= 0) return 'bishop';
    if (name.indexOf('muro') >= 0) return 'knight';
    if (name.indexOf('torre') >= 0) return 'rook';
    if (name.indexOf('reina') >= 0) return 'queen';
    if (name.indexOf('rey') >= 0) return 'king';
    if (enemy.weakTo && enemy.weakTo[0]) return enemy.weakTo[0];
    return 'queen';
  }

  function drawBossBar(enemy, cx, topY, r, vis) {
    const width = Math.max(60, r * 2.4);
    const x = cx - width / 2;
    const y = topY - 16;
    const fraction = clamp(enemy.hp / (enemy.maxHp || 1), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 2, y - 2, width + 4, 12);
    const bar = ctx.createLinearGradient(x, y, x, y + 8);
    bar.addColorStop(0, '#FF5A82');
    bar.addColorStop(1, colors().blood);
    ctx.fillStyle = bar;
    ctx.fillRect(x, y, width * fraction, 8);
    ctx.fillStyle = 'rgba(7,6,11,0.8)';
    for (let i = 1; i < enemy.maxHp; i++) ctx.fillRect(x + (width * i) / enemy.maxHp - 0.75, y, 1.5, 8);
    ctx.strokeStyle = rgba('#FF8AA6', 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2, y - 2, width + 4, 12);
    setSpacing(2);
    ctx.font = '600 ' + Math.round(clamp(width * 0.14, 10, 16)) + 'px ' + FONT_SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgba('#F6D2DA', 0.95 * vis);
    ctx.fillText((enemy.name || 'JEFE').toUpperCase(), cx + 1, y - 7);
    setSpacing(0);
  }

  function drawSprite(enemy, visual, horizon, f, now) {
    const relX = visual.x + 0.5 - camX;
    const relY = visual.y + 0.5 - camY;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const forward = relX * cosY + relY * sinY;
    if (forward < 0.2) return null;
    const side = -relX * sinY + relY * cosY;
    const scale = f / forward;
    const sx = cssW / 2 + side * scale;
    const boss = enemy.kind === 'boss';
    const wraith = enemy.kind === 'wraith';
    const bob = Math.sin(now * 0.003 + enemy.id * 1.9) * 0.05;
    const invulnerable = now < (enemy.invulnUntil || 0);
    const entry = G.bestiary && G.bestiary.forEnemy(enemy);
    const img = entry ? G.bestiary.image(entry.id, boss && invulnerable ? '#F2B8C6' : null, G.bestiary.frameOf(entry, enemy, now)) : null;
    let radius = (boss ? 0.62 : 0.3) * scale;
    let sy = horizon + (EYE_HEIGHT - (boss ? 0.62 : 0.5) - bob) * scale;
    let spriteSize = 0;
    let spriteTop = 0;
    if (img) {
      spriteSize = entry.size3d * scale;
      const bottom = horizon + (EYE_HEIGHT - entry.lift - (entry.float ? bob : 0)) * scale;
      spriteTop = bottom - spriteSize;
      sy = bottom - spriteSize / 2;
      radius = spriteSize * 0.42;
    }
    const reach = radius * 2.6;
    if (sx + reach < 0 || sx - reach > cssW) return null;

    const testDepth = wraith ? forward - 0.5 : forward;
    const c0 = clamp(Math.floor((sx - reach) / colW), 0, zbuf.length - 1);
    const c1 = clamp(Math.floor((sx + reach) / colW), 0, zbuf.length - 1);
    ctx.save();
    ctx.beginPath();
    let runStart = -1;
    let any = false;
    for (let c = c0; c <= c1 + 1; c++) {
      const visible = c <= c1 && zbuf[c] > testDepth;
      if (visible && runStart < 0) runStart = c;
      if (!visible && runStart >= 0) {
        ctx.rect(runStart * colW, 0, (c - runStart) * colW, cssH);
        runStart = -1;
        any = true;
      }
    }
    if (!any) {
      ctx.restore();
      return null;
    }
    ctx.clip();

    const vis = Math.max(0.3, Math.exp(-forward * 0.3)) * Math.min(1, flick + 0.05);
    if (boss) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + enemy.id);
      const auraAlpha = vis * (0.55 + 0.35 * pulse);
      const aura = ctx.createRadialGradient(sx, sy, radius * 0.3, sx, sy, radius * 3.4);
      aura.addColorStop(0, rgba(colors().blood, 0.6 * auraAlpha));
      aura.addColorStop(0.5, rgba(colors().blood, 0.2 * auraAlpha));
      aura.addColorStop(1, rgba(colors().blood, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 3.4, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const blink = invulnerable ? (Math.floor(now / 70) % 2 ? 0.35 : 0.8) : 1;
      if (img) {
        ctx.globalAlpha = vis * blink;
        ctx.drawImage(img, sx - spriteSize / 2, spriteTop, spriteSize, spriteSize);
        ctx.globalAlpha = 1;
        ctx.restore();
        return { sx: sx, top: spriteTop + spriteSize * 0.04, radius: radius, vis: vis, boss: boss };
      }
      drawGhostBody(sx, sy, radius, invulnerable ? '#F2B8C6' : '#D63A62', vis * blink, now, enemy.id * 1.7, 1.12);
      ctx.font = Math.round(radius * 1.05) + 'px ' + FONT_GLYPH;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba('#07060B', 0.7 * vis * blink);
      ctx.fillText((G.PIECE_GLYPH[bossPiece(enemy)] || '♛') + '︎', sx, sy + radius * 0.55);
    } else if (img) {
      const glowR = spriteSize * 0.7;
      const halo = ctx.createRadialGradient(sx, sy, glowR * 0.15, sx, sy, glowR);
      halo.addColorStop(0, rgba(entry.glow, 0.3 * vis));
      halo.addColorStop(1, rgba(entry.glow, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = halo;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = vis * (wraith ? 0.85 : 1) * (invulnerable && Math.floor(now / 60) % 2 ? 0.4 : 1);
      ctx.drawImage(img, sx - spriteSize / 2, spriteTop, spriteSize, spriteSize);
      ctx.globalAlpha = 1;
    } else {
      drawGhostBody(sx, sy, radius, wraith ? WRAITH_COLOR : colors().ghost, vis * (wraith ? 0.78 : 1), now, enemy.id * 2.3, wraith ? 1.3 : 1);
    }
    ctx.restore();
    return { sx: sx, top: sy - radius * (boss ? 1.5 : 1.2), radius: radius, vis: vis, boss: boss };
  }

  const PROP_RADIUS = 7;
  const propList = [];

  function drawProp(item, horizon, f, now) {
    const sprite = item.sprite;
    const forward = item.forward;
    const scale = f / forward;
    const sx = cssW / 2 + item.side * scale;
    let width;
    let height;
    let bottom;
    if (sprite.flat) {
      const entry = G.props.byKind[item.prop.kind];
      width = entry.size * scale;
      height = Math.max(2, width * EYE_HEIGHT / forward);
      bottom = horizon + EYE_HEIGHT * scale + height * 0.5;
    } else {
      height = sprite.scale * scale;
      width = height * sprite.aspect;
      if (sprite.wallFace !== null) width *= Math.max(0.2, item.facing);
      bottom = horizon + (EYE_HEIGHT - sprite.yOffset) * scale;
    }
    const top = bottom - height;
    const reach = Math.max(width, height) * (sprite.light ? 1.3 : 0.6);
    if (sx + reach < 0 || sx - reach > cssW || bottom < 0 || top > cssH) return;

    const testDepth = sprite.wallFace !== null ? forward - 0.06 : forward;
    const c0 = clamp(Math.floor((sx - reach) / colW), 0, zbuf.length - 1);
    const c1 = clamp(Math.floor((sx + reach) / colW), 0, zbuf.length - 1);
    let runStart = -1;
    let any = false;
    ctx.save();
    ctx.beginPath();
    for (let c = c0; c <= c1 + 1; c++) {
      const visible = c <= c1 && zbuf[c] > testDepth;
      if (visible && runStart < 0) runStart = c;
      if (!visible && runStart >= 0) {
        ctx.rect(runStart * colW, 0, (c - runStart) * colW, cssH);
        runStart = -1;
        any = true;
      }
    }
    if (!any) {
      ctx.restore();
      return;
    }
    ctx.clip();
    const fog = Math.exp(-forward * 0.42) * flick;
    const vis = sprite.light ? Math.max(fog, 0.55 * Math.exp(-forward * 0.12)) : fog;
    if (sprite.light) {
      const cy = top + height * 0.5;
      const haloR = Math.max(width, height) * (0.9 + sprite.light.radius * 0.35);
      const grad = ctx.createRadialGradient(sx, cy, 0, sx, cy, haloR);
      const color = sprite.light.color;
      const alpha = Math.min(0.5, 0.34 * sprite.flicker * Math.min(1, vis + 0.2));
      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.45, rgba(color, alpha * 0.35));
      grad.addColorStop(1, rgba(color, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.fillRect(sx - haloR, cy - haloR, haloR * 2, haloR * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = clamp(vis * 1.6 + 0.12, 0, 1);
    ctx.drawImage(sprite.image, sx - width / 2, top, width, height);
    ctx.restore();
  }

  function drawProps(state, horizon, f, now) {
    const props = state.props;
    if (!props || !G.props) return;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    propList.length = 0;
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      const dx = prop.x + 0.5 - camX;
      const dy = prop.y + 0.5 - camY;
      if (dx * dx + dy * dy > PROP_RADIUS * PROP_RADIUS) continue;
      const sprite = G.props.sprite3D(prop, now);
      if (!sprite || !sprite.image) continue;
      const relX = sprite.wx - camX;
      const relY = sprite.wy - camY;
      const forward = relX * cosY + relY * sinY;
      if (forward < 0.25) continue;
      let facing = 1;
      if (sprite.wallFace !== null) {
        const dir = G.props.faceDirs[sprite.wallFace];
        if ((camX - (prop.x + 0.5)) * dir[0] + (camY - (prop.y + 0.5)) * dir[1] >= 0.45) continue;
        const dist = Math.hypot(relX, relY) || 1;
        facing = Math.abs((relX * dir[0] + relY * dir[1]) / dist);
      }
      propList.push({ prop: prop, sprite: sprite, forward: forward, side: -relX * sinY + relY * cosY, facing: facing });
    }
    propList.sort(function (a, b) { return b.forward - a.forward; });
    for (let i = 0; i < propList.length; i++) drawProp(propList[i], horizon, f, now);
  }

  function drawEnemies(state, horizon, f, now, dt) {
    const list = [];
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i];
      const visual = visualOf(enemy.id, enemy.x, enemy.y, dt);
      const relX = visual.x + 0.5 - camX;
      const relY = visual.y + 0.5 - camY;
      list.push({ enemy: enemy, visual: visual, depth: relX * relX + relY * relY });
    }
    prune();
    list.sort(function (a, b) { return b.depth - a.depth; });
    const bars = [];
    for (let i = 0; i < list.length; i++) {
      const drawn = drawSprite(list[i].enemy, list[i].visual, horizon, f, now);
      if (drawn && drawn.boss) bars.push({ enemy: list[i].enemy, drawn: drawn });
    }
    for (let i = 0; i < bars.length; i++) {
      const drawn = bars[i].drawn;
      if (drawn.sx > -100 && drawn.sx < cssW + 100) drawBossBar(bars[i].enemy, drawn.sx, drawn.top, drawn.radius, drawn.vis);
    }
  }

  function drawTorchGlow() {
    const cx = cssW / 2;
    const cy = cssH * 1.02;
    const radius = Math.max(cssW, cssH) * 0.7;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, rgbaStr(glowRgb, 0.2 * flick));
    glow.addColorStop(0.45, rgbaStr(glowRgb, 0.07 * flick));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) * 0.56);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.6, 'rgba(3,2,6,0.45)');
    gradient.addColorStop(1, 'rgba(2,1,4,0.92)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawGrain() {
    if (!noisePatterns.length) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, -Math.floor(Math.random() * 128), -Math.floor(Math.random() * 128));
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = noisePatterns[Math.floor(Math.random() * noisePatterns.length)];
    ctx.fillRect(0, 0, canvas.width + 128, canvas.height + 128);
    ctx.restore();
  }

  function drawDamageFx(player, now) {
    const k = 1 - (now - hurtAt) / 650;
    if (k > 0) {
      const offset = 10 * k * k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 * k;
      ctx.drawImage(canvas, -offset, 0, cssW, cssH);
      ctx.drawImage(canvas, offset, 0, cssW, cssH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(colors().blood, 0.4 * k);
      ctx.fillRect(0, 0, cssW, cssH);
      const edge = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.2, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) * 0.55);
      edge.addColorStop(0, 'rgba(179,18,58,0)');
      edge.addColorStop(1, rgba(colors().blood, 0.85 * k));
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (now < (player.invulnUntil || 0)) {
      const on = Math.floor(now / 80) % 2;
      ctx.fillStyle = rgba(colors().blood, on ? 0.12 : 0.03);
      ctx.fillRect(0, 0, cssW, cssH);
    }
  }

  function drawCrosshair() {
    const cx = cssW / 2;
    const cy = cssH / 2;
    ctx.strokeStyle = rgba(colors().player, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawMinimap(state, ui, now) {
    const maze = state.maze;
    const size = Math.min(160, cssW * 0.32);
    const x0 = cssW - size - 18;
    const y0 = 16;
    const cell = size / (MAP_RADIUS * 2);
    const left = camX - MAP_RADIUS;
    const top = camY - MAP_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    const blood = colors().blood;

    ctx.save();
    roundRect(x0, y0, size, size, 8);
    ctx.fillStyle = 'rgba(7,6,11,0.82)';
    ctx.fill();
    ctx.clip();

    for (let gy = Math.floor(top); gy <= Math.floor(top + MAP_RADIUS * 2); gy++) {
      for (let gx = Math.floor(left); gx <= Math.floor(left + MAP_RADIUS * 2); gx++) {
        if (gx < 0 || gy < 0 || gx >= maze.w || gy >= maze.h) continue;
        const px = x0 + (gx - left) * cell;
        const py = y0 + (gy - top) * cell;
        const dist = Math.hypot(gx + 0.5 - camX, gy + 0.5 - camY);
        ctx.globalAlpha = clamp((MAP_RADIUS + 0.8 - dist) / 3, 0, 1);
        if (G.isWall(maze, gx, gy)) {
          ctx.fillStyle = '#3B3563';
          ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
        } else {
          ctx.fillStyle = inRoom(maze.bossRoom, gx, gy, 0) ? '#26101C' : '#15121F';
          ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
        }
      }
    }
    ctx.globalAlpha = 1;

    const targets = ui.targets || [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const px = x0 + (target.x - left) * cell;
      const py = y0 + (target.y - top) * cell;
      if (px < x0 - cell || py < y0 - cell || px > x0 + size || py > y0 + size) continue;
      if (target.capture) {
        ctx.fillStyle = rgba(blood, 0.65 + 0.3 * pulse);
        ctx.fillRect(px, py, cell, cell);
        ctx.strokeStyle = rgba('#FF3B6B', 0.95);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px + 0.6, py + 0.6, cell - 1.2, cell - 1.2);
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.25, py + cell * 0.25);
        ctx.lineTo(px + cell * 0.75, py + cell * 0.75);
        ctx.moveTo(px + cell * 0.75, py + cell * 0.25);
        ctx.lineTo(px + cell * 0.25, py + cell * 0.75);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(blood, 0.32 + 0.22 * pulse);
        ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
      }
    }
    if (ui.hover) {
      ctx.strokeStyle = rgba(colors().player, 0.9);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x0 + (ui.hover.x - left) * cell + 0.6, y0 + (ui.hover.y - top) * cell + 0.6, cell - 1.2, cell - 1.2);
    }

    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i];
      const visual = visEnemies.get(enemy.id) || enemy;
      const px = x0 + (visual.x + 0.5 - left) * cell;
      const py = y0 + (visual.y + 0.5 - top) * cell;
      const boss = enemy.kind === 'boss';
      const entry = !boss && G.bestiary ? G.bestiary.get(enemy.kind) : null;
      const color = boss ? '#FF3B6B' : entry ? entry.glow : colors().ghost;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, cell * (boss ? 0.52 : 0.3), 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const pcx = x0 + size / 2;
    const pcy = y0 + size / 2;
    const reach = 3.2 * cell;
    ctx.fillStyle = rgba(colors().player, 0.1);
    ctx.beginPath();
    ctx.moveTo(pcx, pcy);
    ctx.arc(pcx, pcy, reach, yaw - FOV / 2, yaw + FOV / 2);
    ctx.closePath();
    ctx.fill();

    const ax = pcx + (aimX - camX) * cell;
    const ay = pcy + (aimY - camY) * cell;
    ctx.strokeStyle = rgba(colors().player, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(pcx, pcy);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#F6E9C0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.32, 0, TAU);
    ctx.moveTo(ax - cell * 0.5, ay);
    ctx.lineTo(ax + cell * 0.5, ay);
    ctx.moveTo(ax, ay - cell * 0.5);
    ctx.lineTo(ax, ay + cell * 0.5);
    ctx.stroke();

    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(yaw);
    ctx.beginPath();
    ctx.moveTo(cell * 0.85, 0);
    ctx.lineTo(-cell * 0.55, cell * 0.5);
    ctx.lineTo(-cell * 0.25, 0);
    ctx.lineTo(-cell * 0.55, -cell * 0.5);
    ctx.closePath();
    ctx.fillStyle = colors().player;
    ctx.shadowColor = colors().player;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.restore();

    roundRect(x0, y0, size, size, 8);
    ctx.strokeStyle = 'rgba(150,132,240,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    setSpacing(2);
    ctx.font = '600 ' + Math.round(clamp(cssW * 0.013, 11, 15)) + 'px ' + FONT_UI;
    ctx.fillStyle = rgba(colors().ghost, 0.75);
    ctx.fillText('ALMAS  ' + (state.players[0].kills || 0), x0 + size, y0 + size + 20);
    setSpacing(0);
  }

  function heartPath(cx, cy, size) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
    ctx.closePath();
  }

  function drawHearts(player, now, scale) {
    const size = 30 * scale;
    const low = player.hp <= 1;
    for (let i = 0; i < player.maxHp; i++) {
      const cx = 28 + i * (size + 8) + size / 2;
      const cy = 34 + size / 2;
      if (i < player.hp) {
        const beat = 1 + 0.07 * Math.max(0, Math.sin(now * (low ? 0.012 : 0.005))) * (low ? 1.8 : 1);
        heartPath(cx, cy, size * beat);
        ctx.shadowColor = colors().blood;
        ctx.shadowBlur = 14;
        const gradient = ctx.createLinearGradient(cx, cy - size / 2, cx, cy + size / 2);
        gradient.addColorStop(0, '#E8335F');
        gradient.addColorStop(1, colors().blood);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,170,190,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        heartPath(cx, cy, size);
        ctx.fillStyle = 'rgba(179,18,58,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,18,58,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function drawWaveInfo(state, now) {
    const wave = state.wave;
    if (!wave) return;
    const cx = cssW / 2;
    setSpacing(4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 ' + Math.round(clamp(cssW * 0.022, 15, 24)) + 'px ' + FONT_SERIF;
    ctx.fillStyle = rgba('#E9E2FF', 0.92);
    ctx.shadowColor = 'rgba(138,120,235,0.8)';
    ctx.shadowBlur = 12;
    ctx.fillText('OLEADA ' + wave.n + ' / ' + G.CFG.maxWaves, cx + 2, 44);
    ctx.shadowBlur = 0;
    setSpacing(1.5);
    ctx.font = '500 ' + Math.round(clamp(cssW * 0.0125, 11, 14)) + 'px ' + FONT_UI;
    let status;
    if (wave.phase === 'intermission') {
      status = 'calma antes de la tormenta · ' + Math.max(0, Math.ceil(((wave.nextWaveAt || now) - now) / 1000)) + ' s';
      ctx.fillStyle = rgba(colors().player, 0.8);
    } else {
      const remaining = state.enemies.length + (wave.toSpawn || 0);
      status = wave.boss ? 'JEFE · ' + remaining + ' sombras' : remaining + ' sombras';
      ctx.fillStyle = wave.boss ? rgba('#FF6B8E', 0.9) : rgba(colors().ghost, 0.8);
    }
    ctx.fillText(status.toUpperCase(), cx + 1, 64);
    setSpacing(0);
  }

  function lockPath(cx, cy, size) {
    const w = size * 0.5;
    const h = size * 0.38;
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.35, w * 0.3, Math.PI, 0);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillRect(cx - w / 2, cy - h * 0.35, w, h);
  }

  function drawPieceBar(player, now) {
    const order = G.CFG.pieceOrder;
    const slot = clamp(cssW / 13, 44, 66);
    const gap = 10;
    const total = order.length * slot + (order.length - 1) * gap;
    const x0 = (cssW - total) / 2;
    const y0 = cssH - slot - 26;
    const gold = colors().player;
    const switching = now < (player.switchUntil || 0);
    const cooldownTotal = G.CFG.cooldowns[player.piece] || 400;
    const remaining = Math.max(0, (player.cooldownUntil || 0) - now);
    const ready = 1 - clamp(remaining / cooldownTotal, 0, 1);

    for (let i = 0; i < order.length; i++) {
      const piece = order[i];
      const x = x0 + i * (slot + gap);
      const unlocked = player.unlocked && player.unlocked.indexOf(piece) >= 0;
      const active = piece === player.piece;

      roundRect(x, y0, slot, slot, 8);
      ctx.fillStyle = active ? 'rgba(28,23,14,0.9)' : 'rgba(14,12,22,0.82)';
      if (active) {
        ctx.shadowColor = gold;
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = active ? rgba(gold, 0.95) : rgba('#9684E8', 0.2);
      ctx.lineWidth = active ? 2 : 1;
      ctx.stroke();

      ctx.save();
      roundRect(x, y0, slot, slot, 8);
      ctx.clip();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.round(slot * 0.66) + 'px ' + FONT_GLYPH;
      const glyph = (G.PIECE_GLYPH[piece] || '?') + '︎';
      if (unlocked) {
        ctx.fillStyle = active ? gold : rgba(gold, switching ? 0.35 : 0.6);
        if (active) {
          ctx.shadowColor = gold;
          ctx.shadowBlur = 10;
        }
        ctx.fillText(glyph, x + slot / 2, y0 + slot * 0.54);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(150,140,190,0.13)';
        ctx.fillText(glyph, x + slot / 2, y0 + slot * 0.54);
        ctx.fillStyle = 'rgba(190,180,225,0.7)';
        ctx.strokeStyle = 'rgba(190,180,225,0.7)';
        lockPath(x + slot / 2, y0 + slot * 0.54, slot * 0.7);
      }
      if (active && remaining > 0) {
        ctx.fillStyle = 'rgba(7,6,11,0.55)';
        ctx.fillRect(x, y0, slot, slot * (1 - ready));
      }
      if (active) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x + 5, y0 + slot - 9, slot - 10, 4);
        ctx.fillStyle = ready >= 1 ? '#F2E2B0' : rgba(colors().blood, 0.95);
        ctx.fillRect(x + 5, y0 + slot - 9, (slot - 10) * ready, 4);
      }
      ctx.restore();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '700 ' + Math.round(clamp(slot * 0.2, 9, 13)) + 'px ' + FONT_UI;
      ctx.fillStyle = active ? rgba(gold, 0.95) : 'rgba(190,180,225,0.5)';
      ctx.fillText(String(i + 1), x + 6, y0 + 5);
    }

    setSpacing(3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + Math.round(clamp(cssW * 0.0115, 10, 13)) + 'px ' + FONT_UI;
    ctx.fillStyle = rgba(gold, 0.75);
    ctx.fillText(PIECE_NAME[player.piece] || '', cssW / 2 + 1.5, y0 - 9);
    setSpacing(0);
  }

  function drawBanners(now) {
    for (let i = banners.length - 1; i >= 0; i--) {
      if (now > banners[i].start + banners[i].dur) banners.splice(i, 1);
    }
    for (let i = 0; i < banners.length; i++) {
      const banner = banners[i];
      if (now < banner.start) continue;
      const t = (now - banner.start) / banner.dur;
      const fadeIn = sstep(t / 0.16);
      const fadeOut = 1 - sstep((t - 0.7) / 0.3);
      const alpha = Math.min(fadeIn, fadeOut);
      const size = Math.min(cssW * 0.085, 88) * (1 + 0.1 * (1 - fadeIn));
      const cx = cssW / 2;
      const cy = cssH * 0.3;
      const jitter = t < 0.14 ? (Math.random() - 0.5) * 8 : 0;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(size) + 'px ' + FONT_SERIF;
      setSpacing(size * 0.12);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(colors().blood, 0.6);
      ctx.fillText(banner.title, cx - 3 + jitter, cy);
      ctx.fillStyle = rgba(colors().ghost, 0.45);
      ctx.fillText(banner.title, cx + 3 + jitter, cy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = banner.color;
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#F4ECD8';
      ctx.fillText(banner.title, cx + jitter, cy);
      ctx.shadowBlur = 0;

      const lineHalf = Math.min(cssW * 0.3, 340) * sstep(t / 0.3);
      const lineY = cy + size * 0.62;
      const lineGradient = ctx.createLinearGradient(cx - lineHalf, 0, cx + lineHalf, 0);
      lineGradient.addColorStop(0, rgba(banner.color, 0));
      lineGradient.addColorStop(0.5, rgba(banner.color, 0.9));
      lineGradient.addColorStop(1, rgba(banner.color, 0));
      ctx.fillStyle = lineGradient;
      ctx.fillRect(cx - lineHalf, lineY, lineHalf * 2, 2);

      setSpacing(size * 0.1);
      ctx.font = '600 ' + Math.round(size * 0.32) + 'px ' + FONT_SERIF;
      ctx.fillStyle = banner.color;
      ctx.shadowColor = banner.color;
      ctx.shadowBlur = 14;
      ctx.fillText(banner.sub, cx, lineY + size * 0.42);
      ctx.restore();
      setSpacing(0);
    }
  }

  function drawLevelTransition(state, now) {
    const tr = state.transition;
    if (!tr || now >= tr.end + 50) return;
    const hold = 400;
    const resumeAt = tr.swapAt + hold;
    let black;
    if (now < tr.start) black = 0;
    else if (now < tr.swapAt) black = sstep((now - tr.start) / Math.max(1, tr.swapAt - tr.start));
    else if (now < resumeAt) black = 1;
    else black = 1 - sstep((now - resumeAt) / Math.max(1, tr.end - resumeAt));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (black > 0) {
      ctx.globalAlpha = black;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (now >= tr.swapAt && now <= tr.end) {
      const t = now - tr.swapAt;
      const fadeOut = sstep((tr.end - now) / 900);
      const lineAlpha = function (delay) { return Math.min(sstep((t - delay) / 500), fadeOut); };
      const th = state.theme || theme;
      const cx = cssW / 2;
      const cy = cssH / 2;
      let size = Math.min(cssW * 0.07, 76);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setSpacing(size * 0.1);
      ctx.font = '700 ' + Math.round(size) + 'px ' + FONT_SERIF;
      const width = ctx.measureText(th.name).width;
      if (width > cssW * 0.88) size *= (cssW * 0.88) / width;
      setSpacing(size * 0.1);
      ctx.font = '700 ' + Math.round(size) + 'px ' + FONT_SERIF;
      ctx.globalAlpha = lineAlpha(150);
      ctx.shadowColor = rgbStr(glowRgb);
      ctx.shadowBlur = 26;
      ctx.fillStyle = colors().player;
      ctx.fillText(th.name, cx + size * 0.05, cy);
      ctx.shadowBlur = 0;

      setSpacing(size * 0.3);
      ctx.font = '600 ' + Math.round(size * 0.3) + 'px ' + FONT_SERIF;
      ctx.globalAlpha = lineAlpha(0);
      ctx.fillStyle = '#E9E2FF';
      ctx.fillText('NIVEL ' + state.level, cx + size * 0.15, cy - size * 0.95);

      setSpacing(size * 0.04);
      ctx.font = 'italic 500 ' + Math.round(size * 0.34) + 'px ' + FONT_SERIF;
      ctx.globalAlpha = lineAlpha(320) * 0.9;
      ctx.fillStyle = '#E4DCC6';
      ctx.fillText(th.sub, cx, cy + size * 0.95);
      ctx.restore();
      setSpacing(0);
    }
    ctx.globalAlpha = 1;
  }


  render3d.draw = function (state, now, ui) {
    const playing = state && state.phase === 'playing' && state.maze && state.players && state.players[0] && state.enemies;
    if (!playing || !ctx) {
      if (G.render && G.render !== render3d && G.render.draw !== render3d.draw) G.render.draw(state, now, ui);
      return;
    }
    ui = ui || {};
    frameId++;
    const dt = lastNow ? clamp(now - lastNow, 0, 100) : 16;
    lastNow = now;
    const player = state.players[0];
    const nextTheme = state.theme || G.THEMES[0];
    if (nextTheme !== theme) applyTheme(nextTheme);
    const f = cssW / 2 / TAN_HALF;

    syncState(state);
    handleEvents(state, player, now);
    G.slash.ingest(state.events, now);
    updateCamera(player, dt);
    flick = 0.93 + 0.045 * Math.sin(now * 0.011) + 0.03 * Math.sin(now * 0.027 + 1.7) + 0.02 * Math.sin(now * 0.071 + 4.2);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.fog;
    ctx.fillRect(0, 0, cssW, cssH);

    const hurtK = 1 - (now - hurtAt) / 500;
    ctx.save();
    if (hurtK > 0) ctx.translate((Math.random() - 0.5) * 12 * hurtK, (Math.random() - 0.5) * 8 * hurtK);
    const horizon = horizonOf(now, f);
    drawBackdrop(horizon, f);
    drawFloor(horizon, f);
    drawWalls(state.maze, horizon, f, now);
    drawProps(state, horizon, f, now);
    drawEnemies(state, horizon, f, now, dt);
    ctx.restore();

    drawTorchGlow();
    drawVignette();
    drawGrain();
    drawDamageFx(player, now);
    G.slash.drawFirstPerson(ctx, cssW, cssH, now);
    drawCrosshair();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawHearts(player, now, clamp(Math.min(cssW, cssH) / 760, 0.8, 1.1));
    drawWaveInfo(state, now);
    drawMinimap(state, ui, now);
    drawPieceBar(player, now);
    drawBanners(now);
    drawLevelTransition(state, now);
  };
})();
