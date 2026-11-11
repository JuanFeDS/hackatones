(function () {
  const G = (window.G = window.G || {});

  const C = {
    void: '#07060B',
    wall: '#1E1B2E',
    gold: '#C9B37E',
    goldDark: '#8C7A4C',
    spectral: '#7FE0D0',
    blood: '#B3123A',
    bloodDark: '#5E0A20',
    bloodMid: '#8E0E2E',
    stone: '#3A3150',
    stoneLight: '#5A4C78',
    stoneDark: '#241E33',
    wax: '#E8DDC0',
    waxDark: '#B9A988',
    bone: '#D9CFB4',
    boneDark: '#9C9078',
    rust: '#8A4A2B',
    rustLight: '#B0663A',
    moss: '#4F6B3A',
    mossLight: '#7C9A4E',
    iron: '#4A4656',
    wood: '#3B2618',
    woodLight: '#5A3A22',
    flame: '#FFB24A',
    flameCore: '#FFF1C1',
    root: '#3F2A1C',
    rootLight: '#6A4A30',
    water: '#0E2A2E',
    waterLight: '#2C5A5C',
    ossuary: '#5E5240',
    ossuaryDark: '#2E271D',
    page: '#D8CCAA',
    pageDark: '#A8987A',
    obsidian: '#0B0910',
    obsidianLight: '#3A3450',
    ember: '#FF4060',
    marble: '#8A8696',
    marbleDark: '#16141E'
  };

  const DIRS4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const RASTER_LONG_SIDE = 128;

  function svgDoc(width, height, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width * 2 + '" height="' + height * 2 +
      '" viewBox="0 0 ' + width + ' ' + height + '">' + body + '</svg>';
  }

  function fmt(value) {
    return Math.round(value * 100) / 100;
  }

  const CANDLE_DEFS =
    '<defs><linearGradient id="wax" x1="0" x2="1"><stop offset="0" stop-color="' + C.waxDark + '"/>' +
    '<stop offset=".45" stop-color="' + C.wax + '"/><stop offset="1" stop-color="' + C.waxDark + '"/></linearGradient>' +
    '<radialGradient id="glow"><stop offset="0" stop-color="#FFD27A" stop-opacity=".75"/>' +
    '<stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient></defs>';

  function flamePath(cx, tipY, height, width, fill) {
    const base = tipY + height;
    return '<path d="M' + fmt(cx) + ' ' + fmt(tipY) + ' C' + fmt(cx + width) + ' ' + fmt(tipY + height * 0.5) + ' ' +
      fmt(cx + width * 0.8) + ' ' + fmt(base) + ' ' + fmt(cx) + ' ' + fmt(base) + ' C' + fmt(cx - width * 0.8) + ' ' +
      fmt(base) + ' ' + fmt(cx - width) + ' ' + fmt(tipY + height * 0.5) + ' ' + fmt(cx) + ' ' + fmt(tipY) + 'Z" fill="' + fill + '"/>';
  }

  function candle(cx, baseY, height, width, lean) {
    const top = baseY - height;
    const half = width / 2;
    let out = '<rect x="' + fmt(cx - half) + '" y="' + fmt(top) + '" width="' + fmt(width) + '" height="' + fmt(height) +
      '" rx="' + fmt(half * 0.5) + '" fill="url(#wax)"/>';
    out += '<path d="M' + fmt(cx - half) + ' ' + fmt(top + 1) + ' q-1.2 ' + fmt(height * 0.3) + ' 0 ' + fmt(height * 0.45) +
      ' q1 .6 1.1 -1 z" fill="' + C.wax + '"/>';
    out += '<path d="M' + fmt(cx + half) + ' ' + fmt(top + 1) + ' q1 ' + fmt(height * 0.18) + ' 0 ' + fmt(height * 0.25) +
      ' q-.8 .4 -1 -.8 z" fill="' + C.wax + '"/>';
    out += '<line x1="' + fmt(cx) + '" y1="' + fmt(top) + '" x2="' + fmt(cx + lean * 0.3) + '" y2="' + fmt(top - 1.6) +
      '" stroke="#1A1410" stroke-width=".8"/>';
    out += '<circle cx="' + fmt(cx + lean) + '" cy="' + fmt(top - 4) + '" r="' + fmt(width * 1.9) + '" fill="url(#glow)"/>';
    out += flamePath(cx + lean, top - 1.4 - width * 1.6, width * 1.6, width * 0.55, C.flame);
    out += flamePath(cx + lean * 0.8, top - 1.4 - width * 0.9, width * 0.9, width * 0.28, C.flameCore);
    return out;
  }

  function bone(x1, y1, x2, y2, thick, color, knobColor) {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / length) * thick * 0.42;
    const ny = ((x2 - x1) / length) * thick * 0.42;
    let out = '<line x1="' + fmt(x1) + '" y1="' + fmt(y1) + '" x2="' + fmt(x2) + '" y2="' + fmt(y2) + '" stroke="' + color +
      '" stroke-width="' + fmt(thick) + '" stroke-linecap="round"/>';
    const radius = fmt(thick * 0.58);
    [[x1, y1], [x2, y2]].forEach(function (end) {
      out += '<circle cx="' + fmt(end[0] + nx) + '" cy="' + fmt(end[1] + ny) + '" r="' + radius + '" fill="' + knobColor + '"/>';
      out += '<circle cx="' + fmt(end[0] - nx) + '" cy="' + fmt(end[1] - ny) + '" r="' + radius + '" fill="' + knobColor + '"/>';
    });
    return out;
  }

  function skull(cx, cy, size) {
    const k = size / 30;
    function px(value) { return fmt(cx + value * k); }
    function py(value) { return fmt(cy + value * k); }
    return '<path d="M' + px(0) + ' ' + py(-15) + ' C' + px(-10) + ' ' + py(-15) + ' ' + px(-15) + ' ' + py(-8) + ' ' + px(-15) +
      ' ' + py(0) + ' C' + px(-15) + ' ' + py(5) + ' ' + px(-12) + ' ' + py(8) + ' ' + px(-9) + ' ' + py(10) + ' L' + px(-9) + ' ' +
      py(15) + ' L' + px(9) + ' ' + py(15) + ' L' + px(9) + ' ' + py(10) + ' C' + px(12) + ' ' + py(8) + ' ' + px(15) + ' ' + py(5) +
      ' ' + px(15) + ' ' + py(0) + ' C' + px(15) + ' ' + py(-8) + ' ' + px(10) + ' ' + py(-15) + ' ' + px(0) + ' ' + py(-15) +
      'Z" fill="' + C.bone + '" stroke="' + C.boneDark + '" stroke-width="' + fmt(0.8 * k) + '"/>' +
      '<ellipse cx="' + px(-5.5) + '" cy="' + py(0) + '" rx="' + fmt(3.8 * k) + '" ry="' + fmt(4.4 * k) + '" fill="' + C.void + '"/>' +
      '<ellipse cx="' + px(5.5) + '" cy="' + py(0) + '" rx="' + fmt(3.8 * k) + '" ry="' + fmt(4.4 * k) + '" fill="' + C.void + '"/>' +
      '<path d="M' + px(0) + ' ' + py(4) + ' L' + px(-2.2) + ' ' + py(8.5) + ' L' + px(2.2) + ' ' + py(8.5) + 'Z" fill="' + C.void + '"/>' +
      '<path d="M' + px(-5) + ' ' + py(11) + ' V' + py(15) + ' M' + px(-1.7) + ' ' + py(11) + ' V' + py(15) + ' M' + px(1.7) + ' ' +
      py(11) + ' V' + py(15) + ' M' + px(5) + ' ' + py(11) + ' V' + py(15) + '" stroke="' + C.boneDark + '" stroke-width="' + fmt(0.9 * k) + '"/>' +
      '<path d="M' + px(4) + ' ' + py(-14) + ' l-2 5 l3 3" stroke="' + C.boneDark + '" stroke-width="' + fmt(0.7 * k) + '" fill="none"/>';
  }

  function chainCurve(x0, y0, cx, cy, x1, y1, count, color, width) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
      const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
      const angle = fmt((Math.atan2(dy, dx) * 180) / Math.PI);
      const linkLength = (Math.hypot(x1 - x0, y1 - y0) / count) * 0.72;
      if (i % 2 === 0) {
        out += '<ellipse cx="' + fmt(px) + '" cy="' + fmt(py) + '" rx="' + fmt(linkLength) + '" ry="' + fmt(width * 1.25) +
          '" fill="none" stroke="' + color + '" stroke-width="' + fmt(width) + '" transform="rotate(' + angle + ' ' + fmt(px) + ' ' + fmt(py) + ')"/>';
      } else {
        out += '<rect x="' + fmt(px - linkLength) + '" y="' + fmt(py - width * 0.6) + '" width="' + fmt(linkLength * 2) + '" height="' +
          fmt(width * 1.2) + '" rx="' + fmt(width * 0.6) + '" fill="' + color + '" transform="rotate(' + angle + ' ' + fmt(px) + ' ' + fmt(py) + ')"/>';
      }
    }
    return out;
  }

  const HAND_PATH = 'M-5 0 C-6 -6 -7 -10 -8 -14 L-11 -24 C-11.5 -26 -9.5 -26.5 -9 -24.5 L-6 -16 L-6 -28 C-6 -30 -4 -30 -4 -28 ' +
    'L-3 -17 L-2 -31 C-2 -33 0 -33 0 -31 L0.5 -17 L2 -29 C2.3 -31 4.3 -30.6 4 -28.6 L3.5 -16 L7 -21 C8 -22.5 9.5 -21.5 8.7 -20 ' +
    'L5 -10 C4 -6 4 -3 4 0 Z';

  function hand(x, y, angle, scale) {
    return '<path d="' + HAND_PATH + '" transform="translate(' + x + ' ' + y + ') rotate(' + angle + ') scale(' + scale + ')" ' +
      'fill="#9A8FB0" stroke="#3A3150" stroke-width="1.2"/>';
  }

  // ---------- Suelo (64x64) ----------

  function svgBloodPool(variant) {
    if (variant === 0) {
      return svgDoc(64, 64,
        '<path d="M14 30c2-9 13-13 22-11 9 1 16 7 15 15-1 7-9 9-12 14-3 4-11 6-16 2-4-3-11-2-12-8-1-5 1-9 3-12z" fill="' + C.bloodDark + '"/>' +
        '<path d="M18 31c2-7 11-10 18-8 7 1 12 6 11 12-1 5-7 7-10 10-3 3-9 4-12 1-4-2-8-2-9-6 0-4 1-7 2-9z" fill="' + C.blood + '"/>' +
        '<path d="M24 34c3-4 9-5 13-3" stroke="' + C.bloodDark + '" stroke-width="2" fill="none" opacity=".6"/>' +
        '<ellipse cx="30" cy="27" rx="7" ry="2.3" fill="#E86A86" opacity=".45"/>' +
        '<circle cx="53" cy="21" r="2.4" fill="' + C.bloodMid + '"/><circle cx="57" cy="16" r="1.2" fill="' + C.bloodMid + '"/>' +
        '<circle cx="9" cy="46" r="1.7" fill="' + C.bloodMid + '"/><circle cx="47" cy="54" r="1.3" fill="' + C.bloodMid + '"/>');
    }
    return svgDoc(64, 64,
      '<path d="M6 44c7-5 14-3 20-7s13-10 21-10c6 0 10 4 7 8-4 5-12 4-19 8-7 3-12 9-20 9-7 0-11-4-9-8z" fill="' + C.bloodDark + '"/>' +
      '<path d="M10 44c6-3 12-2 17-6s11-8 18-8c4 0 6 2 4 5-3 3-10 3-16 6-6 3-10 7-17 7-5 0-8-2-6-4z" fill="' + C.blood + '"/>' +
      '<path d="M44 30l9-9M47 32l8-6M41 29l7-11" stroke="' + C.bloodMid + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M50 20c2-1 4 0 4 2s-3 3-4 1z" fill="' + C.blood + '"/>' +
      '<circle cx="18" cy="50" r="1.6" fill="' + C.bloodMid + '"/><circle cx="30" cy="22" r="1.1" fill="' + C.bloodMid + '"/>');
  }

  function svgBones(variant) {
    if (variant === 0) {
      return svgDoc(64, 64,
        '<ellipse cx="32" cy="44" rx="22" ry="7" fill="' + C.void + '" opacity=".45"/>' +
        bone(12, 50, 52, 30, 4.2, C.bone, C.bone) + bone(14, 30, 50, 50, 4.2, C.boneDark, C.boneDark) +
        skull(32, 30, 26));
    }
    let ribs = '';
    for (let i = 0; i < 5; i++) {
      const y = 22 + i * 6;
      ribs += '<path d="M32 ' + y + ' C' + (22 - i) + ' ' + (y - 3) + ' ' + (14 - i) + ' ' + (y + 2) + ' ' + (13 - i) + ' ' + (y + 7) +
        '" stroke="' + C.bone + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
      ribs += '<path d="M32 ' + y + ' C' + (42 + i) + ' ' + (y - 3) + ' ' + (50 + i) + ' ' + (y + 2) + ' ' + (51 + i) + ' ' + (y + 7) +
        '" stroke="' + C.boneDark + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    }
    return svgDoc(64, 64,
      '<ellipse cx="32" cy="40" rx="25" ry="10" fill="' + C.void + '" opacity=".4"/>' +
      '<line x1="32" y1="16" x2="32" y2="52" stroke="' + C.boneDark + '" stroke-width="3" stroke-dasharray="3 1.4"/>' + ribs +
      bone(8, 56, 30, 58, 3.4, C.bone, C.bone) + '<circle cx="52" cy="54" r="2" fill="' + C.boneDark + '"/>' +
      '<path d="M44 12l3 4-4 1z" fill="' + C.bone + '"/>');
  }

  function svgOffering(variant) {
    const tall = variant === 0 ? [20, 13, 9] : [11, 17, 7];
    return svgDoc(64, 64, CANDLE_DEFS +
      '<ellipse cx="32" cy="52" rx="26" ry="8" fill="' + C.void + '" opacity=".55"/>' +
      '<path d="M8 50c4-4 14-5 24-5s20 1 24 5c-2 4-12 6-24 6s-22-2-24-6z" fill="' + C.bloodDark + '"/>' +
      '<path d="M10 50c5-2 13-3 22-3s17 1 22 3" stroke="' + C.gold + '" stroke-width=".8" fill="none" opacity=".6"/>' +
      '<path d="M14 51c3-2 8-2 10 0s-1 3-4 3-7 0-6-3zM36 52c3-2 9-2 12 0s-2 3-6 3-7-1-6-3z" fill="' + C.wax + '" opacity=".85"/>' +
      candle(20, 51, tall[0], 5, -0.6) + candle(32, 50, tall[1], 5.6, 0.4) + candle(44, 52, tall[2], 4.6, 0.8) +
      '<circle cx="53" cy="46" r="2.2" fill="' + C.blood + '"/><path d="M11 45l3 1-2 2z" fill="' + C.bone + '"/>');
  }

  function svgRuneCircle(variant) {
    const ink = variant === 0 ? C.blood : C.spectral;
    let star = '';
    const points = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      points.push([32 + Math.cos(angle) * 20, 32 + Math.sin(angle) * 20]);
    }
    for (let i = 0; i < 8; i++) {
      const target = points[(i + 3) % 8];
      star += 'M' + fmt(points[i][0]) + ' ' + fmt(points[i][1]) + ' L' + fmt(target[0]) + ' ' + fmt(target[1]) + ' ';
    }
    let ticks = '';
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const x0 = 32 + Math.cos(angle) * 24.5;
      const y0 = 32 + Math.sin(angle) * 24.5;
      const x1 = 32 + Math.cos(angle + 0.12) * 27.5;
      const y1 = 32 + Math.sin(angle + 0.12) * 27.5;
      ticks += 'M' + fmt(x0) + ' ' + fmt(y0) + ' L' + fmt(x1) + ' ' + fmt(y1) + ' ' + (i % 3 === 0 ? 'm-1.5 1.5 l3 -1 ' : '');
    }
    const body =
      '<circle cx="32" cy="32" r="29" fill="none" stroke="' + C.void + '" stroke-width="3.2" opacity=".7"/>' +
      '<circle cx="32" cy="32" r="29" fill="none" stroke="' + ink + '" stroke-width="1.6"/>' +
      '<circle cx="32" cy="32" r="23" fill="none" stroke="' + ink + '" stroke-width="1" opacity=".8"/>' +
      '<path d="' + ticks + '" stroke="' + ink + '" stroke-width="1.2" fill="none"/>' +
      '<path d="' + star + '" stroke="' + C.void + '" stroke-width="2.6" fill="none" opacity=".6"/>' +
      '<path d="' + star + '" stroke="' + ink + '" stroke-width="1.1" fill="none" opacity=".9"/>' +
      '<circle cx="32" cy="32" r="5" fill="' + ink + '" opacity=".35"/><circle cx="32" cy="32" r="2" fill="' + ink + '"/>';
    return svgDoc(64, 64, body);
  }

  function svgMossCrack(variant) {
    const crack = variant === 0
      ? 'M4 20 L14 24 L18 32 L28 34 L32 44 L42 46 L48 56 L60 60 M18 32 L12 42 L14 50 M32 44 L36 36 L46 30 L56 30'
      : 'M30 2 L28 12 L34 20 L30 30 L36 40 L32 50 L36 62 M34 20 L44 18 L52 10 M30 30 L20 34 L10 32 L4 38';
    return svgDoc(64, 64,
      '<path d="' + crack + '" stroke="' + C.void + '" stroke-width="4" fill="none" stroke-linejoin="round"/>' +
      '<path d="' + crack + '" stroke="' + C.stoneLight + '" stroke-width="1" fill="none" opacity=".5" transform="translate(.8 .8)"/>' +
      (variant === 0
        ? '<path d="M12 22c2-3 6-2 6 1s-3 5-6 3-2-3 0-4zM26 33c3-2 7 0 6 3-1 4-6 4-8 2s0-4 2-5zM40 44c3-1 6 1 5 4s-5 3-7 1 0-4 2-5z"'
        : '<path d="M27 10c3-2 7 0 6 3s-5 4-7 2 0-4 1-5zM31 28c3-1 6 1 5 4s-5 3-7 1 0-4 2-5zM18 32c2-2 6-1 5 2s-4 3-6 1z"') +
      ' fill="' + C.moss + '"/>' +
      (variant === 0
        ? '<path d="M14 23c1-1 2-1 3 0M28 34c1-1 3-1 3 0M42 45c1-1 2-1 3 0"'
        : '<path d="M28 11c1-1 2-1 3 0M32 29c1-1 2-1 3 0"') + ' stroke="' + C.mossLight + '" stroke-width="1.4" fill="none"/>' +
      '<circle cx="50" cy="12" r="1.4" fill="' + C.mossLight + '" opacity=".7"/><circle cx="8" cy="54" r="1.8" fill="' + C.moss + '"/>');
  }

  function svgFloorChains(variant) {
    const cuff = '<circle cx="50" cy="44" r="7" fill="none" stroke="' + C.rust + '" stroke-width="3"/>' +
      '<circle cx="50" cy="44" r="7" fill="none" stroke="' + C.rustLight + '" stroke-width="1" stroke-dasharray="4 6"/>' +
      '<rect x="46" y="35" width="8" height="3" fill="' + C.iron + '"/>';
    if (variant === 0) {
      return svgDoc(64, 64,
        '<circle cx="10" cy="14" r="5" fill="' + C.iron + '"/><circle cx="10" cy="14" r="2.4" fill="' + C.void + '"/>' +
        chainCurve(12, 16, 14, 46, 44, 40, 9, C.rust, 1.8) + cuff +
        '<path d="M42 50c2 2 2 5 0 7" stroke="' + C.blood + '" stroke-width="1.6" fill="none"/>');
    }
    return svgDoc(64, 64,
      chainCurve(6, 30, 26, 6, 34, 26, 7, C.rust, 1.8) + chainCurve(34, 26, 40, 46, 22, 56, 6, C.iron, 1.7) +
      '<circle cx="20" cy="57" r="3.4" fill="none" stroke="' + C.iron + '" stroke-width="2"/>' + cuff);
  }

  function feather(x, y, angle, length) {
    const vane = 'M0 0 C-5 ' + fmt(-length * 0.3) + ' -5 ' + fmt(-length * 0.75) + ' 0 ' + fmt(-length) +
      ' C4 ' + fmt(-length * 0.7) + ' 5 ' + fmt(-length * 0.3) + ' 0 0Z';
    let barbs = '';
    for (let i = 1; i < 6; i++) {
      const yy = fmt((-length * i) / 6.5);
      barbs += 'M0 ' + yy + ' l-3.6 -2.4 M0 ' + yy + ' l3.4 -2.6 ';
    }
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + angle + ')">' +
      '<path d="' + vane + '" fill="#15121C" stroke="' + C.stone + '" stroke-width=".8"/>' +
      '<path d="' + barbs + '" stroke="' + C.stoneLight + '" stroke-width=".5" opacity=".7"/>' +
      '<path d="M0 3 L0 ' + fmt(-length * 0.95) + '" stroke="' + C.boneDark + '" stroke-width=".9"/>' +
      '<path d="M-2 ' + fmt(-length * 0.55) + ' l-4 2" stroke="' + C.void + '" stroke-width="1.4"/></g>';
  }

  function svgFeathers(variant) {
    if (variant === 0) return svgDoc(64, 64, feather(26, 50, -30, 34) + feather(38, 52, 25, 28) + feather(32, 30, 95, 20));
    return svgDoc(64, 64, feather(20, 46, -70, 26) + feather(44, 40, 140, 30) +
      '<circle cx="34" cy="40" r="1.6" fill="' + C.blood + '"/><circle cx="38" cy="44" r="1" fill="' + C.blood + '"/>');
  }

  function svgEctoplasm(variant) {
    const shape = variant === 0
      ? 'M12 34c0-10 10-16 20-14 6-6 18-2 18 8 6 4 4 14-4 16-2 8-14 10-20 4-8 2-16-4-14-14z'
      : 'M8 40c2-8 12-8 16-14 4-8 16-10 22-4 8 2 12 10 8 16-4 8-14 6-20 10-8 4-18 2-24-2-2-2-3-4-2-6z';
    return svgDoc(64, 64,
      '<defs><radialGradient id="ecto"><stop offset="0" stop-color="' + C.spectral + '" stop-opacity=".9"/>' +
      '<stop offset=".7" stop-color="' + C.spectral + '" stop-opacity=".45"/><stop offset="1" stop-color="' + C.spectral + '" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="32" cy="34" r="30" fill="url(#ecto)" opacity=".35"/>' +
      '<path d="' + shape + '" fill="' + C.spectral + '" opacity=".55"/>' +
      '<path d="' + shape + '" fill="none" stroke="#C8FFF6" stroke-width="1" opacity=".7"/>' +
      '<circle cx="26" cy="30" r="3" fill="none" stroke="#E8FFFB" stroke-width="1" opacity=".8"/>' +
      '<circle cx="38" cy="36" r="2" fill="none" stroke="#E8FFFB" stroke-width=".8" opacity=".8"/>' +
      '<circle cx="34" cy="26" r="1.2" fill="#E8FFFB"/><circle cx="54" cy="18" r="1.6" fill="' + C.spectral + '" opacity=".7"/>' +
      '<circle cx="8" cy="20" r="1.1" fill="' + C.spectral + '" opacity=".7"/>');
  }

  function svgBrokenPiece(variant) {
    if (variant === 0) {
      return svgDoc(64, 64,
        '<ellipse cx="32" cy="46" rx="26" ry="8" fill="' + C.void + '" opacity=".5"/>' +
        '<path d="M8 40 L8 50 L22 50 L22 47 L18 46 L18 44 L22 43 L22 40Z" fill="' + C.stone + '" stroke="' + C.stoneLight + '" stroke-width="1"/>' +
        '<path d="M22 40 L30 41 L28 44 L31 47 L22 47Z" fill="' + C.stoneDark + '"/>' +
        '<path d="M34 38 L44 40 C48 36 56 37 57 44 C56 51 48 52 44 48 L34 49 L36 45Z" fill="' + C.stone + '" stroke="' + C.stoneLight + '" stroke-width="1"/>' +
        '<path d="M48 41 C51 40 54 42 54 44" stroke="' + C.stoneLight + '" stroke-width="1" fill="none"/>' +
        '<path d="M30 54l3-3 3 2-2 3zM40 56l4-2 1 3zM14 56l3-1 1 2-3 1z" fill="' + C.stoneLight + '"/>');
    }
    return svgDoc(64, 64,
      '<ellipse cx="32" cy="48" rx="24" ry="7" fill="' + C.void + '" opacity=".5"/>' +
      '<path d="M18 50 C16 40 20 34 26 30 L22 22 L30 26 C38 22 48 26 50 34 C52 40 46 42 42 40 C40 44 42 48 44 50Z" fill="' + C.gold +
      '" stroke="' + C.goldDark + '" stroke-width="1.2"/>' +
      '<circle cx="40" cy="31" r="1.6" fill="' + C.void + '"/>' +
      '<path d="M26 30 L30 38 L26 44 L30 50" stroke="' + C.void + '" stroke-width="1.6" fill="none"/>' +
      '<path d="M30 50 L44 50 L46 54 L28 54Z" fill="' + C.goldDark + '"/>' +
      '<path d="M50 54l4-3 2 3-3 2zM12 52l3-2 2 2-3 2z" fill="' + C.gold + '"/>');
  }

  function svgCobweb() {
    let threads = '';
    const angles = [0, 15, 32, 50, 68, 90];
    angles.forEach(function (deg) {
      const rad = (deg * Math.PI) / 180;
      threads += 'M0 0 L' + fmt(Math.cos(rad) * 60) + ' ' + fmt(Math.sin(rad) * 60) + ' ';
    });
    let arcs = '';
    [12, 22, 33, 45].forEach(function (radius, ring) {
      for (let i = 0; i < angles.length - 1; i++) {
        const a0 = (angles[i] * Math.PI) / 180;
        const a1 = (angles[i + 1] * Math.PI) / 180;
        const mid = (a0 + a1) / 2;
        const sag = radius * (0.78 + ring * 0.02);
        arcs += 'M' + fmt(Math.cos(a0) * radius) + ' ' + fmt(Math.sin(a0) * radius) + ' Q' + fmt(Math.cos(mid) * sag) + ' ' +
          fmt(Math.sin(mid) * sag) + ' ' + fmt(Math.cos(a1) * radius) + ' ' + fmt(Math.sin(a1) * radius) + ' ';
      }
    });
    return svgDoc(64, 64,
      '<path d="' + threads + '" stroke="#D8D2E6" stroke-width=".8" opacity=".55" fill="none"/>' +
      '<path d="' + arcs + '" stroke="#D8D2E6" stroke-width=".7" opacity=".5" fill="none"/>' +
      '<circle cx="27" cy="23" r="2.4" fill="' + C.void + '"/><circle cx="29" cy="25.5" r="1.6" fill="' + C.void + '"/>' +
      '<path d="M25 21l-3-2M25 23l-4 0M26 25l-3 2M29 21l1-3M30 23l3-2M31 25l3 0" stroke="' + C.void + '" stroke-width=".7"/>' +
      '<circle cx="26.4" cy="22.4" r=".5" fill="' + C.blood + '"/>');
  }

  // ---------- Pared (64x64, vista frontal sobre la cara del muro) ----------

  function svgTorch(variant) {
    const lean = variant === 0 ? -1.5 : 1.8;
    const tall = variant === 0 ? 20 : 17;
    return svgDoc(64, 64,
      '<defs><radialGradient id="tglow"><stop offset="0" stop-color="#FFC266" stop-opacity=".8"/>' +
      '<stop offset=".5" stop-color="#FF8A2A" stop-opacity=".25"/><stop offset="1" stop-color="#FF8A2A" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="32" cy="18" r="22" fill="url(#tglow)"/>' +
      '<rect x="27" y="38" width="10" height="18" rx="1.5" fill="' + C.iron + '" stroke="#2A2733" stroke-width="1"/>' +
      '<circle cx="32" cy="42" r="1.2" fill="' + C.rustLight + '"/><circle cx="32" cy="52" r="1.2" fill="' + C.rustLight + '"/>' +
      '<path d="M32 46 L32 36" stroke="' + C.iron + '" stroke-width="3"/>' +
      '<path d="M29 26 L35 26 L33.5 48 L30.5 48Z" fill="' + C.woodLight + '" stroke="' + C.wood + '" stroke-width="1"/>' +
      '<path d="M25 30 L39 30 L37 36 L27 36Z" fill="' + C.iron + '" stroke="' + C.gold + '" stroke-width=".7" stroke-opacity=".6"/>' +
      '<path d="M28 27c1-2 7-2 8 0" stroke="#1A1410" stroke-width="2" fill="none"/>' +
      flamePath(32 + lean, 26 - tall, tall, 7.5, '#E0561C') +
      flamePath(32 + lean * 0.8, 26 - tall * 0.78, tall * 0.78, 5.6, C.flame) +
      flamePath(32 + lean * 0.5, 26 - tall * 0.45, tall * 0.45, 3, C.flameCore) +
      '<circle cx="' + (36 - lean) + '" cy="' + (8 - lean) + '" r=".9" fill="' + C.flame + '"/>');
  }

  function svgTornBanner(variant) {
    const cloth = variant === 0 ? '#5B0E22' : '#33224E';
    const clothLight = variant === 0 ? '#7E1A33' : '#4A3570';
    return svgDoc(64, 64,
      '<path d="M16 8 L48 8 L48 46 L44 52 L41 45 L37 58 L33 47 L29 54 L25 44 L21 50 L16 42Z" fill="' + cloth + '"/>' +
      '<path d="M20 8 L22 46 M44 8 L42 44" stroke="' + clothLight + '" stroke-width="2" opacity=".6"/>' +
      '<path d="M36 26 L40 30 L37 36 L34 31Z" fill="' + C.void + '"/>' +
      '<path d="M24 14 L27 21 L30 16 L32 22 L34 16 L37 21 L40 14 L38 26 L26 26Z" fill="none" stroke="' + C.gold + '" stroke-width="1.3" opacity=".55"/>' +
      '<path d="M26 30 h12" stroke="' + C.gold + '" stroke-width="1" opacity=".4"/>' +
      '<path d="M22 32c1 4 0 8 1 12" stroke="' + C.bloodDark + '" stroke-width="2.4" opacity=".7" fill="none"/>' +
      '<rect x="10" y="5" width="44" height="3.4" rx="1.6" fill="' + C.rust + '"/>' +
      '<circle cx="10" cy="6.7" r="2.6" fill="' + C.gold + '"/><circle cx="54" cy="6.7" r="2.6" fill="' + C.gold + '"/>');
  }

  function svgWallHands() {
    return svgDoc(64, 64,
      '<path d="M18 50 L24 36 L30 40 L34 28 L40 34 L46 30 L48 44 L42 56 L26 58Z" fill="' + C.void + '"/>' +
      '<path d="M18 50 L24 36 L30 40 L34 28 L40 34 L46 30 L48 44" stroke="' + C.stoneLight + '" stroke-width="1" fill="none" opacity=".5"/>' +
      hand(28, 52, -28, 0.9) + hand(36, 50, 6, 1.05) + hand(43, 54, 40, 0.8) +
      '<path d="M24 22 l1 4 M36 14 l0 5 M48 20 l-1 4" stroke="' + C.blood + '" stroke-width="1.2" opacity=".8"/>');
  }

  function svgHangingChains() {
    return svgDoc(64, 64,
      '<circle cx="18" cy="6" r="3.4" fill="none" stroke="' + C.iron + '" stroke-width="2.2"/>' +
      '<circle cx="44" cy="6" r="3.4" fill="none" stroke="' + C.iron + '" stroke-width="2.2"/>' +
      chainCurve(18, 9, 17, 30, 20, 50, 8, C.rust, 1.7) + chainCurve(44, 9, 46, 24, 42, 38, 6, C.iron, 1.7) +
      '<path d="M20 50 C14 52 14 60 20 60 C26 60 26 54 22 52" stroke="' + C.rust + '" stroke-width="2.6" fill="none"/>' +
      '<path d="M42 38 L42 46 C42 52 50 52 50 46" stroke="' + C.iron + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M49.6 47 c0 3 1.4 5 0 7 c-1.2 -1 -1 -3 0 -7z" fill="' + C.blood + '"/>');
  }

  function svgBloodRunes(variant) {
    const strokes = variant === 0
      ? 'M10 14 L10 40 M10 22 L18 14 M10 28 L18 22 M26 12 L26 42 M26 12 L36 22 L26 30 M42 14 L52 26 L42 38 L52 38 M42 14 L42 38'
      : 'M18 40 L46 40 M20 40 L16 22 L24 30 L32 14 L40 30 L48 22 L44 40 M32 4 L32 12 M28 8 L36 8';
    const drips = variant === 0
      ? 'M10 40 q-1 8 0 14 q1 1 1 -2 q-1 -6 -1 -12 M26 42 q-1 6 0 10 q1 1 1 -2 M52 38 q-1 10 0 18 q1 1 1 -2 M36 22 q1 6 0 9'
      : 'M20 40 q-1 8 0 14 q1 1 1 -2 M32 40 q-1 12 0 18 q1 1 1 -2 M44 40 q-1 6 0 10';
    return svgDoc(64, 64,
      '<path d="' + strokes + '" stroke="' + C.bloodDark + '" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
      '<path d="' + strokes + '" stroke="' + C.blood + '" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + drips + '" stroke="' + C.blood + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="30" cy="56" r="1.2" fill="' + C.bloodMid + '"/><circle cx="56" cy="10" r="1" fill="' + C.bloodMid + '"/>');
  }

  function eye(cx, cy, scale) {
    const k = scale;
    function px(value) { return fmt(cx + value * k); }
    function py(value) { return fmt(cy + value * k); }
    let lashes = '';
    for (let i = -3; i <= 3; i++) {
      lashes += 'M' + px(i * 5) + ' ' + py(-8.5 + Math.abs(i) * 1.4) + ' l' + fmt(i * 1.2 * k) + ' ' + fmt(-5 * k) + ' ';
    }
    return '<path d="M' + px(-20) + ' ' + py(0) + ' Q' + px(0) + ' ' + py(-17) + ' ' + px(20) + ' ' + py(0) + ' Q' + px(0) + ' ' + py(17) +
      ' ' + px(-20) + ' ' + py(0) + 'Z" fill="#CFC6B0" stroke="' + C.void + '" stroke-width="' + fmt(2 * k) + '"/>' +
      '<circle cx="' + px(0) + '" cy="' + py(0) + '" r="' + fmt(7.5 * k) + '" fill="' + C.spectral + '"/>' +
      '<circle cx="' + px(0) + '" cy="' + py(0) + '" r="' + fmt(7.5 * k) + '" fill="none" stroke="#2F7A70" stroke-width="' + fmt(1.4 * k) + '"/>' +
      '<ellipse cx="' + px(0) + '" cy="' + py(0) + '" rx="' + fmt(1.8 * k) + '" ry="' + fmt(6 * k) + '" fill="' + C.void + '"/>' +
      '<circle cx="' + px(2.6) + '" cy="' + py(-2.6) + '" r="' + fmt(1.3 * k) + '" fill="#F4FFFD"/>' +
      '<path d="' + lashes + '" stroke="' + C.void + '" stroke-width="' + fmt(1.4 * k) + '"/>' +
      '<path d="M' + px(-4) + ' ' + py(8) + ' q-1 ' + fmt(10 * k) + ' 0 ' + fmt(16 * k) + ' q1.4 1 1.4 -2 q-0.4 -7 -1.4 -14" fill="' + C.blood + '"/>';
  }

  function svgPaintedEye(variant) {
    if (variant === 0) return svgDoc(64, 64, eye(32, 28, 1.3));
    return svgDoc(64, 64, eye(18, 20, 0.62) + eye(46, 18, 0.7) + eye(32, 40, 0.8));
  }

  function svgCandleNiche() {
    return svgDoc(64, 64, CANDLE_DEFS +
      '<path d="M10 60 L10 26 C10 10 54 10 54 26 L54 60Z" fill="' + C.stoneLight + '"/>' +
      '<path d="M10 60 L10 26 C10 10 54 10 54 26 L54 60" stroke="' + C.stoneDark + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M16 54 L16 28 C16 16 48 16 48 28 L48 54Z" fill="' + C.void + '"/>' +
      '<path d="M18 52 L18 30 C18 20 46 20 46 30" stroke="#2A1A10" stroke-width="3" fill="none" opacity=".8"/>' +
      '<rect x="8" y="53" width="48" height="5" rx="1" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1"/>' +
      '<path d="M22 53c0 3 1 5 0 7M42 53c0 2 1 4 0 6" stroke="' + C.wax + '" stroke-width="2" stroke-linecap="round"/>' +
      candle(24, 53, 12, 4.4, -0.5) + candle(32, 53, 18, 5, 0.3) + candle(41, 53, 8, 4.2, 0.7) +
      '<path d="M30 12 l-2 4 l3 2" stroke="' + C.stoneDark + '" stroke-width="1" fill="none"/>');
  }

  function svgCage() {
    let bars = '';
    for (let i = 0; i < 7; i++) {
      const x = 18 + i * 4.67;
      bars += 'M' + fmt(x) + ' 24 L' + fmt(x) + ' 56 ';
    }
    return svgDoc(64, 64,
      '<line x1="32" y1="0" x2="32" y2="10" stroke="' + C.iron + '" stroke-width="2"/>' +
      '<circle cx="32" cy="12" r="2.6" fill="none" stroke="' + C.rust + '" stroke-width="2"/>' +
      skull(30, 46, 14) +
      '<path d="M16 24 C16 12 48 12 48 24" stroke="' + C.rust + '" stroke-width="2.4" fill="none"/>' +
      '<path d="' + bars + '" stroke="' + C.rust + '" stroke-width="1.8"/>' +
      '<rect x="15" y="22" width="34" height="3" rx="1" fill="' + C.iron + '"/>' +
      '<rect x="14" y="55" width="36" height="4" rx="1.5" fill="' + C.iron + '"/>' +
      '<path d="M38 59 q1 3 0 5" stroke="' + C.blood + '" stroke-width="1.4"/>');
  }

  // ---------- Sala (64x96, objetos altos) ----------

  function svgBrokenColumn() {
    let flutes = '';
    for (let i = 0; i < 4; i++) flutes += 'M' + (24 + i * 5) + ' 40 L' + (24 + i * 5) + ' 82 ';
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="90" rx="26" ry="5" fill="' + C.void + '" opacity=".6"/>' +
      '<rect x="12" y="82" width="40" height="8" rx="1" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1"/>' +
      '<path d="M20 82 L20 36 L24 32 L27 38 L31 28 L35 35 L39 30 L44 38 L44 82Z" fill="' + C.stoneLight + '"/>' +
      '<path d="M20 82 L20 36 L24 32 L27 38 L31 28 L35 35 L39 30 L44 38 L44 82" stroke="' + C.stoneDark + '" stroke-width="1.2" fill="none"/>' +
      '<path d="' + flutes + '" stroke="' + C.stone + '" stroke-width="1.6"/>' +
      '<path d="M38 44 L34 54 L38 60 L33 70" stroke="' + C.void + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M20 70c3-2 6 0 6 3s-4 5-6 4zM40 80c2-3 6-2 6 1s-3 3-6 1z" fill="' + C.moss + '"/>' +
      '<path d="M48 86 L56 80 L62 86 L56 90Z" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1"/>' +
      '<path d="M4 88 L8 84 L12 88Z" fill="' + C.stone + '"/>');
  }

  function svgStatue(variant) {
    const pedestal = '<ellipse cx="32" cy="91" rx="24" ry="4" fill="' + C.void + '" opacity=".6"/>' +
      '<rect x="12" y="78" width="40" height="12" rx="1.5" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1"/>' +
      '<path d="M14 82 h36" stroke="' + C.gold + '" stroke-width=".8" opacity=".5"/>';
    const crack = '<path d="M34 30 L30 42 L35 52 L31 66 L34 78" stroke="' + C.void + '" stroke-width="1.6" fill="none"/>' +
      '<path d="M34 30 L30 42 L35 52 L31 66 L34 78" stroke="' + C.spectral + '" stroke-width=".6" fill="none" opacity=".7"/>';
    if (variant === 0) {
      return svgDoc(64, 96, pedestal +
        '<path d="M18 78 L22 72 L24 50 L20 46 L44 46 L40 50 L42 72 L46 78Z" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1.2"/>' +
        '<rect x="18" y="42" width="28" height="5" rx="1" fill="' + C.stone + '"/>' +
        '<path d="M22 42 C18 30 24 22 32 22 C40 22 46 30 42 42Z" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1.2"/>' +
        '<path d="M29 22 L29 16 L24 16 L24 11 L29 11 L29 5 L35 5 L35 11 L40 11 L40 16 L35 16 L35 22Z" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1"/>' +
        '<path d="M40 11 L40 16 L37 16Z" fill="' + C.void + '"/>' + crack);
    }
    return svgDoc(64, 96, pedestal +
      '<path d="M16 78 C16 64 22 56 28 50 C22 48 14 50 12 44 C10 38 18 24 26 18 L24 8 L32 14 C44 12 52 24 52 40 C52 56 46 66 48 78Z" fill="' +
      C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1.2"/>' +
      '<path d="M30 16 C38 18 44 24 46 34" stroke="' + C.stone + '" stroke-width="3" fill="none"/>' +
      '<circle cx="24" cy="30" r="2" fill="' + C.void + '"/><circle cx="24" cy="30" r=".8" fill="' + C.blood + '"/>' +
      '<path d="M14 42 l4 0" stroke="' + C.void + '" stroke-width="1.4"/>' +
      '<path d="M40 24 L44 30 L40 32Z" fill="' + C.void + '"/>' + crack);
  }

  function svgCoffin(variant) {
    if (variant === 0) {
      return svgDoc(64, 96,
        '<ellipse cx="32" cy="91" rx="20" ry="4" fill="' + C.void + '" opacity=".6"/>' +
        '<path d="M24 4 L40 4 L52 26 L42 90 L22 90 L12 26Z" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.6"/>' +
        '<path d="M26 8 L38 8 L48 27 L39 86 L25 86 L16 27Z" fill="' + C.woodLight + '"/>' +
        '<path d="M22 40 L44 40 M20 60 L42 60 M24 78 L40 78" stroke="' + C.wood + '" stroke-width="1"/>' +
        '<path d="M30 22 L34 22 L34 32 L42 32 L42 36 L34 36 L34 58 L30 58 L30 36 L22 36 L22 32 L30 32Z" fill="' + C.gold + '" opacity=".75"/>' +
        '<circle cx="18" cy="27" r="1.2" fill="' + C.gold + '"/><circle cx="46" cy="27" r="1.2" fill="' + C.gold + '"/>' +
        '<circle cx="24" cy="86" r="1.2" fill="' + C.gold + '"/><circle cx="40" cy="86" r="1.2" fill="' + C.gold + '"/>' +
        '<path d="M44 40 L52 30 L50 44Z" fill="' + C.void + '"/>' +
        '<path d="M45 42 c3 0 6 -2 7 -5" stroke="#9A8FB0" stroke-width="1.6" fill="none"/>');
    }
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="91" rx="24" ry="4" fill="' + C.void + '" opacity=".6"/>' +
      '<rect x="10" y="8" width="44" height="82" rx="14" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1.6"/>' +
      '<rect x="14" y="12" width="36" height="74" rx="11" fill="' + C.stoneLight + '"/>' +
      '<ellipse cx="32" cy="26" rx="7" ry="8" fill="' + C.stone + '"/>' +
      '<path d="M27 25 h3 M34 25 h3" stroke="' + C.void + '" stroke-width="1.4"/>' +
      '<path d="M20 50 L32 42 L44 50 M20 44 L32 52 L44 44" stroke="' + C.stone + '" stroke-width="3" fill="none"/>' +
      '<path d="M24 60 L24 82 M32 58 L32 84 M40 60 L40 82" stroke="' + C.stone + '" stroke-width="1.2"/>' +
      '<path d="M14 66 L50 58" stroke="' + C.void + '" stroke-width="2"/>' +
      '<path d="M22 34 h20" stroke="' + C.gold + '" stroke-width="1" opacity=".5"/>');
  }

  function svgClock() {
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="92" rx="20" ry="3.4" fill="' + C.void + '" opacity=".6"/>' +
      '<path d="M16 14 C16 4 48 4 48 14 L48 38 L16 38Z" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.4"/>' +
      '<rect x="20" y="38" width="24" height="40" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.4"/>' +
      '<rect x="14" y="78" width="36" height="12" rx="1" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.4"/>' +
      '<circle cx="32" cy="22" r="11" fill="#CFC6B0" stroke="' + C.gold + '" stroke-width="2"/>' +
      '<path d="M32 13 v2 M41 22 h-2 M32 31 v-2 M23 22 h2" stroke="' + C.void + '" stroke-width="1.2"/>' +
      '<path d="M32 22 L27 17 M32 22 L34 30" stroke="' + C.void + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M36 13 L33 20 L38 24" stroke="' + C.void + '" stroke-width=".7" fill="none"/>' +
      '<rect x="24" y="42" width="16" height="32" rx="2" fill="' + C.void + '"/>' +
      '<line x1="32" y1="42" x2="35" y2="64" stroke="' + C.gold + '" stroke-width="1"/>' +
      '<circle cx="35" cy="66" r="3.4" fill="' + C.gold + '"/>' +
      '<path d="M26 46 L38 56" stroke="#9A8FB0" stroke-width=".6" opacity=".5"/>' +
      '<circle cx="18" cy="12" r="1.8" fill="' + C.gold + '"/><circle cx="46" cy="12" r="1.8" fill="' + C.gold + '"/>' +
      '<path d="M28 4 L32 0 L36 4" stroke="' + C.gold + '" stroke-width="1.2" fill="none"/>');
  }

  function svgGiantBoard() {
    let squares = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const fill = (row + col) % 2 === 0 ? C.stoneLight : C.stoneDark;
        squares += '<rect x="' + (8 + col * 6) + '" y="' + (8 + row * 6) + '" width="6" height="6" fill="' + fill + '"/>';
      }
    }
    return svgDoc(64, 64,
      '<rect x="4" y="4" width="56" height="56" fill="' + C.stoneDark + '" stroke="' + C.void + '" stroke-width="2"/>' + squares +
      '<rect x="8" y="8" width="48" height="48" fill="none" stroke="' + C.gold + '" stroke-width="1" opacity=".55"/>' +
      '<path d="M8 20 L20 30 L28 26 L40 44 L56 48" stroke="' + C.void + '" stroke-width="1.6" fill="none"/>' +
      '<rect x="32" y="14" width="6" height="6" fill="' + C.blood + '" opacity=".55"/>' +
      '<rect x="20" y="44" width="6" height="6" fill="' + C.spectral + '" opacity=".25"/>');
  }

  function svgAltar() {
    return svgDoc(64, 96, CANDLE_DEFS +
      '<ellipse cx="32" cy="91" rx="30" ry="4" fill="' + C.void + '" opacity=".6"/>' +
      '<rect x="8" y="56" width="48" height="34" rx="1" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1.4"/>' +
      '<rect x="4" y="50" width="56" height="8" rx="1" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1.2"/>' +
      '<path d="M10 58 L54 58 L52 76 L48 70 L44 80 L40 70 L34 84 L30 70 L24 78 L20 70 L14 76Z" fill="' + C.bloodDark + '"/>' +
      '<path d="M10 58 L54 58 L53 64 L11 64Z" fill="' + C.blood + '"/>' +
      '<path d="M24 70 L28 66 L32 72 L36 66 L40 70" stroke="' + C.blood + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M18 80 l0 6 M32 82 l0 6 M46 80 l0 6" stroke="' + C.blood + '" stroke-width="1.2" opacity=".8"/>' +
      skull(32, 42, 16) + candle(12, 50, 16, 4.6, -0.5) + candle(52, 50, 12, 4.4, 0.6) + candle(44, 50, 7, 4, 0.3) +
      '<path d="M18 50c2-3 6-3 8 0" fill="' + C.blood + '"/>');
  }

  function svgUrn(variant) {
    const body = 'M24 30 C14 38 12 58 20 72 C22 78 24 80 26 82 L38 82 C40 80 42 78 44 72 C52 58 50 38 40 30Z';
    if (variant === 0) {
      return svgDoc(64, 96,
        '<ellipse cx="32" cy="90" rx="18" ry="4" fill="' + C.void + '" opacity=".6"/>' +
        '<rect x="24" y="82" width="16" height="7" rx="1" fill="' + C.stoneDark + '"/>' +
        '<path d="' + body + '" fill="' + C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1.4"/>' +
        '<path d="M18 46 h28 M16 60 h32" stroke="' + C.gold + '" stroke-width="2" opacity=".7"/>' +
        '<path d="M26 52 l3 -4 l3 4 l3 -4 l3 4" stroke="' + C.gold + '" stroke-width="1" fill="none" opacity=".6"/>' +
        '<rect x="23" y="24" width="18" height="6" rx="1" fill="' + C.stoneLight + '"/>' +
        '<path d="M26 24 C26 16 38 16 38 24Z" fill="' + C.stoneLight + '"/><circle cx="32" cy="15" r="2.4" fill="' + C.gold + '"/>');
    }
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="90" rx="26" ry="5" fill="' + C.void + '" opacity=".6"/>' +
      '<path d="M40 86c6-2 14-1 20 2-6 3-14 3-20 1z" fill="#8F8A93"/>' +
      '<rect x="24" y="82" width="16" height="7" rx="1" fill="' + C.stoneDark + '"/>' +
      '<path d="M24 30 C14 38 12 58 20 72 C22 78 24 80 26 82 L38 82 C40 80 42 78 44 72 C46 66 47 60 48 56 L40 52 L44 44 L38 40 L42 34 L40 30Z" fill="' +
      C.stone + '" stroke="' + C.stoneDark + '" stroke-width="1.4"/>' +
      '<path d="M18 46 h22 M16 60 h28" stroke="' + C.gold + '" stroke-width="2" opacity=".7"/>' +
      '<path d="M40 52 L44 44 L38 40" stroke="' + C.void + '" stroke-width="2" fill="none"/>' +
      '<path d="M44 74c3 2 6 6 4 12" stroke="#8F8A93" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 70 L56 66 L58 72Z" fill="' + C.stone + '"/>' +
      '<rect x="23" y="24" width="18" height="6" rx="1" fill="' + C.stoneLight + '"/>');
  }

  function svgCandelabra() {
    return svgDoc(64, 96, CANDLE_DEFS +
      '<ellipse cx="32" cy="91" rx="16" ry="3" fill="' + C.void + '" opacity=".6"/>' +
      '<path d="M20 90 L32 80 L44 90" stroke="' + C.iron + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<line x1="32" y1="80" x2="32" y2="34" stroke="' + C.iron + '" stroke-width="3"/>' +
      '<circle cx="32" cy="56" r="3" fill="' + C.iron + '"/>' +
      '<path d="M14 30 C14 42 50 42 50 30" stroke="' + C.iron + '" stroke-width="2.6" fill="none"/>' +
      '<path d="M10 30 h8 M28 32 h8 M46 30 h8" stroke="' + C.gold + '" stroke-width="2.4" opacity=".8"/>' +
      candle(14, 30, 12, 4.4, -0.5) + candle(32, 32, 16, 4.8, 0.4) + candle(50, 30, 9, 4.2, 0.6) +
      '<path d="M14 30c0 4 1 6 0 9M50 30c0 3 1 5 0 7" stroke="' + C.wax + '" stroke-width="1.6" stroke-linecap="round"/>');
  }

  // ---------- Exclusivos de tema ----------

  function svgRootsWall() {
    const roots = [
      ['M28 10 C26 22 30 30 24 42 C20 50 22 56 18 63', 4.2],
      ['M37 11 C41 24 36 34 42 44 C46 52 44 58 48 63', 3.4],
      ['M32 13 C32 26 29 36 33 52', 2.4],
      ['M24 9 C16 14 12 22 6 26', 2.6]
    ];
    let body = '<path d="M18 8 L26 2 L40 3 L47 9 L43 16 L30 18 L21 14Z" fill="' + C.void + '"/>' +
      '<path d="M18 8 L26 2 L40 3 L47 9" stroke="' + C.stoneLight + '" stroke-width="1" fill="none" opacity=".5"/>' +
      '<path d="M47 9 L54 6 M21 14 L14 18 L10 16" stroke="' + C.void + '" stroke-width="1.4" fill="none"/>';
    roots.forEach(function (root) {
      body += '<path d="' + root[0] + '" stroke="' + C.root + '" stroke-width="' + root[1] + '" fill="none" stroke-linecap="round"/>';
      body += '<path d="' + root[0] + '" stroke="' + C.rootLight + '" stroke-width="' + fmt(root[1] * 0.3) +
        '" fill="none" stroke-linecap="round" transform="translate(-.8 0)" opacity=".8"/>';
    });
    body += '<path d="M26 30 l-6 4 l-3 -1 M24 42 l-7 -1 M38 32 l6 2 l2 4 M42 44 l5 5 M31 36 l-4 6 M10 24 l-2 5" stroke="' + C.root +
      '" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<path d="M24 12c3-2 7-1 7 2s-4 3-7 1zM40 12c2-2 6-1 5 2s-4 2-5 0z" fill="' + C.moss + '"/>' +
      '<path d="M18 63 q0 -2 1 -3 M33 52 q1 3 0 5" stroke="' + C.waterLight + '" stroke-width="1.2" fill="none"/>' +
      '<circle cx="33" cy="59" r="1.3" fill="' + C.spectral + '" opacity=".7"/><circle cx="48" cy="63" r="1" fill="' + C.spectral + '" opacity=".6"/>';
    return svgDoc(64, 64, body);
  }

  function svgDripPuddle(variant) {
    const shape = variant === 0
      ? 'M10 34c2-10 14-14 24-12 10 1 20 6 20 14 0 8-10 12-20 12-12 0-26-4-24-14z'
      : 'M8 40c4-8 12-6 18-12 6-6 16-8 24-4 8 4 8 12 2 16-6 5-16 4-24 6-8 2-18 2-20-6z';
    return svgDoc(64, 64,
      '<path d="' + shape + '" fill="' + C.void + '" opacity=".6" transform="translate(1 2)"/>' +
      '<path d="' + shape + '" fill="' + C.water + '"/>' +
      '<path d="' + shape + '" fill="none" stroke="' + C.waterLight + '" stroke-width="1.2" opacity=".7"/>' +
      '<ellipse cx="32" cy="34" rx="8" ry="3.4" fill="none" stroke="' + C.spectral + '" stroke-width=".9" opacity=".55"/>' +
      '<ellipse cx="32" cy="34" rx="14" ry="6" fill="none" stroke="' + C.spectral + '" stroke-width=".6" opacity=".3"/>' +
      '<circle cx="32" cy="34" r="1.2" fill="' + C.spectral + '" opacity=".8"/>' +
      '<ellipse cx="24" cy="28" rx="5" ry="1.4" fill="#C8FFF6" opacity=".25"/>' +
      '<path d="M8 36c2-3 6-2 5 1s-4 4-6 2zM48 26c3-2 7 0 6 3-1 3-5 3-7 1zM40 48c2-2 6-1 5 2s-4 2-6 0zM16 46c2-1 4 0 3 2s-3 2-4 0z" fill="' + C.moss + '"/>' +
      '<path d="M9 36c1-1 2-1 3 0M49 27c1-1 3-1 3 0" stroke="' + C.mossLight + '" stroke-width="1.2" fill="none"/>' +
      '<path d="M54 12 c0 2 1.6 3.6 0 5 c-1.6 -1.4 0 -3 0 -5z" fill="' + C.spectral + '" opacity=".75"/>');
  }

  function svgLeaningTomb() {
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="90" rx="27" ry="5" fill="' + C.void + '" opacity=".6"/>' +
      '<path d="M4 90 C10 80 22 78 32 79 C44 78 56 82 60 90Z" fill="#2A2018"/>' +
      '<path d="M8 88 C14 82 24 81 32 82" stroke="#3E3024" stroke-width="1.4" fill="none"/>' +
      '<g transform="rotate(-13 30 84)">' +
      '<path d="M16 86 L16 34 C16 18 46 18 46 34 L46 86Z" fill="' + C.stoneLight + '" stroke="' + C.stoneDark + '" stroke-width="1.4"/>' +
      '<path d="M20 86 L20 35 C20 23 42 23 42 35 L42 86" stroke="' + C.stone + '" stroke-width="1.2" fill="none"/>' +
      '<path d="M29 32 h4 v6 h6 v4 h-6 v14 h-4 v-14 h-6 v-4 h6z" fill="' + C.stoneDark + '"/>' +
      '<path d="M23 62 h16 M24 67 h14 M25 72 h10" stroke="' + C.stoneDark + '" stroke-width="1.4"/>' +
      '<path d="M40 24 L36 36 L41 44 L37 56" stroke="' + C.void + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M16 78c4-3 8-1 8 3s-5 5-8 4zM38 82c3-3 8-2 8 1s-4 3-8 2zM18 40c2-2 5-1 4 2s-3 3-4 1z" fill="' + C.moss + '"/>' +
      '</g>' +
      '<path d="M50 84 l3 -6 l2 6 M12 86 l2 -5 l2 5" stroke="' + C.mossLight + '" stroke-width="1.2" fill="none"/>');
  }

  function svgSkullNiche() {
    return svgDoc(64, 64,
      '<path d="M6 62 L6 22 C6 4 58 4 58 22 L58 62Z" fill="' + C.ossuary + '" stroke="' + C.ossuaryDark + '" stroke-width="1.4"/>' +
      '<path d="M12 58 L12 24 C12 12 52 12 52 24 L52 58Z" fill="' + C.void + '"/>' +
      skull(32, 23, 11) + skull(25, 34, 11) + skull(39, 34, 11) +
      skull(18, 47, 11.5) + skull(32, 47, 11.5) + skull(46, 47, 11.5) +
      bone(13, 56, 51, 56, 3, C.boneDark, C.boneDark) +
      '<rect x="4" y="57" width="56" height="5" rx="1" fill="' + C.ossuary + '" stroke="' + C.ossuaryDark + '" stroke-width="1"/>' +
      '<path d="M10 20 C14 10 50 10 54 20" stroke="' + C.bone + '" stroke-width="1" fill="none" opacity=".35"/>' +
      '<path d="M30 6 l-2 4 l3 2" stroke="' + C.ossuaryDark + '" stroke-width="1" fill="none"/>');
  }

  function svgBoneHeap(variant) {
    const skulls = variant === 0
      ? skull(24, 30, 15) + skull(40, 38, 13)
      : skull(32, 28, 16) + skull(18, 42, 11) + skull(46, 44, 11);
    return svgDoc(64, 64,
      '<ellipse cx="32" cy="42" rx="28" ry="14" fill="' + C.void + '" opacity=".5"/>' +
      '<path d="M6 46 C10 32 22 26 32 26 C44 26 56 34 58 46 C50 54 14 54 6 46Z" fill="' + C.boneDark + '" opacity=".55"/>' +
      bone(8, 48, 40, 38, 3.4, C.boneDark, C.boneDark) + bone(22, 54, 58, 42, 3.6, C.bone, C.bone) +
      bone(10, 36, 30, 54, 3.2, C.bone, C.bone) + bone(36, 52, 54, 30, 3, C.boneDark, C.boneDark) +
      bone(18, 24, 46, 26, 3, C.bone, C.bone) + skulls +
      '<path d="M50 54l3-2 2 2-3 2zM8 30l3-1 1 2-3 1zM56 36l2-3 2 2z" fill="' + C.bone + '"/>');
  }

  function svgBonePillar() {
    let rows = '';
    for (let level = 0; level < 4; level++) {
      const base = 80 - level * 16;
      rows += bone(19, base, 45, base, 3.4, C.boneDark, C.bone);
      rows += skull(23, base - 7, 8.5) + skull(32, base - 7.5, 9) + skull(41, base - 7, 8.5);
    }
    return svgDoc(64, 96,
      '<ellipse cx="32" cy="91" rx="24" ry="4" fill="' + C.void + '" opacity=".6"/>' +
      '<rect x="12" y="82" width="40" height="8" rx="1" fill="' + C.ossuary + '" stroke="' + C.ossuaryDark + '" stroke-width="1"/>' +
      '<rect x="17" y="14" width="30" height="68" fill="' + C.ossuaryDark + '"/>' + rows +
      bone(16, 16, 48, 16, 4, C.bone, C.bone) +
      '<rect x="12" y="6" width="40" height="8" rx="1" fill="' + C.ossuary + '" stroke="' + C.ossuaryDark + '" stroke-width="1"/>' +
      '<path d="M14 10 h36" stroke="' + C.bone + '" stroke-width=".8" opacity=".4"/>' +
      '<path d="M50 88 l4 -3 l3 3z M8 89 l3 -2 l2 2z" fill="' + C.bone + '"/>');
  }

  const BOOK_COLORS = ['#4A2A2A', '#2E3A2A', '#2A2E44', '#5A4630', '#3A2438', '#433A30', '#5E2A24', '#2C3638'];

  function svgBookshelf(variant) {
    let books = '';
    const shelves = [8, 26, 44];
    shelves.forEach(function (shelfTop, shelf) {
      let x = 9;
      let index = shelf * 3 + variant * 5;
      while (x < 53) {
        const width = 3 + ((index * 7) % 4);
        if (x + width > 55) break;
        const height = 12 + ((index * 5) % 5);
        const color = BOOK_COLORS[index % BOOK_COLORS.length];
        const top = shelfTop + 17 - height;
        if ((index + variant) % 9 === 4) {
          books += '<rect x="' + x + '" y="' + (top + 1) + '" width="' + width + '" height="' + height + '" fill="' + color +
            '" transform="rotate(14 ' + (x + width) + ' ' + (shelfTop + 17) + ')"/>';
          x += width + 4;
        } else {
          books += '<rect x="' + x + '" y="' + top + '" width="' + width + '" height="' + height + '" fill="' + color + '"/>';
          books += '<path d="M' + x + ' ' + (top + 2.5) + ' h' + width + ' M' + x + ' ' + (top + height - 2.5) + ' h' + width +
            '" stroke="' + C.gold + '" stroke-width=".8" opacity=".7"/>';
          x += width + 0.6;
        }
        index++;
      }
    });
    return svgDoc(64, 64,
      '<rect x="4" y="2" width="56" height="62" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.4"/>' +
      '<rect x="8" y="6" width="48" height="56" fill="' + C.void + '"/>' + books +
      '<rect x="6" y="24" width="52" height="3" fill="' + C.woodLight + '"/>' +
      '<rect x="6" y="42" width="52" height="3" fill="' + C.woodLight + '"/>' +
      '<rect x="6" y="60" width="52" height="3" fill="' + C.woodLight + '"/>' +
      '<rect x="2" y="0" width="60" height="4" rx="1" fill="' + C.woodLight + '" stroke="#1A1009" stroke-width="1"/>' +
      '<path d="M8 6 Q14 8 16 14 M8 6 Q12 12 8 16 M8 6 L14 12" stroke="#D8D2E6" stroke-width=".5" fill="none" opacity=".5"/>' +
      '<circle cx="' + (variant === 0 ? 30 : 44) + '" cy="5" r="1.2" fill="' + C.gold + '"/>');
  }

  function svgBleedingBook(variant) {
    let lines = '';
    for (let i = 0; i < 6; i++) {
      const y = 22 + i * 4;
      lines += 'M14 ' + (y + 1) + ' L28 ' + y + ' M36 ' + y + ' L50 ' + (y + 1) + ' ';
    }
    const spill = variant === 0
      ? 'M30 44 C26 50 18 52 14 58 C24 60 40 60 48 56 C42 52 36 50 34 44Z'
      : 'M30 44 C30 52 40 54 52 52 C58 56 54 60 44 60 C30 61 22 56 28 50Z';
    return svgDoc(64, 64,
      '<ellipse cx="32" cy="40" rx="28" ry="12" fill="' + C.void + '" opacity=".5"/>' +
      '<path d="' + spill + '" fill="' + C.bloodDark + '"/>' +
      '<path d="M8 18 C18 14 26 16 32 20 L32 46 C26 42 18 40 8 44Z" fill="' + C.pageDark + '"/>' +
      '<path d="M56 18 C46 14 38 16 32 20 L32 46 C38 42 46 40 56 44Z" fill="' + C.pageDark + '"/>' +
      '<path d="M10 16 C19 13 26 15 32 19 L32 44 C26 40 19 39 10 42Z" fill="' + C.page + '"/>' +
      '<path d="M54 16 C45 13 38 15 32 19 L32 44 C38 40 45 39 54 42Z" fill="' + C.page + '"/>' +
      '<path d="' + lines + '" stroke="' + C.boneDark + '" stroke-width=".9" opacity=".7"/>' +
      '<path d="M32 19 L32 44" stroke="' + C.waxDark + '" stroke-width="1.2"/>' +
      '<path d="M22 30 c-1 5 1 9 0 14 M42 26 c1 6 -1 10 0 16 M32 34 c0 4 0 8 -1 10" stroke="' + C.blood + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M18 22 h6 M40 34 h6" stroke="' + C.blood + '" stroke-width="1.4" opacity=".8"/>' +
      '<circle cx="54" cy="52" r="1.6" fill="' + C.bloodMid + '"/><circle cx="10" cy="54" r="1.2" fill="' + C.bloodMid + '"/>');
  }

  function svgReadingDesk() {
    return svgDoc(64, 96, CANDLE_DEFS +
      '<ellipse cx="32" cy="91" rx="22" ry="4" fill="' + C.void + '" opacity=".6"/>' +
      '<path d="M16 90 L22 84 L42 84 L48 90Z" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.2"/>' +
      '<path d="M27 84 L28 54 L36 54 L37 84Z" fill="' + C.woodLight + '" stroke="#1A1009" stroke-width="1.2"/>' +
      '<path d="M29 60 h6 M29 72 h6" stroke="' + C.wood + '" stroke-width="1.6"/>' +
      '<path d="M8 50 L56 42 L56 48 L8 56Z" fill="' + C.wood + '" stroke="#1A1009" stroke-width="1.2"/>' +
      '<path d="M12 48 C18 44 26 44 32 46 L32 40 C26 38 18 38 12 42Z" fill="' + C.page + '" stroke="' + C.pageDark + '" stroke-width=".8"/>' +
      '<path d="M52 41 C46 38 38 38 32 40 L32 46 C38 44 46 44 52 46Z" fill="' + C.page + '" stroke="' + C.pageDark + '" stroke-width=".8"/>' +
      '<path d="M15 42 h12 M15 44 h10 M36 42 h12 M36 44 h9" stroke="' + C.boneDark + '" stroke-width=".7"/>' +
      '<path d="M22 48 c0 4 1 7 0 10" stroke="' + C.blood + '" stroke-width="1.4" fill="none"/>' +
      '<rect x="46" y="38" width="8" height="3" rx="1" fill="' + C.iron + '"/>' +
      candle(50, 38, 14, 4.4, 0.5) +
      '<path d="M50 38 c0 3 1 5 0 7" stroke="' + C.wax + '" stroke-width="1.6" stroke-linecap="round"/>');
  }

  function svgObsidianPiece() {
    const silhouette = 'M30 22 V14 H26 V10 H30 V5 H34 V10 H38 V14 H34 V22 C41 23 44 29 40 36 L42 36 L42 40 L38 40 ' +
      'C39 50 40 62 43 74 L48 74 L48 80 L52 80 L52 88 L12 88 L12 80 L16 80 L16 74 L21 74 C24 62 25 50 26 40 L22 40 L22 36 L24 36 C20 29 23 23 30 22Z';
    return svgDoc(64, 96,
      '<defs><linearGradient id="obs" x1="0" x2="1"><stop offset="0" stop-color="' + C.obsidian + '"/>' +
      '<stop offset=".35" stop-color="' + C.obsidianLight + '"/><stop offset=".6" stop-color="' + C.obsidian + '"/>' +
      '<stop offset="1" stop-color="#050408"/></linearGradient></defs>' +
      '<ellipse cx="32" cy="91" rx="26" ry="4.4" fill="' + C.void + '" opacity=".7"/>' +
      '<ellipse cx="32" cy="90" rx="22" ry="3" fill="' + C.ember + '" opacity=".18"/>' +
      '<path d="' + silhouette + '" fill="url(#obs)" stroke="#000" stroke-width="1.2"/>' +
      '<path d="M26 40 C25 52 24 62 21 74 M24 36 C21 30 24 24 30 22.5 M16 80 h32" stroke="#B8B0D8" stroke-width=".8" fill="none" opacity=".35"/>' +
      '<path d="M22 37 h20 M17 76 h30 M13 82 h38" stroke="' + C.obsidianLight + '" stroke-width="1" opacity=".6"/>' +
      '<path d="M34 25 L31 33 L35 44 L30 58 L34 72 L31 86" stroke="' + C.ember + '" stroke-width="3.2" fill="none" opacity=".3"/>' +
      '<path d="M34 25 L31 33 L35 44 L30 58 L34 72 L31 86" stroke="' + C.ember + '" stroke-width="1" fill="none"/>' +
      '<path d="M35 44 L40 50 M30 58 L25 62" stroke="' + C.ember + '" stroke-width=".7" fill="none" opacity=".8"/>' +
      '<path d="M31 7 h2 v3" stroke="#D8D2E6" stroke-width=".6" fill="none" opacity=".5"/>');
  }

  function svgCrackedTile(variant) {
    const crack = variant === 0
      ? 'M6 12 L18 20 L24 18 L32 30 L40 32 L46 44 L58 50 M32 30 L28 40 L30 50'
      : 'M50 4 L44 16 L46 24 L34 32 L36 40 L24 46 L14 58 M46 24 L56 30';
    return svgDoc(64, 64,
      '<rect x="2" y="2" width="30" height="30" fill="' + C.marbleDark + '"/><rect x="32" y="32" width="30" height="30" fill="' + C.marbleDark + '"/>' +
      '<rect x="32" y="2" width="30" height="30" fill="' + C.marble + '"/><rect x="2" y="32" width="30" height="30" fill="' + C.marble + '"/>' +
      '<path d="M36 8 C44 12 50 6 58 14 M6 40 C14 44 18 38 28 48" stroke="#B8B4C4" stroke-width=".7" fill="none" opacity=".6"/>' +
      '<rect x="2" y="2" width="60" height="60" fill="none" stroke="' + C.void + '" stroke-width="2.4"/>' +
      '<rect x="6" y="6" width="52" height="52" fill="none" stroke="' + C.gold + '" stroke-width=".8" opacity=".45"/>' +
      '<path d="M32 2 V62 M2 32 H62" stroke="' + C.void + '" stroke-width="1.4"/>' +
      '<path d="' + crack + '" stroke="' + C.ember + '" stroke-width="5" fill="none" opacity=".25" stroke-linejoin="round"/>' +
      '<path d="' + crack + '" stroke="' + C.void + '" stroke-width="2.4" fill="none" stroke-linejoin="round"/>' +
      '<path d="' + crack + '" stroke="' + C.ember + '" stroke-width="1.1" fill="none" stroke-linejoin="round"/>' +
      '<path d="' + crack + '" stroke="#FFD0D8" stroke-width=".4" fill="none" stroke-linejoin="round"/>');
  }

  function svgChessBanner(variant) {
    const emblem = variant === 0
      ? '<path d="M24 16 h4 v4 h2 v-4 h4 v4 h2 v-4 h4 v8 l-3 3 v10 l3 3 v3 h-16 v-3 l3 -3 v-10 l-3 -3Z" fill="' + C.gold + '" stroke="' + C.goldDark + '" stroke-width=".8"/>'
      : '<circle cx="32" cy="13.5" r="1.8" fill="' + C.gold + '"/>' +
        '<path d="M32 15 C26 21 25 29 28 34 L36 34 C39 29 38 21 32 15Z" fill="' + C.gold + '" stroke="' + C.goldDark + '" stroke-width=".8"/>' +
        '<path d="M33.5 20 L29.5 27" stroke="#3A0814" stroke-width="1.4"/>' +
        '<rect x="26" y="34" width="12" height="3" fill="' + C.goldDark + '"/>' +
        '<path d="M28 37 L36 37 L38 42 L26 42Z" fill="' + C.gold + '"/><rect x="24" y="42" width="16" height="3" fill="' + C.goldDark + '"/>';
    let checks = '';
    for (let i = 0; i < 8; i++) {
      checks += '<rect x="' + (16 + i * 4) + '" y="9" width="4" height="3" fill="' + (i % 2 ? '#1A0A10' : C.wax) + '" opacity=".75"/>';
    }
    return svgDoc(64, 64,
      '<path d="M16 8 L48 8 L48 50 L32 60 L16 50Z" fill="#3A0814"/>' +
      '<path d="M18 8 L18 49 L32 57.6 L46 49 L46 8" stroke="#6E1426" stroke-width="2" fill="none"/>' +
      '<path d="M20 14 L20 48 L32 55 L44 48 L44 14" stroke="' + C.gold + '" stroke-width=".8" fill="none" opacity=".55"/>' +
      checks + emblem +
      '<path d="M36 44 L40 52 L37 54Z" fill="' + C.void + '" opacity=".7"/>' +
      '<rect x="10" y="5" width="44" height="3.4" rx="1.6" fill="' + C.iron + '"/>' +
      '<circle cx="10" cy="6.7" r="2.6" fill="' + C.gold + '"/><circle cx="54" cy="6.7" r="2.6" fill="' + C.gold + '"/>' +
      '<path d="M32 60 l0 3" stroke="' + C.gold + '" stroke-width="1.2"/>');
  }

  // ---------- Catálogo ----------

  const LIGHT_CANDLE = '#FFC46B';
  const LIGHT_TORCH = '#FF9F45';

  const CATALOG = [
    { id: 'blood_pool', family: 'floor', variants: [svgBloodPool(0), svgBloodPool(1)], size: 0.9, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'bones', family: 'floor', variants: [svgBones(0), svgBones(1)], size: 0.8, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'offering', family: 'floor', variants: [svgOffering(0), svgOffering(1)], size: 0.7, w: 64, h: 64, rotate: false, light: { color: LIGHT_CANDLE, radius: 1.2 }, where: 'room' },
    { id: 'rune_circle', family: 'floor', variants: [svgRuneCircle(0), svgRuneCircle(1)], size: 0.95, w: 64, h: 64, rotate: true, light: null, where: 'room' },
    { id: 'moss_crack', family: 'floor', variants: [svgMossCrack(0), svgMossCrack(1)], size: 0.95, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'floor_chains', family: 'floor', variants: [svgFloorChains(0), svgFloorChains(1)], size: 0.8, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'feathers', family: 'floor', variants: [svgFeathers(0), svgFeathers(1)], size: 0.65, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'ectoplasm', family: 'floor', variants: [svgEctoplasm(0), svgEctoplasm(1)], size: 0.8, w: 64, h: 64, rotate: true, light: { color: '#7FE0D0', radius: 0.8 }, where: 'any' },
    { id: 'broken_piece', family: 'floor', variants: [svgBrokenPiece(0), svgBrokenPiece(1)], size: 0.7, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'cobweb', family: 'floor', variants: [svgCobweb()], size: 0.75, w: 64, h: 64, rotate: false, light: null, where: 'corner' },

    { id: 'torch', family: 'wall', variants: [svgTorch(0), svgTorch(1)], size: 0.8, w: 64, h: 64, animated: true, light: { color: LIGHT_TORCH, radius: 2.4 }, height3D: 0.5, lift3D: 0.75 },
    { id: 'torn_banner', family: 'wall', variants: [svgTornBanner(0), svgTornBanner(1)], size: 0.85, w: 64, h: 64, light: null, height3D: 0.85, lift3D: 0.6 },
    { id: 'wall_hands', family: 'wall', variants: [svgWallHands()], size: 0.8, w: 64, h: 64, light: null, height3D: 0.7, lift3D: 0.2 },
    { id: 'hanging_chains', family: 'wall', variants: [svgHangingChains()], size: 0.8, w: 64, h: 64, light: null, height3D: 0.9, lift3D: 0.55 },
    { id: 'blood_runes', family: 'wall', variants: [svgBloodRunes(0), svgBloodRunes(1)], size: 0.8, w: 64, h: 64, light: null, height3D: 0.7, lift3D: 0.45 },
    { id: 'painted_eye', family: 'wall', variants: [svgPaintedEye(0), svgPaintedEye(1)], size: 0.8, w: 64, h: 64, light: null, height3D: 0.6, lift3D: 0.7 },
    { id: 'candle_niche', family: 'wall', variants: [svgCandleNiche()], size: 0.75, w: 64, h: 64, light: { color: LIGHT_CANDLE, radius: 1.5 }, height3D: 0.6, lift3D: 0.35 },
    { id: 'cage', family: 'wall', variants: [svgCage()], size: 0.8, w: 64, h: 64, light: null, height3D: 0.75, lift3D: 0.7 },

    { id: 'broken_column', family: 'room', variants: [svgBrokenColumn()], size: 1.1, w: 64, h: 96, light: null },
    { id: 'statue', family: 'room', variants: [svgStatue(0), svgStatue(1)], size: 1.15, w: 64, h: 96, light: null },
    { id: 'coffin', family: 'room', variants: [svgCoffin(0), svgCoffin(1)], size: 1.0, w: 64, h: 96, light: null },
    { id: 'clock', family: 'room', variants: [svgClock()], size: 1.2, w: 64, h: 96, light: null },
    { id: 'urn', family: 'room', variants: [svgUrn(0), svgUrn(1)], size: 0.75, w: 64, h: 96, light: null },
    { id: 'candelabra', family: 'room', variants: [svgCandelabra()], size: 1.0, w: 64, h: 96, light: { color: LIGHT_CANDLE, radius: 2 } },
    { id: 'altar', family: 'room', variants: [svgAltar()], size: 1.1, w: 64, h: 96, light: { color: '#B3123A', radius: 3 }, bossOnly: true },
    { id: 'giant_board', family: 'room', variants: [svgGiantBoard()], size: 1.0, w: 64, h: 64, flat: true, light: null },

    { id: 'drip_puddle', family: 'floor', variants: [svgDripPuddle(0), svgDripPuddle(1)], size: 0.9, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'bone_heap', family: 'floor', variants: [svgBoneHeap(0), svgBoneHeap(1)], size: 0.95, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'bleeding_book', family: 'floor', variants: [svgBleedingBook(0), svgBleedingBook(1)], size: 0.75, w: 64, h: 64, rotate: true, light: null, where: 'any' },
    { id: 'cracked_tile', family: 'floor', variants: [svgCrackedTile(0), svgCrackedTile(1)], size: 0.95, w: 64, h: 64, rotate: true, light: { color: '#FF4060', radius: 0.7 }, where: 'any' },
    { id: 'roots_wall', family: 'wall', variants: [svgRootsWall()], size: 0.85, w: 64, h: 64, light: null, height3D: 0.95, lift3D: 0.45 },
    { id: 'skull_niche', family: 'wall', variants: [svgSkullNiche()], size: 0.8, w: 64, h: 64, light: null, height3D: 0.65, lift3D: 0.3 },
    { id: 'bookshelf', family: 'wall', variants: [svgBookshelf(0), svgBookshelf(1)], size: 0.95, w: 64, h: 64, light: null, height3D: 0.98, lift3D: 0.49 },
    { id: 'chess_banner', family: 'wall', variants: [svgChessBanner(0), svgChessBanner(1)], size: 0.85, w: 64, h: 64, light: null, height3D: 0.85, lift3D: 0.6 },
    { id: 'leaning_tomb', family: 'room', variants: [svgLeaningTomb()], size: 0.95, w: 64, h: 96, light: null },
    { id: 'bone_pillar', family: 'room', variants: [svgBonePillar()], size: 1.15, w: 64, h: 96, light: null },
    { id: 'reading_desk', family: 'room', variants: [svgReadingDesk()], size: 1.0, w: 64, h: 96, light: { color: LIGHT_CANDLE, radius: 1.6 } },
    { id: 'obsidian_piece', family: 'room', variants: [svgObsidianPiece()], size: 1.2, w: 64, h: 96, light: { color: '#FF4060', radius: 0.9 } }
  ];

  const BY_KIND = {};
  CATALOG.forEach(function (entry) { BY_KIND[entry.id] = entry; });

  const ROOM_FLOOR_POOL = {
    blood_pool: 2, bones: 3, offering: 2, rune_circle: 1, moss_crack: 2, floor_chains: 1, feathers: 2, ectoplasm: 1, broken_piece: 2,
    drip_puddle: 2, bone_heap: 2, bleeding_book: 2, cracked_tile: 2
  };
  const CORRIDOR_FLOOR_POOL = {
    bones: 2, blood_pool: 2, moss_crack: 3, feathers: 2, ectoplasm: 2, floor_chains: 2, broken_piece: 1,
    drip_puddle: 2, bone_heap: 2, bleeding_book: 1, cracked_tile: 2
  };
  const WALL_POOL = {
    torch: 4, torn_banner: 2, wall_hands: 2, hanging_chains: 2, blood_runes: 2, painted_eye: 1, candle_niche: 2, cage: 1,
    roots_wall: 2, skull_niche: 2, bookshelf: 3, chess_banner: 2
  };
  const ROOM_TALL_POOL = {
    broken_column: 3, statue: 3, coffin: 2, clock: 1, urn: 2, candelabra: 2,
    leaning_tomb: 2, bone_pillar: 2, reading_desk: 2, obsidian_piece: 2
  };
  const BOSS_KINDS = ['altar', 'candelabra', 'rune_circle', 'blood_pool', 'bones', 'blood_runes', 'painted_eye'];
  const LIGHT_WALL_SPACING = 4;

  // Multiplicadores extra por tema; los kinds que aparecen aquí son exclusivos (peso 0 en los demás temas).
  const THEME_BOOST = {
    criptas: { roots_wall: 2, drip_puddle: 2, leaning_tomb: 2 },
    osario: { skull_niche: 2, bone_heap: 2, bone_pillar: 2 },
    biblioteca: { bookshelf: 2, bleeding_book: 2, reading_desk: 2 },
    salon: { obsidian_piece: 2, cracked_tile: 2, chess_banner: 2 }
  };
  const EXCLUSIVE_THEME = {};
  Object.keys(THEME_BOOST).forEach(function (themeId) {
    Object.keys(THEME_BOOST[themeId]).forEach(function (kind) { EXCLUSIVE_THEME[kind] = themeId; });
  });

  // ---------- Generación ----------

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function weightedPick(pool, rand, avoid) {
    let total = 0;
    const kinds = Object.keys(pool);
    for (const kind of kinds) if (!avoid || !avoid[kind]) total += pool[kind];
    if (total === 0) return weightedPick(pool, rand, null);
    let roll = rand() * total;
    for (const kind of kinds) {
      if (avoid && avoid[kind]) continue;
      roll -= pool[kind];
      if (roll < 0) return kind;
    }
    return kinds[kinds.length - 1];
  }

  function inRect(rect, x, y) {
    return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  }

  function cornerRot(maze, x, y) {
    const north = G.isWall(maze, x, y - 1);
    const south = G.isWall(maze, x, y + 1);
    const west = G.isWall(maze, x - 1, y);
    const east = G.isWall(maze, x + 1, y);
    if (north && west) return 0;
    if (north && east) return 1;
    if (south && east) return 2;
    if (south && west) return 3;
    return -1;
  }

  function wallFaces(maze, x, y) {
    const faces = [];
    for (let face = 0; face < 4; face++) {
      if (G.isWall(maze, x + DIRS4[face][0], y + DIRS4[face][1])) faces.push(face);
    }
    return faces;
  }

  function createPlacer(maze, rand) {
    const props = [];
    const occupied = new Set();
    const wallLights = [];
    const start = maze.start;

    function blockedCell(x, y) {
      return G.isWall(maze, x, y) || (x === start.x && y === start.y);
    }

    function canPlace(family, x, y) {
      return !blockedCell(x, y) && !occupied.has(family + ':' + x + ':' + y);
    }

    function add(kind, x, y, extra) {
      const entry = BY_KIND[kind];
      const prop = {
        id: 'p' + props.length,
        kind: kind,
        family: entry.family,
        x: x,
        y: y,
        face: null,
        variant: Math.floor(rand() * entry.variants.length),
        rot: entry.rotate ? Math.floor(rand() * 4) : 0,
        light: entry.light ? { color: entry.light.color, radius: entry.light.radius } : null
      };
      if (extra) Object.keys(extra).forEach(function (key) { prop[key] = extra[key]; });
      occupied.add(entry.family + ':' + x + ':' + y);
      props.push(prop);
      return prop;
    }

    function tryFloor(kind, x, y) {
      if (!canPlace('floor', x, y)) return null;
      if (kind === 'cobweb') {
        const rot = cornerRot(maze, x, y);
        if (rot < 0) return null;
        return add(kind, x, y, { rot: rot });
      }
      return add(kind, x, y);
    }

    function tryWall(kind, x, y) {
      if (!canPlace('wall', x, y)) return null;
      const faces = wallFaces(maze, x, y);
      if (!faces.length) return null;
      if (BY_KIND[kind].light) {
        for (const light of wallLights) {
          if (Math.max(Math.abs(light[0] - x), Math.abs(light[1] - y)) < LIGHT_WALL_SPACING) return null;
        }
      }
      const face = faces[Math.floor(rand() * faces.length)];
      const prop = add(kind, x, y, { face: face, wallX: x + DIRS4[face][0], wallY: y + DIRS4[face][1] });
      if (prop.light) wallLights.push([x, y]);
      return prop;
    }

    function tryRoom(kind, x, y) {
      if (!canPlace('room', x, y)) return null;
      if (Math.abs(x - start.x) + Math.abs(y - start.y) <= 1) return null;
      return add(kind, x, y);
    }

    return { props: props, canPlace: canPlace, tryFloor: tryFloor, tryWall: tryWall, tryRoom: tryRoom };
  }

  function roomCells(room) {
    const cells = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) cells.push([x, y]);
    }
    return cells;
  }

  function sealedEdgeCells(maze, room) {
    const corners = [];
    const edges = [];
    roomCells(room).forEach(function (cell) {
      const x = cell[0];
      const y = cell[1];
      let outside = 0;
      let sealed = true;
      for (const dir of DIRS4) {
        const nx = x + dir[0];
        const ny = y + dir[1];
        if (inRect(room, nx, ny)) continue;
        outside++;
        if (!G.isWall(maze, nx, ny)) sealed = false;
      }
      if (!outside || !sealed) return;
      if (outside >= 2) corners.push(cell);
      else edges.push(cell);
    });
    return { corners: corners, edges: edges };
  }

  function wallCandidates(maze, room) {
    return roomCells(room).filter(function (cell) { return wallFaces(maze, cell[0], cell[1]).length > 0; });
  }

  function placeBoss(maze, placer, rand) {
    const boss = maze.bossRoom;
    const centerX = boss.x + Math.floor(boss.w / 2);
    const centerY = boss.y + Math.floor(boss.h / 2);
    placer.tryRoom('altar', centerX, centerY);
    const circle = placer.tryFloor('rune_circle', centerX, centerY);
    if (circle) circle.variant = 0;
    const sealed = sealedEdgeCells(maze, boss);
    shuffle(sealed.corners, rand).slice(0, 4).forEach(function (cell) { placer.tryRoom('candelabra', cell[0], cell[1]); });

    const interior = shuffle(roomCells(boss).filter(function (cell) {
      return Math.abs(cell[0] - centerX) + Math.abs(cell[1] - centerY) >= 2;
    }), rand);
    const floorPlan = ['blood_pool', 'blood_pool', 'blood_pool', 'bones', 'bones', 'rune_circle'];
    let index = 0;
    for (const cell of interior) {
      if (index >= floorPlan.length) break;
      const prop = placer.tryFloor(floorPlan[index], cell[0], cell[1]);
      if (prop) {
        if (prop.kind === 'rune_circle') prop.variant = 0;
        index++;
      }
    }

    const walls = shuffle(wallCandidates(maze, boss), rand);
    const wallPlan = ['blood_runes', 'blood_runes', 'blood_runes', 'painted_eye'];
    index = 0;
    for (const cell of walls) {
      if (index >= wallPlan.length) break;
      if (placer.tryWall(wallPlan[index], cell[0], cell[1])) index++;
    }
  }

  function themeMultiplier(theme) {
    const weights = theme.propWeights || {};
    const boost = THEME_BOOST[theme.id] || {};
    return function (kind) {
      if (EXCLUSIVE_THEME[kind]) return boost[kind] || 0;
      return (weights[kind] === undefined ? 1 : weights[kind]) * (boost[kind] === undefined ? 1 : boost[kind]);
    };
  }

  function themedPool(pool, mult) {
    const out = {};
    Object.keys(pool).forEach(function (kind) {
      const weight = pool[kind] * mult(kind);
      if (weight > 0) out[kind] = weight;
    });
    return out;
  }

  function themedPools(theme) {
    const mult = themeMultiplier(theme);
    return {
      mult: mult,
      roomFloor: themedPool(ROOM_FLOOR_POOL, mult),
      corridorFloor: themedPool(CORRIDOR_FLOOR_POOL, mult),
      wall: themedPool(WALL_POOL, mult),
      roomTall: themedPool(ROOM_TALL_POOL, mult),
      roomCobweb: Math.min(0.75, 0.3 * mult('cobweb')),
      corridorCobweb: Math.min(0.8, 0.4 * mult('cobweb')),
      board: Math.min(0.75, 0.35 * mult('giant_board'))
    };
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  function placeRoom(maze, placer, rand, room, pools) {
    const area = room.w * room.h;
    const used = {};
    const sealed = sealedEdgeCells(maze, room);
    const tallSpots = shuffle(sealed.corners, rand).concat(shuffle(sealed.edges, rand));
    let tallWanted = area >= 16 ? 2 : 1;
    if (room.w >= 4 && room.h >= 4 && rand() < pools.board) {
      const boardX = room.x + Math.floor(room.w / 2);
      const boardY = room.y + Math.floor(room.h / 2);
      if (placer.tryRoom('giant_board', boardX, boardY)) tallWanted--;
    }
    for (const cell of tallSpots) {
      if (tallWanted <= 0) break;
      const kind = weightedPick(pools.roomTall, rand, used);
      if (placer.tryRoom(kind, cell[0], cell[1])) {
        used[kind] = true;
        tallWanted--;
      }
    }

    const cells = shuffle(roomCells(room), rand);
    let floorWanted = area >= 16 ? 2 : 1;
    for (const cell of cells) {
      if (floorWanted <= 0) break;
      const corner = cornerRot(maze, cell[0], cell[1]) >= 0 && rand() < pools.roomCobweb;
      const kind = corner ? 'cobweb' : weightedPick(pools.roomFloor, rand, used);
      if (placer.tryFloor(kind, cell[0], cell[1])) {
        used[kind] = true;
        floorWanted--;
      }
    }

    const walls = shuffle(wallCandidates(maze, room), rand);
    let wallWanted = 1;
    for (const cell of walls) {
      if (wallWanted <= 0) break;
      const kind = weightedPick(pools.wall, rand, used);
      if (placer.tryWall(kind, cell[0], cell[1])) {
        used[kind] = true;
        wallWanted--;
      }
    }
  }

  function corridorCells(maze) {
    const cells = [];
    for (let y = 1; y < maze.h - 1; y++) {
      for (let x = 1; x < maze.w - 1; x++) {
        if (G.isWall(maze, x, y)) continue;
        if (inRect(maze.bossRoom, x, y)) continue;
        if (maze.rooms.some(function (room) { return inRect(room, x, y); })) continue;
        cells.push([x, y]);
      }
    }
    return cells;
  }

  function placeCorridors(maze, placer, rand, wanted, pools) {
    const cells = shuffle(corridorCells(maze), rand);
    const taken = [];
    let floorWanted = Math.ceil(wanted * 0.55);
    let wallWanted = wanted - floorWanted;
    for (const cell of cells) {
      if (floorWanted <= 0 && wallWanted <= 0) break;
      const x = cell[0];
      const y = cell[1];
      if (taken.some(function (other) { return Math.abs(other[0] - x) + Math.abs(other[1] - y) < 2; })) continue;
      let placed = null;
      const preferWall = wallWanted > 0 && (floorWanted <= 0 || rand() < 0.45);
      if (preferWall) placed = placer.tryWall(weightedPick(pools.wall, rand, null), x, y);
      if (!placed && floorWanted > 0) {
        const corner = cornerRot(maze, x, y) >= 0 && rand() < pools.corridorCobweb;
        placed = placer.tryFloor(corner ? 'cobweb' : weightedPick(pools.corridorFloor, rand, null), x, y);
        if (placed) floorWanted--;
      } else if (placed) {
        wallWanted--;
      }
      if (placed) taken.push(cell);
    }
  }

  function generate(maze, seed, theme) {
    const activeTheme = theme || G.THEMES[0];
    const pools = themedPools(activeTheme);
    const rand = G.rng(((seed >>> 0) ^ 0x9e3779b9 ^ hashText(activeTheme.id)) >>> 0);
    const placer = createPlacer(maze, rand);
    placeBoss(maze, placer, rand);
    maze.rooms.forEach(function (room) { placeRoom(maze, placer, rand, room, pools); });
    const target = 66 + Math.floor(rand() * 18);
    const corridorWanted = Math.max(16, target - placer.props.length);
    placeCorridors(maze, placer, rand, Math.min(corridorWanted, 90 - placer.props.length), pools);
    return placer.props;
  }

  // ---------- Imágenes ----------

  const imageCache = {};

  function image(kind, variant) {
    const entry = BY_KIND[kind];
    if (!entry || typeof Image === 'undefined' || typeof document === 'undefined') return null;
    const index = Math.max(0, Math.min(entry.variants.length - 1, variant | 0));
    const key = kind + ':' + index;
    let slot = imageCache[key];
    if (!slot) {
      slot = imageCache[key] = { canvas: null, failed: false };
      const img = new Image();
      img.onload = function () {
        const scale = RASTER_LONG_SIDE / Math.max(entry.w, entry.h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(entry.w * scale);
        canvas.height = Math.round(entry.h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        slot.canvas = canvas;
      };
      img.onerror = function () { slot.failed = true; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(entry.variants[index]);
    }
    return slot.canvas;
  }

  function preload() {
    CATALOG.forEach(function (entry) {
      for (let i = 0; i < entry.variants.length; i++) image(entry.id, i);
    });
  }

  function seedOf(prop) {
    return ((prop.x * 73856093) ^ (prop.y * 19349663)) % 1000;
  }

  function flicker(prop, now) {
    const phase = seedOf(prop) * 0.37;
    const time = now * 0.001;
    const value = 0.95 + 0.12 * Math.sin(time * 9.1 + phase) + 0.07 * Math.sin(time * 23.7 + phase * 2.3) +
      0.05 * Math.sin(time * 3.3 + phase * 0.7);
    return Math.max(0.7, Math.min(1.2, value));
  }

  function frameVariant(prop, now) {
    const entry = BY_KIND[prop.kind];
    if (!entry.animated) return prop.variant;
    return (Math.floor((now || 0) / 120 + seedOf(prop)) + prop.variant) % entry.variants.length;
  }

  // ---------- Dibujo cenital ----------

  function drawHalo(ctx, cx, cy, light, tile, strength) {
    const radius = light.radius * tile * 0.85;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, hexAlpha(light.color, 0.32 * strength));
    gradient.addColorStop(0.4, hexAlpha(light.color, 0.12 * strength));
    gradient.addColorStop(1, hexAlpha(light.color, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function hexAlpha(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((value >> 16) & 255) + ',' + ((value >> 8) & 255) + ',' + (value & 255) + ',' + alpha.toFixed(3) + ')';
  }

  function draw2D(ctx, prop, px, py, tile, now) {
    const entry = BY_KIND[prop.kind];
    if (!entry) return;
    const strength = prop.light ? flicker(prop, now || 0) : 1;
    const img = image(prop.kind, frameVariant(prop, now));
    const cx = px + tile / 2;
    const cy = py + tile / 2;

    if (entry.family === 'wall') {
      const dir = DIRS4[prop.face || 0];
      if (prop.light) drawHalo(ctx, cx + dir[0] * tile * 0.32, cy + dir[1] * tile * 0.32, prop.light, tile, strength);
      if (!img) return;
      const width = tile * entry.size;
      const depth = width * 0.62;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate([Math.PI / 2, Math.PI, -Math.PI / 2, 0][prop.face || 0]);
      ctx.drawImage(img, -width / 2, -tile / 2 - depth * 0.08, width, depth);
      ctx.restore();
      return;
    }

    if (entry.family === 'floor') {
      if (prop.light) drawHalo(ctx, cx, cy, prop.light, tile, strength);
      if (!img) return;
      const size = tile * entry.size;
      ctx.save();
      ctx.translate(cx, cy);
      if (prop.kind === 'cobweb') {
        ctx.rotate((prop.rot * Math.PI) / 2);
        ctx.drawImage(img, -tile / 2, -tile / 2, size, size);
      } else {
        ctx.rotate((prop.rot * Math.PI) / 2);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
      return;
    }

    if (prop.light) drawHalo(ctx, cx, cy - tile * 0.25, prop.light, tile, strength);
    if (!img) return;
    if (entry.flat) {
      const size = tile * entry.size;
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
      return;
    }
    const width = tile * entry.size * (entry.w / entry.h) * 1.15;
    const height = width * (entry.h / entry.w);
    const bottom = py + tile * 0.96;
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = '#07060B';
    ctx.beginPath();
    ctx.ellipse(cx, bottom - tile * 0.06, width * 0.42, tile * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(img, cx - width / 2, bottom - height, width, height);
  }

  // ---------- Sprite para la vista 3D ----------

  function sprite3D(prop, now) {
    const entry = BY_KIND[prop.kind];
    if (!entry) return null;
    const img = image(prop.kind, frameVariant(prop, now));
    const aspect = entry.w / entry.h;
    const base = { image: img, aspect: aspect, light: prop.light, flicker: prop.light ? flicker(prop, now || 0) : 1 };
    if (entry.family === 'wall') {
      const dir = DIRS4[prop.face || 0];
      base.scale = entry.height3D;
      base.yOffset = entry.lift3D;
      base.billboard = false;
      base.wallFace = prop.face;
      base.wx = prop.x + 0.5 + dir[0] * 0.45;
      base.wy = prop.y + 0.5 + dir[1] * 0.45;
      return base;
    }
    base.wx = prop.x + 0.5;
    base.wy = prop.y + 0.5;
    base.billboard = true;
    base.wallFace = null;
    base.yOffset = 0;
    if (entry.family === 'floor') base.scale = entry.size * 0.38;
    else if (entry.flat) base.scale = 0.12;
    else base.scale = entry.size * 1.05;
    base.flat = !!(entry.flat || entry.family === 'floor');
    return base;
  }

  G.props = {
    catalog: CATALOG,
    byKind: BY_KIND,
    bossKinds: BOSS_KINDS,
    themeBoost: THEME_BOOST,
    exclusiveTheme: EXCLUSIVE_THEME,
    themeMultiplier: function (theme) { return themeMultiplier(theme || G.THEMES[0]); },
    faceDirs: DIRS4,
    generate: generate,
    image: image,
    preload: preload,
    flicker: flicker,
    draw2D: draw2D,
    sprite3D: sprite3D
  };
})();
