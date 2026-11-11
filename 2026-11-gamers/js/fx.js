(function () {
  'use strict';

  const G = (window.G = window.G || {});
  const TAU = Math.PI * 2;
  const MAX_PARTICLES = 700;

  const fx = (G.fx = {
    shake: 0,
    glitch: 0,
    flash: 0,
    particles: [],
    rings: [],
    trails: []
  });

  let offscreen = null;
  let offCtx = null;

  function palette() {
    return (G.CFG && G.CFG.colors) || { ghost: '#7FE0D0', blood: '#B3123A', player: '#C9B37E' };
  }

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function burst(x, y, count, color, opts) {
    const speed = opts.speed || 2;
    for (let i = 0; i < count; i++) {
      if (fx.particles.length >= MAX_PARTICLES) return;
      const angle = Math.random() * TAU;
      const velocity = speed * (0.25 + Math.random());
      fx.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0,
        max: (opts.life || 700) * (0.6 + Math.random() * 0.8),
        size: (opts.size || 0.07) * (0.5 + Math.random()),
        color: color,
        drag: opts.drag || 2.2,
        rise: opts.rise || 0,
        wob: Math.random() * TAU,
        wobAmp: opts.wob || 0
      });
    }
  }

  function ring(x, y, r0, r1, max, color, width) {
    fx.rings.push({ x: x, y: y, r0: r0, r1: r1, age: 0, max: max, color: color, width: width || 3 });
  }

  function addTrail(x, y, max, delay) {
    fx.trails.push({ x: x, y: y, life: 0, max: max, delay: delay || 0 });
  }

  function hex(color, alpha) {
    const n = parseInt(color.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  fx.reset = function () {
    fx.particles.length = 0;
    fx.rings.length = 0;
    fx.trails.length = 0;
    fx.shake = 0;
    fx.glitch = 0;
    fx.flash = 0;
  };

  fx.ingest = function (events) {
    if (!events || !events.length) return;
    const colors = palette();
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'move': {
          if (!ev.from || !ev.to) break;
          const steps = Math.min(10, Math.max(Math.abs(ev.to.x - ev.from.x), Math.abs(ev.to.y - ev.from.y), 1));
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            addTrail(
              ev.from.x + 0.5 + (ev.to.x - ev.from.x) * t,
              ev.from.y + 0.5 + (ev.to.y - ev.from.y) * t,
              420,
              s * 22
            );
          }
          burst(ev.from.x + 0.5, ev.from.y + 0.5, 4, colors.player, { speed: 0.9, size: 0.04, life: 450, drag: 3 });
          break;
        }
        case 'kill': {
          const boss = ev.kind === 'boss';
          const color = boss ? colors.blood : ev.kind === 'wraith' ? '#B49CFF' : colors.ghost;
          const cx = ev.x + 0.5;
          const cy = ev.y + 0.5;
          burst(cx, cy, boss ? 90 : 30, color, { speed: boss ? 4.2 : 2.4, size: boss ? 0.11 : 0.08, life: 1100, rise: -0.9, wob: 0.6, drag: 1.8 });
          burst(cx, cy, boss ? 30 : 10, '#E9FFFB', { speed: 3, size: 0.03, life: 500, drag: 3 });
          ring(cx, cy, 0.1, boss ? 3.2 : 1.5, boss ? 800 : 480, color, boss ? 5 : 3);
          fx.shake = Math.max(fx.shake, boss ? 20 : 9);
          if (boss) fx.glitch = Math.max(fx.glitch, 0.5);
          break;
        }
        case 'hit': {
          const cx = ev.x + 0.5;
          const cy = ev.y + 0.5;
          burst(cx, cy, 36, colors.blood, { speed: 3.4, size: 0.07, life: 700, drag: 2.4 });
          burst(cx, cy, 14, '#FFFFFF', { speed: 4, size: 0.03, life: 300, drag: 4 });
          ring(cx, cy, 0.2, 2.2, 420, '#FF6B8E', 3);
          fx.shake = Math.max(fx.shake, 8);
          break;
        }
        case 'blocked': {
          const cx = ev.x + 0.5;
          const cy = ev.y + 0.5;
          burst(cx, cy, 14, '#9A94B8', { speed: 2.2, size: 0.035, life: 360, drag: 4 });
          ring(cx, cy, 0.2, 1.2, 280, '#9A94B8', 2);
          fx.shake = Math.max(fx.shake, 3);
          break;
        }
        case 'hurt': {
          burst(ev.x + 0.5, ev.y + 0.5, 34, colors.blood, { speed: 3.2, size: 0.07, life: 800, drag: 2.2 });
          fx.glitch = 1;
          fx.flash = 1;
          fx.shake = Math.max(fx.shake, 14);
          break;
        }
        case 'spawn': {
          const boss = ev.kind === 'boss';
          const color = boss ? colors.blood : colors.ghost;
          const cx = ev.x + 0.5;
          const cy = ev.y + 0.5;
          ring(cx, cy, boss ? 3.5 : 1.4, 0.1, boss ? 900 : 520, color, boss ? 5 : 2);
          burst(cx, cy, boss ? 40 : 12, color, { speed: 1.2, size: 0.06, life: 900, rise: -0.6, wob: 0.5, drag: 1.5 });
          if (boss) {
            fx.shake = Math.max(fx.shake, 12);
            fx.glitch = Math.max(fx.glitch, 0.35);
          }
          break;
        }
        case 'death':
          fx.glitch = 1;
          fx.flash = 1;
          fx.shake = Math.max(fx.shake, 22);
          break;
        case 'win':
          fx.glitch = Math.max(fx.glitch, 0.4);
          fx.shake = Math.max(fx.shake, 10);
          break;
        default:
          break;
      }
    }
  };

  fx.update = function (dtMs) {
    const dt = Math.max(0, Math.min(dtMs || 0, 100));
    const seconds = dt / 1000;

    fx.shake *= Math.exp(-dt / 110);
    if (fx.shake < 0.1) fx.shake = 0;
    fx.glitch = Math.max(0, fx.glitch - dt / 380);
    fx.flash = Math.max(0, fx.flash - dt / 320);

    const particles = fx.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      const damping = Math.exp(-p.drag * seconds);
      p.vx *= damping;
      p.vy = p.vy * damping + p.rise * seconds;
      p.x += p.vx * seconds + Math.cos(p.wob + p.life * 0.006) * p.wobAmp * seconds;
      p.y += p.vy * seconds;
    }

    const rings = fx.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].age += dt;
      if (rings[i].age >= rings[i].max) {
        rings[i] = rings[rings.length - 1];
        rings.pop();
      }
    }

    const trails = fx.trails;
    for (let i = trails.length - 1; i >= 0; i--) {
      const trail = trails[i];
      if (trail.delay > 0) {
        trail.delay -= dt;
        continue;
      }
      trail.life += dt;
      if (trail.life >= trail.max) {
        trails[i] = trails[trails.length - 1];
        trails.pop();
      }
    }
  };

  // camera = { x, y, tile, w, h }: x,y centro en unidades de casilla; w,h en px CSS.
  fx.draw = function (ctx, camera) {
    const colors = palette();
    const tile = camera.tile;
    const halfW = camera.w / 2;
    const halfH = camera.h / 2;
    const toX = function (wx) { return (wx - camera.x) * tile + halfW; };
    const toY = function (wy) { return (wy - camera.y) * tile + halfH; };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < fx.trails.length; i++) {
      const trail = fx.trails[i];
      if (trail.delay > 0) continue;
      const k = 1 - trail.life / trail.max;
      const x = toX(trail.x);
      const y = toY(trail.y);
      ctx.fillStyle = hex(colors.player, 0.16 * k);
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.42 * k + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hex(colors.player, 0.3 * k);
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.16 * k + 1, 0, TAU);
      ctx.fill();
    }

    for (let i = 0; i < fx.rings.length; i++) {
      const r = fx.rings[i];
      const t = r.age / r.max;
      const radius = (r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3))) * tile;
      ctx.strokeStyle = hex(r.color, 0.8 * (1 - t));
      ctx.lineWidth = Math.max(0.5, r.width * (1 - t));
      ctx.beginPath();
      ctx.arc(toX(r.x), toY(r.y), Math.max(0.5, radius), 0, TAU);
      ctx.stroke();
    }

    for (let i = 0; i < fx.particles.length; i++) {
      const p = fx.particles[i];
      const k = 1 - p.life / p.max;
      const x = toX(p.x);
      const y = toY(p.y);
      const radius = p.size * tile * (0.4 + 0.6 * k);
      ctx.fillStyle = hex(p.color, 0.22 * k);
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hex(p.color, Math.min(1, 0.9 * k * k + 0.1));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  };

  function ensureOffscreen(width, height) {
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offCtx = offscreen.getContext('2d');
    }
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }
  }

  function chroma(ctx, canvas, tint, offsetX, alpha) {
    const width = canvas.width;
    const height = canvas.height;
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.globalAlpha = 1;
    offCtx.clearRect(0, 0, width, height);
    offCtx.drawImage(canvas, 0, 0);
    offCtx.globalCompositeOperation = 'multiply';
    offCtx.fillStyle = tint;
    offCtx.fillRect(0, 0, width, height);
    offCtx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(offscreen, offsetX, 0);
  }

  // Efecto de pantalla completa (flash rojo, cortes y aberración cromática). Trabaja en px de dispositivo.
  fx.drawScreen = function (ctx, canvas) {
    if (fx.glitch <= 0.02 && fx.flash <= 0.02) return;
    const width = canvas.width;
    const height = canvas.height;
    const colors = palette();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (fx.glitch > 0.02) {
      const g = Math.min(1, fx.glitch);
      const slices = 3 + Math.floor(g * 7);
      for (let i = 0; i < slices; i++) {
        const sliceY = Math.floor(Math.random() * height);
        const sliceH = Math.max(2, Math.floor(rand(0.006, 0.05) * height));
        const shift = Math.floor(rand(-1, 1) * 0.06 * width * g);
        ctx.drawImage(canvas, 0, sliceY, width, sliceH, shift, sliceY, width, sliceH);
      }
      ensureOffscreen(width, height);
      const offset = Math.max(2, Math.round(width * 0.012 * g));
      chroma(ctx, canvas, '#ff1a3c', offset, 0.5 * g);
      chroma(ctx, canvas, '#19e6ff', -offset, 0.5 * g);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (fx.flash > 0.02) {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.hypot(width, height) * 0.6);
      gradient.addColorStop(0, hex(colors.blood, 0));
      gradient.addColorStop(1, hex(colors.blood, 0.65 * fx.flash));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  };
})();
