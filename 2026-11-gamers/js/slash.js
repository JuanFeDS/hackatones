G.slash = (function () {
  const DURATION_MS = 300;
  const swings = [];

  function ease(progress) {
    return 1 - Math.pow(1 - progress, 3);
  }

  function ingest(events, now) {
    if (!events) return;
    for (const event of events) {
      if (event.type === 'attack') {
        swings.push({ start: now, from: event.from, to: event.to, dir: event.dir, hit: !!event.to });
      }
    }
  }

  function prune(now) {
    for (let index = swings.length - 1; index >= 0; index--) {
      if (now - swings[index].start > DURATION_MS + 60) swings.splice(index, 1);
    }
  }

  function crescent(ctx, cx, cy, radius, angle, progress, alpha) {
    const spread = 1.25;
    const sweepStart = angle - spread;
    const sweepEnd = angle - spread + spread * 2 * ease(Math.min(progress * 1.5, 1));
    const tail = Math.max(sweepStart, sweepEnd - 1.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const layers = [[0.34, 'rgba(179,18,58,'], [0.2, 'rgba(255,200,120,'], [0.08, 'rgba(255,250,235,']];
    for (const [width, color] of layers) {
      ctx.strokeStyle = color + (alpha * 0.85).toFixed(3) + ')';
      ctx.lineWidth = radius * width;
      ctx.shadowColor = 'rgba(255,180,100,' + alpha.toFixed(3) + ')';
      ctx.shadowBlur = radius * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, tail, sweepEnd);
      ctx.stroke();
    }
    ctx.restore();
  }

  function burst(ctx, x, y, size, progress, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ring = size * (0.3 + 0.9 * ease(progress));
    ctx.strokeStyle = 'rgba(255,220,160,' + (alpha * 0.9).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.5, size * 0.07 * (1 - progress));
    ctx.beginPath();
    ctx.arc(x, y, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(179,18,58,' + alpha.toFixed(3) + ')';
    for (let spark = 0; spark < 8; spark++) {
      const angle = (spark / 8) * Math.PI * 2 + 0.3;
      const inner = ring * 0.6;
      const outer = ring * (1.15 + 0.3 * ((spark * 37) % 5) / 5);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw2D(ctx, camera, now) {
    prune(now);
    for (const swing of swings) {
      const progress = (now - swing.start) / DURATION_MS;
      if (progress < 0 || progress > 1) continue;
      const alpha = Math.pow(1 - progress, 1.3);
      const originX = (swing.from.x + 0.5 - camera.x) * camera.tile + camera.w / 2;
      const originY = (swing.from.y + 0.5 - camera.y) * camera.tile + camera.h / 2;
      let angle = Math.atan2(swing.dir.dy, swing.dir.dx);
      let targetX = null;
      let targetY = null;
      if (swing.to) {
        targetX = (swing.to.x + 0.5 - camera.x) * camera.tile + camera.w / 2;
        targetY = (swing.to.y + 0.5 - camera.y) * camera.tile + camera.h / 2;
        angle = Math.atan2(targetY - originY, targetX - originX);
      }
      const reach = swing.to ? Math.min(Math.hypot(targetX - originX, targetY - originY), camera.tile * 4) : camera.tile * 0.9;
      const radius = Math.max(camera.tile * 0.7, Math.min(reach * 0.7, camera.tile * 1.4));
      const centerX = originX + Math.cos(angle) * camera.tile * 0.2;
      const centerY = originY + Math.sin(angle) * camera.tile * 0.2;
      crescent(ctx, centerX, centerY, radius, angle, progress, alpha);
      if (swing.to) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createLinearGradient(originX, originY, targetX, targetY);
        gradient.addColorStop(0, 'rgba(255,240,210,0)');
        gradient.addColorStop(1, 'rgba(255,230,180,' + (alpha * 0.8).toFixed(3) + ')');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = camera.tile * 0.1;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.restore();
        burst(ctx, targetX, targetY, camera.tile * 0.7, progress, alpha);
      }
    }
  }

  function drawBlade(ctx, pivotX, pivotY, angle, length, thickness) {
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    const guardY = -thickness * 3.4;
    const gradient = ctx.createLinearGradient(-thickness, 0, thickness, 0);
    gradient.addColorStop(0, '#4b4a5e');
    gradient.addColorStop(0.45, '#d9dbea');
    gradient.addColorStop(0.55, '#f4f5ff');
    gradient.addColorStop(1, '#5a5870');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(160,170,255,0.55)';
    ctx.shadowBlur = thickness * 1.5;
    ctx.beginPath();
    ctx.moveTo(-thickness, guardY);
    ctx.lineTo(thickness, guardY);
    ctx.lineTo(thickness * 0.8, -length * 0.9);
    ctx.lineTo(0, -length);
    ctx.lineTo(-thickness * 0.8, -length * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(20,18,36,0.55)';
    ctx.lineWidth = Math.max(1, thickness * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, guardY);
    ctx.lineTo(0, -length * 0.92);
    ctx.stroke();
    ctx.fillStyle = '#C9B37E';
    ctx.fillRect(-thickness * 2.6, guardY, thickness * 5.2, thickness * 0.9);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(-thickness * 0.55, guardY + thickness * 0.9, thickness * 1.1, thickness * 4.2);
    ctx.fillStyle = '#C9B37E';
    ctx.beginPath();
    ctx.arc(0, guardY + thickness * 5.4, thickness * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFirstPerson(ctx, width, height, now) {
    prune(now);
    const swing = swings.length ? swings[swings.length - 1] : null;
    const progress = swing ? (now - swing.start) / DURATION_MS : 2;
    const idleAngle = 0.62;
    const raisedAngle = -1.25;
    const length = height * 0.72;
    const thickness = height * 0.034;
    const pivotX = width * 0.8;
    const pivotY = height * 1.08;
    let angle = idleAngle + Math.sin(now * 0.0021) * 0.012;
    if (progress >= 0 && progress < 1) {
      const half = 0.45;
      angle = progress < half
        ? idleAngle + (raisedAngle - idleAngle) * ease(progress / half)
        : raisedAngle + (idleAngle - raisedAngle) * ease((progress - half) / (1 - half));
      if (progress < half + 0.1) {
        const alpha = 1 - progress / (half + 0.1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const radius = length * 0.88;
        const arcStart = -Math.PI / 2 + idleAngle;
        const arcEnd = -Math.PI / 2 + angle;
        for (const [lineWidth, color] of [[thickness * 2.6, 'rgba(179,18,58,'], [thickness * 1.5, 'rgba(255,200,120,'], [thickness * 0.5, 'rgba(255,250,235,']]) {
          ctx.strokeStyle = color + (alpha * 0.75).toFixed(3) + ')';
          ctx.lineWidth = lineWidth;
          ctx.shadowColor = 'rgba(255,170,90,' + alpha.toFixed(3) + ')';
          ctx.shadowBlur = thickness * 3;
          ctx.beginPath();
          ctx.arc(pivotX, pivotY, radius, arcStart, arcEnd, true);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (swing.hit && progress > 0.18 && progress < 0.8) {
        const impact = (progress - 0.18) / 0.62;
        burst(ctx, width * 0.5, height * 0.46, height * 0.16, impact, 1 - impact);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(179,18,58,' + (0.18 * (1 - impact)).toFixed(3) + ')';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
    drawBlade(ctx, pivotX, pivotY, angle, length, thickness);
  }

  return { ingest, draw2D, drawFirstPerson };
})();
