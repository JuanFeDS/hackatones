(function () {
  'use strict';

  const G = (window.G = window.G || {});
  const TAU = Math.PI * 2;
  const FONT_SERIF = '"Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif';
  const FONT_UI = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const FONT_GLYPH = '"Times New Roman", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
  const PIECE_NAME = { pawn: 'PEÓN', knight: 'CABALLO', bishop: 'ALFIL', rook: 'TORRE', queen: 'DAMA', king: 'REY' };
  const WRAITH_COLOR = '#B49CFF';
  const BASE_TILE = 56;
  const EXPLORED_ALPHA = 0.24;

  let canvas = null;
  let ctx = null;
  let listening = false;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let tile = BASE_TILE;
  let camX = 0;
  let camY = 0;
  let camReady = false;
  let lastNow = 0;
  let curMaze = null;
  let explored = null;
  let lastPhase = null;
  let phaseSince = 0;
  let lightX = 0;
  let lightY = 0;
  let flick = 1;
  let frameId = 0;
  let bannerEnd = 0;
  let wisps = null;
  const visPlayers = new Map();
  const visEnemies = new Map();
  const banners = [];
  const noisePatterns = [];
  const rgbCache = {};

  function clamp(value, lo, hi) {
    return value < lo ? lo : value > hi ? hi : value;
  }

  function sstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function rgba(hexColor, alpha) {
    let rgb = rgbCache[hexColor];
    if (!rgb) {
      const n = parseInt(hexColor.slice(1), 16);
      rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
      rgbCache[hexColor] = rgb;
    }
    return 'rgba(' + rgb + ',' + alpha + ')';
  }

  function colors() {
    return G.CFG.colors;
  }

  function setSpacing(px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.style.display = 'block';
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    tile = Math.round(BASE_TILE * clamp(Math.min(cssW, cssH) / 760, 0.72, 1.15));
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

  const render = (G.render = {});

  render.init = function (targetCanvas) {
    canvas = targetCanvas;
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    if (!listening) {
      window.addEventListener('resize', resize);
      listening = true;
    }
    if (!noisePatterns.length) buildNoise();
  };

  render.cellAt = function (px, py) {
    return {
      x: Math.floor((px - cssW / 2) / tile + camX),
      y: Math.floor((py - cssH / 2) / tile + camY)
    };
  };

  function sxOf(wx) {
    return (wx - camX) * tile + cssW / 2;
  }

  function syOf(wy) {
    return (wy - camY) * tile + cssH / 2;
  }

  function lightAt(wx, wy) {
    const distance = Math.hypot(wx - lightX, wy - lightY);
    return sstep((G.CFG.lightRadius + 0.9 - distance) / 1.8) * flick;
  }

  function pushBanner(title, sub, color, now, duration) {
    if (banners.length >= 5) return;
    const start = Math.max(now, bannerEnd);
    bannerEnd = start + duration;
    banners.push({ title: title, sub: sub, color: color, start: start, dur: duration });
  }

  function handleEvents(state, now) {
    const events = state.events;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'wave') {
        pushBanner('OLEADA ' + ev.n, ev.boss ? 'UN JEFE ACECHA' : 'LAS SOMBRAS SE AGITAN', ev.boss ? colors().blood : colors().ghost, now, 2400);
      } else if (ev.type === 'unlock') {
        const glyph = G.PIECE_GLYPH[ev.piece] || '';
        pushBanner('NUEVA PIEZA', glyph + '︎  ' + (PIECE_NAME[ev.piece] || ev.piece.toUpperCase()), colors().player, now, 2800);
      } else if (ev.type === 'spawn' && ev.kind === 'boss') {
        let boss = null;
        for (let k = 0; k < state.enemies.length; k++) {
          if (state.enemies[k].kind === 'boss') boss = state.enemies[k];
        }
        if (boss && boss.name) pushBanner(boss.name.toUpperCase(), 'HA DESPERTADO', colors().blood, now, 2400);
      }
    }
  }

  function syncState(state, now) {
    if (state.maze && state.maze !== curMaze) {
      curMaze = state.maze;
      explored = new Uint8Array(curMaze.w * curMaze.h);
      visPlayers.clear();
      visEnemies.clear();
      camReady = false;
      banners.length = 0;
      bannerEnd = 0;
      G.fx.reset();
    }
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      phaseSince = now;
    }
  }

  function visualOf(map, id, x, y, dt, rate) {
    let visual = map.get(id);
    if (!visual) {
      visual = { x: x, y: y, seen: frameId };
      map.set(id, visual);
      return visual;
    }
    if (Math.abs(x - visual.x) > 5 || Math.abs(y - visual.y) > 5) {
      visual.x = x;
      visual.y = y;
    } else {
      const k = 1 - Math.exp(-dt / rate);
      visual.x += (x - visual.x) * k;
      visual.y += (y - visual.y) * k;
    }
    visual.seen = frameId;
    return visual;
  }

  function prune(map) {
    map.forEach(function (visual, id) {
      if (visual.seen !== frameId) map.delete(id);
    });
  }

  function hash(x, y) {
    return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  }

  function inRoom(room, x, y) {
    return room && x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
  }

  function drawWall(px, py, x, y, maze) {
    ctx.fillStyle = colors().wall;
    ctx.fillRect(px, py, tile + 0.6, tile + 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillRect(px, py, tile, tile * 0.14);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(px, py + tile * 0.86, tile, tile * 0.14);

    const open = [
      !G.isWall(maze, x, y - 1),
      !G.isWall(maze, x + 1, y),
      !G.isWall(maze, x, y + 1),
      !G.isWall(maze, x - 1, y)
    ];
    if (!open[0] && !open[1] && !open[2] && !open[3]) return;
    const inset = 1;
    ctx.beginPath();
    if (open[0]) { ctx.moveTo(px, py + inset); ctx.lineTo(px + tile, py + inset); }
    if (open[1]) { ctx.moveTo(px + tile - inset, py); ctx.lineTo(px + tile - inset, py + tile); }
    if (open[2]) { ctx.moveTo(px, py + tile - inset); ctx.lineTo(px + tile, py + tile - inset); }
    if (open[3]) { ctx.moveTo(px + inset, py); ctx.lineTo(px + inset, py + tile); }
    ctx.strokeStyle = 'rgba(138,120,235,0.14)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,132,240,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  const TILE_VARIANTS = 6;
  const tileCache = {};

  function makeRng(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shade(rgbArr, delta) {
    return 'rgb(' + clamp(Math.round(rgbArr[0] + delta), 0, 255) + ',' + clamp(Math.round(rgbArr[1] + delta * 0.95), 0, 255) + ',' + clamp(Math.round(rgbArr[2] + delta * 1.1), 0, 255) + ')';
  }

  function makeTileTexture(size, light, boss, seed) {
    const rand = makeRng(seed * 2654435761 + (light ? 17 : 91) + (boss ? 5 : 0));
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const c = cv.getContext('2d');
    const grout = Math.max(1, Math.round(size * 0.035));
    const inner = size - grout * 2;
    let base;
    if (boss) base = light ? [60, 33, 52] : [38, 19, 33];
    else base = light ? [46, 39, 64] : [27, 22, 38];

    c.fillStyle = boss ? '#0C0409' : '#07060B';
    c.fillRect(0, 0, size, size);

    const tone = (rand() - 0.5) * 12;
    c.save();
    c.translate(grout, grout);
    c.beginPath();
    c.rect(0, 0, inner, inner);
    c.clip();

    c.fillStyle = shade(base, tone);
    c.fillRect(0, 0, inner, inner);
    const wash = c.createLinearGradient(0, 0, inner, inner);
    wash.addColorStop(0, 'rgba(255,255,255,' + (light ? 0.05 : 0.035) + ')');
    wash.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = wash;
    c.fillRect(0, 0, inner, inner);

    const veins = 1 + Math.floor(rand() * 3);
    for (let v = 0; v < veins; v++) {
      c.beginPath();
      let vx = rand() * inner * 0.4;
      let vy = rand() * inner;
      c.moveTo(vx, vy);
      for (let s = 0; s < 3; s++) {
        vx += inner * (0.2 + rand() * 0.25);
        vy += (rand() - 0.5) * inner * 0.5;
        c.quadraticCurveTo(vx - inner * 0.1, vy + (rand() - 0.5) * inner * 0.3, vx, vy);
      }
      c.strokeStyle = boss ? 'rgba(210,130,160,' + (0.06 + rand() * 0.06) + ')' : 'rgba(190,180,235,' + (0.05 + rand() * 0.07) + ')';
      c.lineWidth = Math.max(0.6, size * (0.012 + rand() * 0.018));
      c.stroke();
    }

    const stains = Math.floor(rand() * 3);
    for (let s = 0; s < stains; s++) {
      const sx = rand() * inner;
      const sy = rand() * inner;
      const sr = inner * (0.18 + rand() * 0.3);
      const stain = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
      const damp = rand() < 0.5;
      stain.addColorStop(0, damp ? 'rgba(10,20,26,0.3)' : 'rgba(0,0,0,0.26)');
      stain.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = stain;
      c.fillRect(0, 0, inner, inner);
    }

    if (rand() < 0.45) {
      c.beginPath();
      let kx = rand() * inner;
      let ky = rand() * inner * 0.3;
      const crackPoints = [[kx, ky]];
      c.moveTo(kx, ky);
      const steps = 3 + Math.floor(rand() * 3);
      for (let s = 0; s < steps; s++) {
        kx = clamp(kx + (rand() - 0.5) * inner * 0.35, 0, inner);
        ky += inner * (0.14 + rand() * 0.12);
        c.lineTo(kx, ky);
        crackPoints.push([kx, ky]);
      }
      const branch = crackPoints[1 + Math.floor(rand() * (crackPoints.length - 1))];
      c.moveTo(branch[0], branch[1]);
      c.lineTo(branch[0] + (rand() - 0.5) * inner * 0.4, branch[1] + inner * 0.15);
      c.strokeStyle = 'rgba(3,2,6,0.75)';
      c.lineWidth = Math.max(0.7, size * 0.014);
      c.stroke();
      c.translate(Math.max(0.5, size * 0.01), Math.max(0.5, size * 0.01));
      c.strokeStyle = 'rgba(230,222,255,0.08)';
      c.lineWidth = 0.7;
      c.stroke();
      c.translate(-Math.max(0.5, size * 0.01), -Math.max(0.5, size * 0.01));
    }

    const bevel = Math.max(1, Math.round(size * 0.05));
    c.fillStyle = 'rgba(255,255,255,' + (light ? 0.2 : 0.14) + ')';
    c.fillRect(0, 0, inner, bevel);
    c.fillRect(0, 0, bevel, inner);
    c.fillStyle = 'rgba(0,0,0,0.42)';
    c.fillRect(0, inner - bevel, inner, bevel);
    c.fillRect(inner - bevel, 0, bevel, inner);

    if (rand() < 0.4) {
      const corner = Math.floor(rand() * 4);
      const chip = inner * (0.1 + rand() * 0.12);
      const cx = corner & 1 ? inner : 0;
      const cy = corner & 2 ? inner : 0;
      const dx = corner & 1 ? -1 : 1;
      const dy = corner & 2 ? -1 : 1;
      c.fillStyle = boss ? '#0C0409' : '#07060B';
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + dx * chip, cy);
      c.lineTo(cx + dx * chip * 0.3, cy + dy * chip * 0.45);
      c.lineTo(cx, cy + dy * chip);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.14)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(cx + dx * chip, cy);
      c.lineTo(cx + dx * chip * 0.3, cy + dy * chip * 0.45);
      c.lineTo(cx, cy + dy * chip);
      c.stroke();
    }
    c.restore();
    return cv;
  }

  function tileSet(sizePx) {
    let set = tileCache[sizePx];
    if (set) return set;
    set = { dark: [], light: [], bossDark: [], bossLight: [] };
    for (let i = 0; i < TILE_VARIANTS; i++) {
      set.dark.push(makeTileTexture(sizePx, false, false, i + 1));
      set.light.push(makeTileTexture(sizePx, true, false, i + 11));
      set.bossDark.push(makeTileTexture(sizePx, false, true, i + 21));
      set.bossLight.push(makeTileTexture(sizePx, true, true, i + 31));
    }
    tileCache[sizePx] = set;
    return set;
  }

  function drawFloor(px, py, x, y, maze) {
    const set = tileSet(Math.max(8, Math.round(tile * dpr)));
    const boss = inRoom(maze.bossRoom, x, y);
    const light = ((x + y) & 1) === 0;
    const list = boss ? (light ? set.bossLight : set.bossDark) : (light ? set.light : set.dark);
    ctx.drawImage(list[(hash(x, y) >> 3) % TILE_VARIANTS], px, py, tile + 0.6, tile + 0.6);
  }

  function drawCells(state) {
    const maze = state.maze;
    const radius = G.CFG.lightRadius;
    const player = state.players[0];
    const halfX = cssW / 2 / tile;
    const halfY = cssH / 2 / tile;
    const x0 = Math.max(0, Math.floor(camX - halfX) - 1);
    const x1 = Math.min(maze.w - 1, Math.ceil(camX + halfX) + 1);
    const y0 = Math.max(0, Math.floor(camY - halfY) - 1);
    const y1 = Math.min(maze.h - 1, Math.ceil(camY + halfY) + 1);

    const mx0 = Math.max(0, Math.floor(player.x - radius - 1));
    const mx1 = Math.min(maze.w - 1, Math.ceil(player.x + radius + 1));
    const my0 = Math.max(0, Math.floor(player.y - radius - 1));
    const my1 = Math.min(maze.h - 1, Math.ceil(player.y + radius + 1));
    for (let y = my0; y <= my1; y++) {
      for (let x = mx0; x <= mx1; x++) {
        if (Math.hypot(x - player.x, y - player.y) <= radius + 0.5) explored[y * maze.w + x] = 1;
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const index = y * maze.w + x;
        const light = lightAt(x + 0.5, y + 0.5);
        const alpha = Math.max(explored[index] ? EXPLORED_ALPHA : 0, light);
        if (alpha < 0.01) continue;
        ctx.globalAlpha = Math.min(1, alpha);
        const px = sxOf(x);
        const py = syOf(y);
        if (maze.grid[index] === 1) drawWall(px, py, x, y, maze);
        else drawFloor(px, py, x, y, maze);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLightOverlay(now) {
    const lx = sxOf(lightX);
    const ly = syOf(lightY);
    const radius = G.CFG.lightRadius * tile;

    ctx.globalCompositeOperation = 'lighter';
    const warm = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius * 1.35);
    warm.addColorStop(0, rgba(colors().player, 0.2 * flick));
    warm.addColorStop(0.5, rgba('#8A5A2B', 0.07 * flick));
    warm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(lx - radius * 1.4, ly - radius * 1.4, radius * 2.8, radius * 2.8);
    ctx.globalCompositeOperation = 'source-over';

    const dark = ctx.createRadialGradient(lx, ly, radius * 0.5, lx, ly, radius * 1.9);
    dark.addColorStop(0, 'rgba(7,6,11,0)');
    dark.addColorStop(0.45, 'rgba(7,6,11,0.3)');
    dark.addColorStop(1, 'rgba(7,6,11,0.55)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawTargets(ui, now) {
    const targets = ui.targets || [];
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    const blood = colors().blood;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const px = sxOf(target.x);
      const py = syOf(target.y);
      if (px < -tile || py < -tile || px > cssW || py > cssH) continue;
      const inset = 2;
      if (target.capture) {
        ctx.fillStyle = rgba(blood, 0.3 + 0.28 * pulse);
        ctx.fillRect(px + inset, py + inset, tile - inset * 2, tile - inset * 2);
        ctx.strokeStyle = rgba('#FF3B6B', 0.75 + 0.25 * pulse);
        ctx.lineWidth = 2;
        ctx.strokeRect(px + inset + 1, py + inset + 1, tile - inset * 2 - 2, tile - inset * 2 - 2);
        ctx.beginPath();
        const pad = tile * 0.28;
        ctx.moveTo(px + pad, py + pad);
        ctx.lineTo(px + tile - pad, py + tile - pad);
        ctx.moveTo(px + tile - pad, py + pad);
        ctx.lineTo(px + pad, py + tile - pad);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(blood, 0.2 + 0.14 * pulse);
        ctx.fillRect(px + inset, py + inset, tile - inset * 2, tile - inset * 2);
        ctx.strokeStyle = rgba('#FF3B6B', 0.45 + 0.25 * pulse);
        ctx.lineWidth = 1;
        ctx.strokeRect(px + inset + 0.5, py + inset + 0.5, tile - inset * 2 - 1, tile - inset * 2 - 1);
        ctx.fillStyle = rgba('#FF3B6B', 0.35 + 0.3 * pulse);
        ctx.beginPath();
        ctx.arc(px + tile / 2, py + tile / 2, tile * 0.07, 0, TAU);
        ctx.fill();
      }
    }
    if (ui.hover) {
      const px = sxOf(ui.hover.x);
      const py = syOf(ui.hover.y);
      ctx.fillStyle = rgba(colors().player, 0.08);
      ctx.fillRect(px, py, tile, tile);
      ctx.strokeStyle = rgba(colors().player, 0.85);
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
    }
  }

  function drawGhostBody(sx, sy, r, color, alpha, now, seed) {
    const t = now * 0.006 + seed;
    const cx = sx + Math.sin(now * 0.003 + seed) * r * 0.08;
    const cy = sy + Math.sin(now * 0.004 + seed) * r * 0.1;

    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
    glow.addColorStop(0, rgba(color, 0.38 * alpha));
    glow.addColorStop(1, rgba(color, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const base = cy + r * 0.95;
    const teeth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0, false);
    ctx.lineTo(cx + r, base);
    for (let i = 1; i <= teeth; i++) {
      const fx = cx + r - (2 * r * i) / teeth;
      const fy = base + Math.sin(t * 1.4 + i * 1.3) * r * 0.16 + (i % 2 === 0 ? 0 : r * 0.16);
      ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    const body = ctx.createLinearGradient(cx, cy - r * 1.1, cx, base + r * 0.3);
    body.addColorStop(0, rgba(color, 0.95 * alpha));
    body.addColorStop(0.6, rgba(color, 0.55 * alpha));
    body.addColorStop(1, rgba(color, 0.12 * alpha));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = rgba('#E9FFFB', 0.45 * alpha);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const eyeAlpha = alpha * alpha;
    const eyeX = r * 0.36;
    const eyeY = cy - r * 0.15;
    ctx.fillStyle = rgba('#07060B', 0.88 * eyeAlpha);
    ctx.beginPath();
    ctx.ellipse(cx - eyeX, eyeY, r * 0.17, r * 0.25, 0, 0, TAU);
    ctx.ellipse(cx + eyeX, eyeY, r * 0.17, r * 0.25, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#E9FFFB', 0.9 * eyeAlpha);
    ctx.beginPath();
    ctx.arc(cx - eyeX, eyeY, r * 0.06, 0, TAU);
    ctx.arc(cx + eyeX, eyeY, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return { cx: cx, cy: cy };
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

  function drawBoss(enemy, visual, now) {
    const cx0 = sxOf(visual.x + 0.5);
    const cy0 = syOf(visual.y + 0.5);
    if (cx0 < -tile * 4 || cy0 < -tile * 4 || cx0 > cssW + tile * 4 || cy0 > cssH + tile * 4) return;
    const light = lightAt(visual.x + 0.5, visual.y + 0.5);
    const alpha = 0.15 + 0.85 * sstep((light - 0.15) / 0.6);
    const radius = tile * 0.68;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + enemy.id);
    const blood = colors().blood;

    const auraAlpha = (0.25 + 0.75 * light) * (0.55 + 0.35 * pulse);
    const aura = ctx.createRadialGradient(cx0, cy0, radius * 0.3, cx0, cy0, radius * 3.4);
    aura.addColorStop(0, rgba(blood, 0.6 * auraAlpha));
    aura.addColorStop(0.5, rgba(blood, 0.2 * auraAlpha));
    aura.addColorStop(1, rgba(blood, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx0, cy0, radius * 3.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const invulnerable = now < (enemy.invulnUntil || 0);
    const blink = invulnerable ? (Math.floor(now / 70) % 2 ? 0.35 : 0.8) : 1;
    const bodyColor = invulnerable ? '#F2B8C6' : '#D63A62';
    const entry = G.bestiary && G.bestiary.forEnemy(enemy);
    let center = { cx: cx0, cy: cy0 };
    let barLift = radius * 1.4;
    if (drawMonster(enemy, cx0, cy0, alpha * blink, invulnerable ? '#F2B8C6' : null, now)) {
      barLift = (tile * entry.scale) / 2;
    } else {
      center = drawGhostBody(cx0, cy0, radius, bodyColor, alpha * blink, now, enemy.id * 1.7);
      ctx.font = Math.round(radius * 1.05) + 'px ' + FONT_GLYPH;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba('#07060B', 0.7 * alpha * blink);
      ctx.fillText((G.PIECE_GLYPH[bossPiece(enemy)] || '♛') + '︎', center.cx, center.cy + radius * 0.5);
    }

    if (light > 0.25) {
      const width = tile * 1.9;
      const x = center.cx - width / 2;
      const y = center.cy - barLift - 14;
      const fraction = clamp(enemy.hp / (enemy.maxHp || 1), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 2, y - 2, width + 4, 11);
      const bar = ctx.createLinearGradient(x, y, x, y + 7);
      bar.addColorStop(0, '#FF5A82');
      bar.addColorStop(1, blood);
      ctx.fillStyle = bar;
      ctx.fillRect(x, y, width * fraction, 7);
      ctx.fillStyle = 'rgba(7,6,11,0.8)';
      for (let i = 1; i < enemy.maxHp; i++) ctx.fillRect(x + (width * i) / enemy.maxHp - 0.75, y, 1.5, 7);
      ctx.strokeStyle = rgba('#FF8AA6', 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2, y - 2, width + 4, 11);
      setSpacing(2);
      ctx.font = '600 ' + Math.round(tile * 0.24) + 'px ' + FONT_SERIF;
      ctx.fillStyle = rgba('#F6D2DA', 0.95 * light);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText((enemy.name || 'JEFE').toUpperCase(), center.cx + 1, y - 7);
      setSpacing(0);
    }
  }

  function drawEnemy(enemy, visual, now) {
    const sx = sxOf(visual.x + 0.5);
    const sy = syOf(visual.y + 0.5);
    if (sx < -tile * 2 || sy < -tile * 2 || sx > cssW + tile * 2 || sy > cssH + tile * 2) return;
    const light = lightAt(visual.x + 0.5, visual.y + 0.5);
    let alpha = 0.15 + 0.85 * sstep((light - 0.15) / 0.6);
    const wraith = enemy.kind === 'wraith';
    if (wraith) alpha *= 0.78;
    if (drawMonster(enemy, sx, sy, alpha, null, now)) return;
    drawGhostBody(sx, sy, tile * 0.34, wraith ? WRAITH_COLOR : colors().ghost, alpha, now, enemy.id * 2.3);
  }

  function drawMonster(enemy, sx, sy, alpha, tint, now) {
    const entry = G.bestiary && G.bestiary.forEnemy(enemy);
    if (!entry) return false;
    const img = G.bestiary.image(entry.id, tint, G.bestiary.frameOf(entry, enemy, now));
    if (!img) return false;
    const size = tile * entry.scale;
    const bob = entry.float ? Math.sin(now * 0.003 + enemy.id * 1.9) * tile * 0.05 : 0;
    const glowR = size * 0.75;
    const glow = ctx.createRadialGradient(sx, sy, glowR * 0.15, sx, sy, glowR);
    glow.addColorStop(0, rgba(entry.glow, 0.32 * alpha));
    glow.addColorStop(1, rgba(entry.glow, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    ctx.globalCompositeOperation = 'source-over';
    const hurt = now < (enemy.invulnUntil || 0) && enemy.kind !== 'boss';
    ctx.globalAlpha = alpha * (hurt && Math.floor(now / 60) % 2 ? 0.4 : 1);
    ctx.drawImage(img, sx - size / 2, sy - size / 2 + bob, size, size);
    ctx.globalAlpha = 1;
    return true;
  }

  function drawEnemies(state, now, dt) {
    const bosses = [];
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i];
      const visual = visualOf(visEnemies, enemy.id, enemy.x, enemy.y, dt, 90);
      if (enemy.kind === 'boss') bosses.push([enemy, visual]);
      else drawEnemy(enemy, visual, now);
    }
    for (let i = 0; i < bosses.length; i++) drawBoss(bosses[i][0], bosses[i][1], now);
    prune(visEnemies);
  }

  function drawChevron(sx, sy, dx, dy, now) {
    const bob = Math.sin(now * 0.008) * tile * 0.04;
    const distance = tile * 0.6 + bob;
    const cx = sx + dx * distance;
    const cy = sy + dy * distance;
    const tipLen = tile * 0.15;
    const baseLen = tile * 0.1;
    const half = tile * 0.16;
    ctx.beginPath();
    ctx.moveTo(cx + dx * tipLen, cy + dy * tipLen);
    ctx.lineTo(cx - dx * baseLen - dy * half, cy - dy * baseLen + dx * half);
    ctx.lineTo(cx - dx * baseLen + dy * half, cy - dy * baseLen - dx * half);
    ctx.closePath();
    ctx.fillStyle = rgba(colors().player, 0.95);
    ctx.shadowColor = colors().player;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPlayer(player, visual, now) {
    const sx = sxOf(visual.x + 0.5);
    const sy = syOf(visual.y + 0.5);
    const gold = colors().player;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    const invulnerable = now < (player.invulnUntil || 0);
    const blink = invulnerable ? (Math.floor(now / 80) % 2 ? 0.25 : 0.95) : 1;

    ctx.globalAlpha = blink;
    const halo = ctx.createRadialGradient(sx, sy, tile * 0.1, sx, sy, tile * 1.05);
    halo.addColorStop(0, rgba(gold, 0.42 + 0.14 * pulse));
    halo.addColorStop(0.5, rgba(gold, 0.12));
    halo.addColorStop(1, rgba(gold, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, tile * 1.05, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const total = G.CFG.cooldowns[player.piece] || 400;
    const remaining = Math.max(0, (player.cooldownUntil || 0) - now);
    if (remaining > 0) {
      ctx.strokeStyle = rgba(gold, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, tile * 0.46, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(remaining / total, 0, 1)));
      ctx.stroke();
    }

    ctx.font = Math.round(tile * 0.86) + 'px ' + FONT_GLYPH;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = (G.PIECE_GLYPH[player.piece] || '♟') + '︎';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(7,6,11,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(glyph, sx, sy + tile * 0.04);
    ctx.shadowColor = gold;
    ctx.shadowBlur = 18;
    ctx.fillStyle = gold;
    ctx.fillText(glyph, sx, sy + tile * 0.04);
    ctx.shadowBlur = 0;

    if (player.piece === 'pawn') {
      const dir = player.dir && (player.dir.dx || player.dir.dy) ? player.dir : { dx: 0, dy: -1 };
      drawChevron(sx, sy, dir.dx, dir.dy, now);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayers(state, now, dt) {
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const visual = visualOf(visPlayers, player.id, player.x, player.y, dt, 55);
      if (i === 0) {
        lightX = visual.x + 0.5;
        lightY = visual.y + 0.5;
      }
    }
    prune(visPlayers);
  }

  function paintPlayers(state, now) {
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (player.alive === false) continue;
      const visual = visPlayers.get(player.id);
      if (visual) drawPlayer(player, visual, now);
    }
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.32, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) * 0.58);
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

  function heartPath(cx, cy, size) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
    ctx.closePath();
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

  function drawHearts(player, now) {
    const scale = clamp(tile / BASE_TILE, 0.8, 1.1);
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

  function drawWaveInfo(state, player, now) {
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

    ctx.textAlign = 'right';
    setSpacing(2);
    ctx.font = '600 ' + Math.round(clamp(cssW * 0.013, 11, 15)) + 'px ' + FONT_UI;
    ctx.fillStyle = rgba(colors().ghost, 0.75);
    ctx.fillText('ALMAS  ' + (player.kills || 0), cssW - 26, 46);
    setSpacing(0);
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
      const cy = cssH * 0.34;
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

  function fitSize(text, size, maxWidth) {
    ctx.font = '700 ' + size + 'px ' + FONT_SERIF;
    const width = ctx.measureText(text).width;
    return width > maxWidth ? Math.floor(size * (maxWidth / width)) : size;
  }

  function glitchText(text, x, y, size, fill, glow, amount) {
    ctx.font = '700 ' + size + 'px ' + FONT_SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const offset = size * (0.012 + amount * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(colors().blood, 0.75);
    ctx.fillText(text, x - offset, y);
    ctx.fillStyle = rgba(colors().ghost, 0.6);
    ctx.fillText(text, x + offset, y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function ornament(cx, y, halfWidth, color, alpha) {
    const gradient = ctx.createLinearGradient(cx - halfWidth, 0, cx + halfWidth, 0);
    gradient.addColorStop(0, rgba(color, 0));
    gradient.addColorStop(0.5, rgba(color, alpha));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - halfWidth, y, halfWidth * 2, 1.5);
    ctx.fillStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.moveTo(cx, y - 6);
    ctx.lineTo(cx + 6, y + 0.75);
    ctx.lineTo(cx, y + 7.5);
    ctx.lineTo(cx - 6, y + 0.75);
    ctx.closePath();
    ctx.fill();
  }

  function drawTitle(now) {
    if (!wisps) {
      wisps = [];
      for (let i = 0; i < 46; i++) {
        wisps.push({ x: Math.random(), y: Math.random(), speed: 0.4 + Math.random(), phase: Math.random() * TAU, size: 2 + Math.random() * 5, violet: Math.random() < 0.3 });
      }
    }
    const cx = cssW / 2;
    const cy = cssH / 2;
    const breathe = 0.5 + 0.5 * Math.sin(now * 0.0008);

    const backdrop = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, Math.hypot(cssW, cssH) * 0.6);
    backdrop.addColorStop(0, rgba('#2A2040', 0.55 + 0.15 * breathe));
    backdrop.addColorStop(0.5, rgba('#120F1E', 0.8));
    backdrop.addColorStop(1, rgba('#07060B', 1));
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, cssW, cssH);

    const board = Math.max(cssW, cssH) / 14;
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#9684E8';
    const shift = (now * 0.006) % (board * 2);
    for (let row = -1; row < cssH / board + 1; row++) {
      for (let col = -2; col < cssW / board + 2; col++) {
        if ((row + col) & 1) ctx.fillRect(col * board + (row & 1 ? shift : -shift) * 0.5, row * board, board, board);
      }
    }
    ctx.restore();

    ctx.font = Math.round(Math.min(cssW, cssH) * 0.95) + 'px ' + FONT_GLYPH;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(colors().player, 0.035 + 0.02 * breathe);
    ctx.fillText(G.PIECE_GLYPH.knight + '︎', cx, cy + cssH * 0.04);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < wisps.length; i++) {
      const wisp = wisps[i];
      const x = (wisp.x + Math.sin(now * 0.0004 * wisp.speed + wisp.phase) * 0.04) * cssW;
      const y = (((wisp.y - now * 0.00003 * wisp.speed) % 1) + 1) % 1 * cssH;
      const color = wisp.violet ? WRAITH_COLOR : colors().ghost;
      const radius = wisp.size * (0.8 + 0.4 * Math.sin(now * 0.002 + wisp.phase));
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
      glow.addColorStop(0, rgba(color, 0.35));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 5, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const narrow = cssW < 700;
    const lines = narrow ? ['GAMBITO DE', 'SOMBRAS'] : ['GAMBITO DE SOMBRAS'];
    let size = Math.min(cssW * 0.075, 104);
    setSpacing(size * 0.1);
    for (let i = 0; i < lines.length; i++) size = Math.min(size, fitSize(lines[i], size, cssW * 0.9));
    setSpacing(size * 0.1);
    const glitching = Math.sin(now * 0.0017) > 0.985 || (now % 4200) < 140;
    const amount = glitching ? 1 : 0.15;
    const titleY = cy - size * (narrow ? 0.9 : 0.55);
    for (let i = 0; i < lines.length; i++) {
      const y = titleY + i * size * 1.05;
      const gold = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      gold.addColorStop(0, '#F6E9C0');
      gold.addColorStop(0.55, colors().player);
      gold.addColorStop(1, '#8A7448');
      const jitter = glitching ? (Math.random() - 0.5) * size * 0.1 : 0;
      glitchText(lines[i], cx + size * 0.05 + jitter, y, size, gold, 'rgba(201,179,126,0.65)', amount);
    }

    const ornamentY = titleY + (lines.length - 1) * size * 1.05 + size * 0.78;
    ornament(cx, ornamentY, Math.min(cssW * 0.3, 360), colors().player, 0.7);

    const subSize = Math.round(clamp(cssW * 0.0195, 13, 22));
    setSpacing(subSize * 0.28);
    ctx.font = '500 ' + subSize + 'px ' + FONT_SERIF;
    ctx.fillStyle = rgba('#CFC6EE', 0.82);
    ctx.fillText(narrow ? 'UN LABERINTO. SEIS PIEZAS.' : 'UN LABERINTO. SEIS PIEZAS. NINGUNA SALIDA.', cx, ornamentY + subSize * 2.1);
    setSpacing(0);

    const callAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.004));
    const callSize = Math.round(clamp(cssW * 0.0185, 13, 21));
    setSpacing(callSize * 0.18);
    ctx.font = '600 ' + callSize + 'px ' + FONT_UI;
    ctx.fillStyle = rgba(colors().ghost, callAlpha);
    ctx.shadowColor = colors().ghost;
    ctx.shadowBlur = 14 * callAlpha;
    ctx.fillText('clic o Enter para empezar', cx, ornamentY + subSize * 2.1 + callSize * 3.4);
    ctx.shadowBlur = 0;

    setSpacing(1);
    ctx.font = '400 ' + Math.round(clamp(cssW * 0.0105, 10, 13)) + 'px ' + FONT_UI;
    ctx.fillStyle = 'rgba(190,180,225,0.45)';
    ctx.fillText('1-6 cambia de pieza  ·  clic en una casilla para mover o atacar', cx, cssH - 34);
    setSpacing(0);
  }

  function drawEndScreen(state, now) {
    const won = state.phase === 'won';
    const k = sstep((now - phaseSince) / 900);
    const cx = cssW / 2;
    const cy = cssH / 2;
    const main = won ? colors().player : colors().blood;

    ctx.fillStyle = won ? 'rgba(20,16,6,' + 0.55 * k + ')' : 'rgba(18,2,8,' + 0.72 * k + ')';
    ctx.fillRect(0, 0, cssW, cssH);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(cssW, cssH) * 0.5);
    glow.addColorStop(0, rgba(main, 0.28 * k));
    glow.addColorStop(1, rgba(main, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.globalAlpha = k;
    const title = won ? 'LAS SOMBRAS CEDEN' : 'HAS CAÍDO';
    setSpacing(0);
    let size = Math.min(cssW * (won ? 0.075 : 0.115), won ? 96 : 140);
    setSpacing(size * 0.08);
    size = fitSize(title, size, cssW * 0.9);
    setSpacing(size * 0.08);
    const glitching = !won && (now % 3300) < 120;
    const fill = won ? '#F6E9C0' : '#E8335F';
    glitchText(title, cx + size * 0.04, cy - size * 0.35, size, fill, main, glitching ? 1 : 0.2);

    const player = state.players[0];
    const subSize = Math.round(clamp(cssW * 0.02, 13, 22));
    setSpacing(subSize * 0.2);
    ctx.font = '500 ' + subSize + 'px ' + FONT_SERIF;
    ctx.fillStyle = rgba('#E2D9F5', 0.85);
    const sub = won
      ? 'El laberinto queda en silencio  ·  ' + (player.kills || 0) + ' almas'
      : 'OLEADA ' + (state.wave ? state.wave.n : 1) + '  ·  ' + (player.kills || 0) + ' ALMAS';
    ctx.fillText(sub, cx, cy + size * 0.45);

    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.004));
    const callSize = Math.round(clamp(cssW * 0.0185, 13, 21));
    setSpacing(callSize * 0.18);
    ctx.font = '600 ' + callSize + 'px ' + FONT_UI;
    ctx.fillStyle = rgba(won ? colors().player : colors().ghost, pulse);
    ctx.fillText(won ? 'R para jugar de nuevo' : 'R para reintentar', cx, cy + size * 0.45 + callSize * 3);
    ctx.restore();
    setSpacing(0);
  }

  function drawWorld(state, now, ui, dt) {
    const player = state.players[0];
    const visual = visualOf(visPlayers, player.id, player.x, player.y, dt, 55);
    const targetX = visual.x + 0.5;
    const targetY = visual.y + 0.5;
    if (!camReady) {
      camX = targetX;
      camY = targetY;
      camReady = true;
    } else {
      const k = 1 - Math.exp(-dt / 130);
      camX += (targetX - camX) * k;
      camY += (targetY - camY) * k;
    }
    lightX = targetX;
    lightY = targetY;
    flick = 0.93 + 0.045 * Math.sin(now * 0.011) + 0.03 * Math.sin(now * 0.027 + 1.7) + 0.02 * Math.sin(now * 0.071 + 4.2);

    drawCells(state);
    drawLightOverlay(now);
    drawTargets(ui, now);
    drawPlayers(state, now, dt);
    drawEnemies(state, now, dt);
    G.fx.draw(ctx, { x: camX, y: camY, tile: tile, w: cssW, h: cssH });
    G.slash.draw2D(ctx, { x: camX, y: camY, tile: tile, w: cssW, h: cssH }, now);
    paintPlayers(state, now);
  }

  render.draw = function (state, now, ui) {
    if (!ctx) return;
    ui = ui || {};
    frameId++;
    const dt = lastNow ? clamp(now - lastNow, 0, 100) : 16;
    lastNow = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors().void;
    ctx.fillRect(0, 0, cssW, cssH);

    const ready = state && state.maze && state.players && state.players[0] && state.phase !== 'title';
    if (state) {
      syncState(state, now);
      if (state.events && state.events.length) {
        G.fx.ingest(state.events);
        G.slash.ingest(state.events, now);
        if (ready) handleEvents(state, now);
      }
    }
    G.fx.update(dt);

    if (!ready) {
      drawTitle(now);
      drawVignette();
      drawGrain();
      return;
    }

    const shake = G.fx.shake || 0;
    ctx.save();
    if (shake > 0.2) ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
    drawWorld(state, now, ui, dt);
    ctx.restore();

    drawVignette();
    drawGrain();
    G.fx.drawScreen(ctx, canvas);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const player = state.players[0];
    drawHearts(player, now);
    drawWaveInfo(state, player, now);
    drawPieceBar(player, now);
    drawBanners(now);
    if (state.phase === 'dead' || state.phase === 'won') drawEndScreen(state, now);
  };
})();
