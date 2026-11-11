(function () {
  'use strict';

  const G = (window.G = window.G || {});
  const RASTER = 256;
  const BLOOD = '#B3123A';
  const VOID = '#07060B';

  function wrap(body, defs) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs>' +
      '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>' +
      '<filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
      (defs || '') + '</defs>' + body + '</svg>';
  }

  function glow(markup) {
    return '<g filter="url(#glow)">' + markup + '</g>' + markup;
  }

  function mirror(path) {
    return path.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, function (match, x, y) {
      return (128 - Number(x)) + ' ' + y;
    });
  }

  function both(path) {
    return path + ' ' + mirror(path);
  }

  function radial(id, inner, outer, cx, cy, innerOpacity, outerOpacity) {
    return '<radialGradient id="' + id + '" cx="' + (cx || '50%') + '" cy="' + (cy || '40%') + '" r="70%">' +
      '<stop offset="0" stop-color="' + inner + '" stop-opacity="' + (innerOpacity === undefined ? 1 : innerOpacity) + '"/>' +
      '<stop offset="1" stop-color="' + outer + '" stop-opacity="' + (outerOpacity === undefined ? 1 : outerOpacity) + '"/></radialGradient>';
  }

  function vertical(id, stops) {
    let out = '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">';
    for (const stop of stops) out += '<stop offset="' + stop[0] + '" stop-color="' + stop[1] + '" stop-opacity="' + (stop[2] === undefined ? 1 : stop[2]) + '"/>';
    return out + '</linearGradient>';
  }

  function chain(x0, y0, x1, y1, links, color) {
    let out = '';
    for (let i = 0; i <= links; i++) {
      const t = i / links;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + (i % 2 ? 90 : 0);
      out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.2" ry="1.8" transform="rotate(' + angle.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="none" stroke="' + color + '" stroke-width="1.5"/>';
    }
    return out;
  }

  function ghostArt(c, f) {
    const hem = f
      ? 'L104 110 Q98 120 92 106 Q86 96 78 112 Q72 122 64 106 Q56 96 50 112 Q44 122 36 106 Q30 98 24 110 Z'
      : 'L104 106 Q98 96 92 110 Q86 122 78 106 Q72 96 64 112 Q56 124 50 106 Q44 96 36 112 Q30 120 24 104 Z';
    const arm = f ? 'M30 72 C18 70 10 58 8 48 C16 58 22 60 30 62Z' : 'M30 72 C18 74 10 66 6 58 C14 64 22 64 30 62Z';
    const pupil = f ? 1 : -1;
    return wrap(
      '<ellipse cx="64" cy="64" rx="46" ry="52" fill="' + c.a + '" opacity=".22" filter="url(#haze)"/>' +
      '<path d="' + both(arm) + '" fill="' + c.a + '" opacity=".5"/>' +
      '<path d="M26 66 C26 30 44 12 64 12 C84 12 102 30 102 66 ' + hem + '" fill="url(#body)" stroke="' + c.e + '" stroke-opacity=".55" stroke-width="1.5"/>' +
      '<path d="M40 70 Q44 90 40 104 M64 74 Q60 92 64 108 M88 70 Q84 90 88 104" stroke="' + c.b + '" stroke-opacity=".35" stroke-width="2" fill="none"/>' +
      '<ellipse cx="50" cy="52" rx="9" ry="13" fill="' + c.d + '"/><ellipse cx="78" cy="52" rx="9" ry="13" fill="' + c.d + '"/>' +
      glow('<circle cx="' + (50 + pupil * 2) + '" cy="55" r="3.2" fill="' + c.e + '"/><circle cx="' + (78 + pupil * 2) + '" cy="55" r="3.2" fill="' + c.e + '"/>') +
      '<ellipse cx="64" cy="82" rx="7" ry="' + (f ? 11 : 8) + '" fill="' + c.d + '"/>',
      radial('body', '#E9FFFB', c.b, '50%', '28%', 0.95, 0.12).replace('<stop offset="1"', '<stop offset=".4" stop-color="' + c.a + '" stop-opacity=".9"/><stop offset="1"')
    );
  }

  function wraithArt(c, f) {
    const hem = f
      ? 'L30 112 L36 124 L46 106 L54 122 L64 108 L74 122 L82 106 L92 124 L98 112 L112 120'
      : 'L32 110 L38 126 L48 108 L56 126 L64 110 L72 126 L80 108 L90 126 L96 110 L110 124';
    const lift = f ? -3 : 0;
    const hand = 'M34 ' + (74 + lift) + ' L20 ' + (80 + lift) + ' M20 ' + (80 + lift) + ' L9 ' + (75 + lift) + ' M20 ' + (80 + lift) + ' L8 ' + (82 + lift) + ' M20 ' + (80 + lift) + ' L11 ' + (89 + lift);
    return wrap(
      '<ellipse cx="64" cy="66" rx="44" ry="56" fill="' + c.a + '" opacity=".2" filter="url(#haze)"/>' +
      '<path d="M64 6 C42 8 30 34 32 62 C30 80 26 100 18 124 ' + hem + ' C102 100 98 80 96 62 C98 34 86 8 64 6Z" fill="url(#cloak)"/>' +
      '<path d="M50 70 L44 118 M64 74 L64 120 M78 70 L84 118" stroke="' + c.d + '" stroke-opacity=".5" stroke-width="2" fill="none"/>' +
      '<path d="' + both('M36 60 C30 66 26 72 22 ' + (80 + lift) + ' L34 ' + (78 + lift) + ' C36 72 38 68 40 64Z') + '" fill="' + c.b + '"/>' +
      '<path d="' + both(hand) + '" stroke="' + c.e + '" stroke-opacity=".85" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<path d="M64 20 C50 22 44 34 45 48 C46 62 54 70 64 72 C74 70 82 62 83 48 C84 34 78 22 64 20Z" fill="' + c.d + '"/>' +
      glow('<path d="' + both(f ? 'M53 47 L61 48 L53 49Z' : 'M52 45 L61 48 L52 51Z') + '" fill="' + c.e + '"/>'),
      vertical('cloak', [[0, c.a], [0.5, c.b], [1, c.b, 0]])
    );
  }

  function crawlerArt(c, f) {
    const legs = f
      ? [[36, 86, 20, 76, 8, 74], [30, 94, 14, 104, 8, 116], [48, 98, 44, 114, 36, 122]]
      : [[36, 86, 18, 72, 6, 84], [30, 94, 12, 96, 4, 108], [48, 98, 40, 112, 30, 118]];
    let legPath = '';
    for (const leg of legs) legPath += both('M' + leg[0] + ' ' + leg[1] + ' L' + leg[2] + ' ' + leg[3] + ' L' + leg[4] + ' ' + leg[5]) + ' ';
    const eyes = [[50, 82, 4.5], [62, 78, 5.5], [76, 82, 4.5], [56, 90, 3], [70, 90, 3], [84, 88, 2.5], [42, 88, 2.5]];
    let eyeMarkup = '';
    let pupils = '';
    eyes.forEach(function (eye, i) {
      const ry = f && i % 2 ? eye[2] * 0.3 : eye[2];
      eyeMarkup += '<ellipse cx="' + eye[0] + '" cy="' + eye[1] + '" rx="' + eye[2] + '" ry="' + ry + '" fill="' + c.e + '"/>';
      if (!(f && i % 2)) pupils += '<circle cx="' + eye[0] + '" cy="' + eye[1] + '" r="' + (eye[2] * 0.35).toFixed(1) + '" fill="#FFE6EC"/>';
    });
    return wrap(
      '<ellipse cx="64" cy="100" rx="58" ry="12" fill="#000" opacity=".6" filter="url(#haze)"/>' +
      '<ellipse cx="64" cy="86" rx="52" ry="22" fill="' + c.e + '" opacity=".12" filter="url(#haze)"/>' +
      '<path d="' + legPath + '" stroke="' + c.b + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>' +
      '<path d="' + legPath + '" stroke="' + c.a + '" stroke-width="1.6" stroke-linejoin="round" fill="none"/>' +
      '<path d="M14 92 C14 74 36 ' + (f ? 62 : 64) + ' 64 ' + (f ? 62 : 64) + ' C92 ' + (f ? 62 : 64) + ' 114 74 114 92 C114 102 96 106 64 106 C32 106 14 102 14 92Z" fill="url(#body)" stroke="' + c.a + '" stroke-opacity=".6" stroke-width="1.2"/>' +
      '<path d="M40 72 L44 58 L48 70Z M58 67 L62 50 L67 66Z M76 68 L82 55 L85 71Z" fill="' + c.b + '" stroke="' + c.a + '" stroke-opacity=".5"/>' +
      glow(eyeMarkup) + pupils +
      '<path d="M48 98 Q64 105 80 98" stroke="' + c.e + '" stroke-opacity=".7" stroke-width="1.5" fill="none"/>' +
      '<path d="M52 99 L54 103 L56 100 M60 101 L62 105 L64 101 M68 101 L70 105 L72 100" stroke="#E9E2FF" stroke-width="1" fill="none"/>',
      radial('body', c.a, c.b, '50%', '30%')
    );
  }

  function larvaArt(c, f) {
    const segments = [[64, 110, 30, 11], [60, 98, 27, 11], [57, 86, 24, 11], [59, 74, 22, 10], [63, 62, 20, 10]];
    let body = '';
    for (const seg of segments) {
      body += '<ellipse cx="' + seg[0] + '" cy="' + seg[1] + '" rx="' + seg[2] + '" ry="' + seg[3] + '" fill="url(#seg)" stroke="' + c.b + '" stroke-width="1.4"/>';
      body += '<path d="M' + (seg[0] - seg[2] * 0.6) + ' ' + (seg[1] - 2) + ' Q' + seg[0] + ' ' + (seg[1] + 4) + ' ' + (seg[0] + seg[2] * 0.6) + ' ' + (seg[1] - 2) + '" stroke="' + c.b + '" stroke-opacity=".6" fill="none"/>';
    }
    const hx = f ? 64 : 68;
    const hy = f ? 43 : 44;
    const mouth = f ? 8 : 11;
    let teeth = '';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const ox = hx + Math.cos(angle) * mouth;
      const oy = hy + 4 + Math.sin(angle) * mouth;
      const ix = hx + Math.cos(angle) * mouth * 0.45;
      const iy = hy + 4 + Math.sin(angle) * mouth * 0.45;
      const sx = Math.cos(angle + Math.PI / 2) * 2.2;
      const sy = Math.sin(angle + Math.PI / 2) * 2.2;
      teeth += 'M' + (ox + sx).toFixed(1) + ' ' + (oy + sy).toFixed(1) + ' L' + ix.toFixed(1) + ' ' + iy.toFixed(1) + ' L' + (ox - sx).toFixed(1) + ' ' + (oy - sy).toFixed(1) + 'Z ';
    }
    return wrap(
      '<ellipse cx="64" cy="76" rx="40" ry="48" fill="' + c.a + '" opacity=".16" filter="url(#haze)"/>' +
      body +
      '<ellipse cx="' + hx + '" cy="' + hy + '" rx="21" ry="19" fill="url(#seg)" stroke="' + c.b + '" stroke-width="1.4"/>' +
      '<circle cx="' + hx + '" cy="' + (hy + 4) + '" r="' + mouth + '" fill="' + c.d + '"/>' +
      glow('<circle cx="' + hx + '" cy="' + (hy + 4) + '" r="' + (mouth * 0.4).toFixed(1) + '" fill="' + c.e + '"/>') +
      '<path d="' + teeth + '" fill="#F6F0E2"/>' +
      '<circle cx="' + (hx - 9) + '" cy="' + (hy - 10) + '" r="2.6" fill="' + c.d + '"/><circle cx="' + (hx + 9) + '" cy="' + (hy - 10) + '" r="2.6" fill="' + c.d + '"/>' +
      glow('<circle cx="' + (hx - 9) + '" cy="' + (hy - 10) + '" r="1" fill="' + c.e + '"/><circle cx="' + (hx + 9) + '" cy="' + (hy - 10) + '" r="1" fill="' + c.e + '"/>') +
      '<path d="M' + (hx + 6) + ' ' + (hy + 14) + ' Q' + (hx + 8) + ' ' + (hy + (f ? 30 : 24)) + ' ' + (hx + 6) + ' ' + (hy + (f ? 34 : 28)) + '" stroke="' + c.a + '" stroke-opacity=".8" stroke-width="2" fill="none"/>',
      radial('seg', '#FFFDF6', c.a, '40%', '30%')
    );
  }

  function crowArt(c, f) {
    const wing = f
      ? 'M58 62 C44 66 26 78 6 96 C16 92 20 94 22 100 C26 92 32 92 34 98 C38 88 44 88 46 94 C50 82 54 76 58 72Z'
      : 'M58 60 C44 40 26 26 6 22 C14 30 16 34 12 40 C20 40 22 44 18 50 C28 50 30 54 28 60 C38 60 46 64 58 70Z';
    const feathers = f ? 'M50 70 L24 92 M46 68 L32 94 M54 70 L44 92' : 'M50 62 L20 36 M46 62 L18 48 M52 66 L28 58';
    return wrap(
      '<ellipse cx="64" cy="64" rx="56" ry="40" fill="' + c.a + '" opacity=".14" filter="url(#haze)"/>' +
      '<path d="' + both(wing) + '" fill="' + c.b + '" stroke="' + c.a + '" stroke-opacity=".75" stroke-width="1.5"/>' +
      '<path d="' + both(feathers) + '" stroke="' + c.a + '" stroke-opacity=".3" fill="none"/>' +
      '<path d="M58 96 L52 116 L60 108 L64 120 L68 108 L76 116 L70 96Z" fill="' + c.b + '" stroke="' + c.a + '" stroke-opacity=".6"/>' +
      '<path d="M64 44 C74 44 78 54 76 66 C74 80 70 92 64 100 C58 92 54 80 52 66 C50 54 54 44 64 44Z" fill="' + c.b + '" stroke="' + c.a + '" stroke-opacity=".7" stroke-width="1.3"/>' +
      '<path d="M58 70 Q64 74 70 70 M58 78 Q64 82 70 78 M60 86 Q64 89 68 86" stroke="#D9D2C0" stroke-opacity=".45" fill="none"/>' +
      '<path d="M64 28 C72 28 77 34 77 41 C77 48 71 53 64 53 C57 53 51 48 51 41 C51 34 56 28 64 28Z" fill="#D9D2C0"/>' +
      '<path d="M59 48 L64 ' + (f ? 68 : 66) + ' L69 48Z" fill="#B5AB95" stroke="' + c.d + '" stroke-width="1"/>' +
      '<circle cx="57.5" cy="40" r="4.5" fill="' + c.d + '"/><circle cx="70.5" cy="40" r="5.5" fill="' + c.d + '"/>' +
      glow('<circle cx="70.5" cy="40" r="3.6" fill="' + c.e + '"/>') +
      '<circle cx="70.5" cy="40" r="1.4" fill="' + c.d + '"/>'
    );
  }

  function spiderArt(c, f) {
    const sets = [
      [[52, 62, 30, 40, 12, 58], [50, 68, 24, 58, 6, 80], [50, 74, 24, 84, 8, 104], [52, 80, 34, 98, 22, 120]],
      [[52, 62, 28, 44, 8, 50], [50, 68, 22, 62, 4, 72], [50, 74, 26, 88, 12, 110], [52, 80, 36, 100, 30, 124]]
    ];
    let legs = '';
    let knees = '';
    sets[f].forEach(function (leg) {
      legs += 'M' + leg[0] + ' ' + leg[1] + ' L' + leg[2] + ' ' + leg[3] + ' L' + leg[4] + ' ' + leg[5] + ' ';
      knees += '<circle cx="' + leg[2] + '" cy="' + leg[3] + '" r="3.2" fill="' + c.a + '"/>';
    });
    sets[1 - f].forEach(function (leg) {
      legs += mirror('M' + leg[0] + ' ' + leg[1] + ' L' + leg[2] + ' ' + leg[3] + ' L' + leg[4] + ' ' + leg[5]) + ' ';
      knees += '<circle cx="' + (128 - leg[2]) + '" cy="' + leg[3] + '" r="3.2" fill="' + c.a + '"/>';
    });
    return wrap(
      '<ellipse cx="64" cy="80" rx="46" ry="40" fill="' + c.e + '" opacity=".1" filter="url(#haze)"/>' +
      '<path d="' + legs + '" stroke="' + c.b + '" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>' +
      '<path d="' + legs + '" stroke="' + c.a + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" fill="none"/>' +
      knees +
      '<ellipse cx="64" cy="88" rx="23" ry="21" fill="url(#bone)" stroke="' + c.b + '" stroke-width="1.4"/>' +
      '<ellipse cx="56" cy="86" rx="5.5" ry="6.5" fill="' + c.d + '"/><ellipse cx="72" cy="86" rx="5.5" ry="6.5" fill="' + c.d + '"/>' +
      glow('<circle cx="56" cy="87" r="1.8" fill="' + c.e + '"/><circle cx="72" cy="87" r="1.8" fill="' + c.e + '"/>') +
      '<path d="M64 92 L61 98 L67 98Z" fill="' + c.d + '"/>' +
      '<path d="M54 102 L74 102 M57 100 L57 105 M61 100 L61 105 M65 100 L65 105 M69 100 L69 105" stroke="' + c.d + '" stroke-width="1.3"/>' +
      '<ellipse cx="64" cy="60" rx="13" ry="11" fill="url(#bone)" stroke="' + c.b + '" stroke-width="1.2"/>' +
      '<path d="' + both('M59 67 L56 ' + (f ? 78 : 76) + ' L62 69Z') + '" fill="#F3EEE2" stroke="' + c.b + '" stroke-width=".8"/>' +
      glow('<circle cx="58.5" cy="58" r="2.6" fill="' + c.e + '"/><circle cx="69.5" cy="58" r="2.6" fill="' + c.e + '"/><circle cx="61.5" cy="53" r="1.8" fill="' + c.e + '"/><circle cx="66.5" cy="53" r="1.8" fill="' + c.e + '"/>'),
      radial('bone', '#FFFBF0', c.b, '40%', '30%').replace('<stop offset="1"', '<stop offset=".55" stop-color="' + c.a + '"/><stop offset="1"')
    );
  }

  function monkArt(c, f) {
    let beads = '';
    const beadSpots = [[60, 96], [58, 102], [58, 108], [61, 113], [67, 113], [70, 108], [70, 102], [68, 96]];
    for (const bead of beadSpots) beads += '<circle cx="' + bead[0] + '" cy="' + bead[1] + '" r="1.9" fill="' + c.e + '"/>';
    return wrap(
      '<ellipse cx="64" cy="70" rx="42" ry="56" fill="' + c.e + '" opacity=".1" filter="url(#haze)"/>' +
      '<path d="M64 16 C44 16 36 34 36 52 C34 70 30 96 22 122 L106 122 C98 96 94 70 92 52 C92 34 84 16 64 16Z" fill="url(#robe)" stroke="' + c.a + '" stroke-opacity=".6"/>' +
      '<path d="M48 80 Q46 100 40 120 M64 92 L64 122 M80 80 Q82 100 88 120" stroke="' + c.d + '" stroke-opacity=".55" stroke-width="2" fill="none"/>' +
      '<path d="M64 24 C52 24 45 35 45 48 C45 62 54 71 64 73 C74 71 83 62 83 48 C83 35 76 24 64 24Z" fill="' + c.d + '"/>' +
      '<ellipse cx="64" cy="50" rx="13" ry="17" fill="url(#face)"/>' +
      '<path d="M53 44 Q64 40 75 44" stroke="#9A9088" stroke-opacity=".5" fill="none"/>' +
      glow('<path d="M64 37 L64 63" stroke="' + c.e + '" stroke-width="' + (f ? 2.4 : 1.4) + '"/>' + (f ? '<ellipse cx="64" cy="50" rx="1.6" ry="8" fill="' + c.e + '"/>' : '')) +
      '<path d="M61 40 L67 40 M61 46 L67 46 M61 52 L67 52 M61 58 L67 58" stroke="#3A2A2A" stroke-width="1"/>' +
      '<path d="M44 80 Q64 86 84 80" stroke="#A88A5A" stroke-width="2.5" fill="none"/>' +
      '<path d="' + both('M40 72 C48 80 52 84 56 86 L58 93 C48 93 40 88 35 81Z') + '" fill="' + c.b + '" stroke="' + c.a + '" stroke-opacity=".5"/>' +
      '<path d="M56 87 C58 81 70 81 72 87 C72 93 56 93 56 87Z" fill="#E6DED2"/>' +
      glow(beads + '<path d="M64 115 L64 123 M61 118 L67 118" stroke="' + c.e + '" stroke-width="1.6"/>'),
      vertical('robe', [[0, c.a], [1, c.b]]) + radial('face', '#F6F0E6', '#8C8478', '45%', '35%')
    );
  }

  function hangedArt(c, f) {
    const sway = f ? 5 : -5;
    return wrap(
      '<ellipse cx="64" cy="76" rx="34" ry="52" fill="' + c.e + '" opacity=".1" filter="url(#haze)"/>' +
      '<g transform="rotate(' + sway + ' 64 0)">' +
      '<path d="M64 0 L64 28" stroke="#8A7350" stroke-width="3"/>' +
      '<path d="' + both('M50 50 C44 62 42 76 44 90') + '" stroke="' + c.a + '" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      '<path d="M50 46 C46 60 46 76 48 90 L80 90 C82 76 82 60 78 46 C72 43 56 43 50 46Z" fill="#3C3550" stroke="' + c.b + '"/>' +
      '<path d="M48 90 L52 98 L56 90 L62 99 L68 90 L74 97 L80 90" fill="#3C3550"/>' +
      '<path d="M57 92 L55 118 M71 92 L73 120" stroke="' + c.a + '" stroke-width="7" stroke-linecap="round"/>' +
      '<ellipse cx="55" cy="121" rx="3.4" ry="5" fill="' + c.b + '"/><ellipse cx="73" cy="123" rx="3.4" ry="5" fill="' + c.b + '"/>' +
      chain(44, 56, 84, 74, 12, c.c) + chain(44, 76, 84, 60, 12, c.c) + chain(44, 92, 40, 124, 9, c.c) + chain(84, 92, 90, 120, 8, c.c) +
      '<g transform="rotate(18 64 34)">' +
      '<ellipse cx="64" cy="36" rx="11" ry="13" fill="url(#skin)"/>' +
      '<path d="M53 32 C52 22 76 20 75 32 L72 26 L68 30 L64 24 L60 30 L56 26Z" fill="' + c.d + '"/>' +
      '<circle cx="59" cy="36" r="3" fill="' + c.d + '"/><circle cx="69" cy="36" r="3" fill="' + c.d + '"/>' +
      glow('<circle cx="59" cy="36" r="' + (f ? 1.6 : 2.1) + '" fill="' + c.e + '"/><circle cx="69" cy="36" r="' + (f ? 1.6 : 2.1) + '" fill="' + c.e + '"/>') +
      '<ellipse cx="64" cy="44" rx="2.6" ry="' + (f ? 4 : 3) + '" fill="' + c.d + '"/>' +
      '</g>' +
      '<ellipse cx="64" cy="29" rx="8" ry="3.5" fill="none" stroke="#8A7350" stroke-width="2.5"/>' +
      '</g>',
      radial('skin', '#B9C7B7', c.a, '40%', '35%')
    );
  }

  function handArt(c, f) {
    const tips = f ? [[48, 28], [56, 22], [67, 22], [77, 28]] : [[42, 12], [55, 5], [69, 5], [82, 13]];
    const bases = [[50, 54], [58, 52], [67, 52], [76, 54]];
    let fingers = '';
    let nails = '';
    for (let i = 0; i < 4; i++) {
      const midX = (bases[i][0] + tips[i][0]) / 2 + (f ? 4 : -1);
      const midY = (bases[i][1] + tips[i][1]) / 2;
      fingers += 'M' + bases[i][0] + ' ' + bases[i][1] + ' Q' + midX + ' ' + midY + ' ' + tips[i][0] + ' ' + tips[i][1] + ' ';
      nails += '<circle cx="' + tips[i][0] + '" cy="' + tips[i][1] + '" r="2.4" fill="' + c.d + '"/>';
    }
    const thumb = f ? 'M46 76 Q34 72 30 60' : 'M46 76 Q30 68 22 52';
    const eye = f
      ? '<path d="M50 72 Q64 66 78 72 Q64 80 50 72Z" fill="#F4EEE8"/>' + glow('<ellipse cx="64" cy="72" rx="5" ry="3" fill="' + c.e + '"/>')
      : '<path d="M50 72 Q64 58 78 72 Q64 86 50 72Z" fill="#F4EEE8"/>' + glow('<circle cx="64" cy="72" r="6" fill="' + c.e + '"/>') + '<ellipse cx="64" cy="72" rx="1.6" ry="5" fill="' + c.d + '"/>';
    return wrap(
      '<ellipse cx="64" cy="60" rx="40" ry="54" fill="' + c.a + '" opacity=".16" filter="url(#haze)"/>' +
      '<path d="M56 104 Q50 114 56 124 M64 106 Q70 116 64 126 M72 104 Q78 112 74 122" stroke="' + c.a + '" stroke-opacity=".4" stroke-width="3" fill="none" filter="url(#glow)"/>' +
      '<path d="' + fingers + thumb + '" stroke="' + c.b + '" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<path d="' + fingers + thumb + '" stroke="' + c.a + '" stroke-width="6.5" stroke-linecap="round" fill="none"/>' +
      nails +
      '<path d="M44 70 C42 56 46 50 52 50 L78 50 C84 50 88 56 86 70 C86 84 80 94 64 96 C50 94 44 84 44 70Z" fill="url(#palm)" stroke="' + c.b + '" stroke-width="1.4"/>' +
      eye +
      '<path d="M54 94 L52 104 L76 104 L74 94Z" fill="' + c.b + '"/>' +
      '<ellipse cx="64" cy="104" rx="12" ry="3.2" fill="' + BLOOD + '"/>',
      radial('palm', '#F2EAF6', c.a, '45%', '40%')
    );
  }

  function eaterArt(c, f) {
    const eyes = [[46, 46, 7], [74, 38, 9], [90, 58, 6], [56, 64, 5], [38, 70, 4.5], [80, 74, 5.5], [62, 28, 3.5], [96, 42, 3]];
    let eyeMarkup = '';
    let pupils = '';
    let lids = '';
    eyes.forEach(function (eye, i) {
      if (f && i % 3 === 1) {
        lids += '<path d="M' + (eye[0] - eye[2]) + ' ' + eye[1] + ' Q' + eye[0] + ' ' + (eye[1] + eye[2] * 0.5) + ' ' + (eye[0] + eye[2]) + ' ' + eye[1] + '" stroke="' + c.a + '" stroke-width="1.4" fill="none"/>';
        return;
      }
      eyeMarkup += '<circle cx="' + eye[0] + '" cy="' + eye[1] + '" r="' + eye[2] + '" fill="' + c.e + '"/>';
      pupils += '<ellipse cx="' + eye[0] + '" cy="' + eye[1] + '" rx="' + (eye[2] * 0.25).toFixed(1) + '" ry="' + (eye[2] * 0.8).toFixed(1) + '" fill="' + c.d + '"/>';
    });
    let teeth = '';
    for (let x = 42; x <= 84; x += 6) teeth += 'M' + x + ' ' + (86 + Math.abs(x - 63) * -0.1).toFixed(0) + ' L' + (x + 3) + ' 96 L' + (x + 6) + ' 87Z ';
    const sway = f ? 4 : -4;
    return wrap(
      '<circle cx="64" cy="62" r="54" fill="' + c.a + '" opacity=".22" filter="url(#haze)"/>' +
      '<path d="M50 98 Q' + (46 + sway) + ' 110 50 124 M64 102 Q' + (68 - sway) + ' 114 64 126 M78 98 Q' + (82 + sway) + ' 110 78 122" stroke="' + c.b + '" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
      '<circle cx="64" cy="62" r="44" fill="url(#orb)" stroke="' + c.a + '" stroke-opacity=".8" stroke-width="2"/>' +
      '<path d="M30 40 Q64 18 98 40" stroke="' + c.a + '" stroke-opacity=".25" stroke-width="3" fill="none"/>' +
      glow(eyeMarkup) + pupils + lids +
      '<path d="M36 84 Q64 ' + (f ? 116 : 110) + ' 92 84 Q64 98 36 84Z" fill="' + c.d + '"/>' +
      '<path d="M48 92 Q64 ' + (f ? 106 : 102) + ' 80 92" stroke="' + BLOOD + '" stroke-width="3" fill="none" filter="url(#glow)"/>' +
      '<path d="' + teeth + '" fill="#EDE6D6"/>',
      radial('orb', '#3A2A66', c.b, '40%', '35%')
    );
  }

  function pawnBossArt(c, f) {
    return wrap(
      '<ellipse cx="64" cy="70" rx="54" ry="58" fill="' + c.e + '" opacity=".16" filter="url(#haze)"/>' +
      '<path d="M22 104 L106 104 L112 122 L16 122Z" fill="url(#stone)" stroke="' + c.b + '"/>' +
      '<ellipse cx="64" cy="104" rx="42" ry="5" fill="' + c.b + '"/>' +
      '<path d="M47 60 C47 78 40 92 32 104 L96 104 C88 92 81 78 81 60Z" fill="url(#stone)" stroke="' + c.b + '"/>' +
      '<ellipse cx="64" cy="58" rx="25" ry="6.5" fill="url(#stone)" stroke="' + c.b + '"/>' +
      '<circle cx="64" cy="33" r="22" fill="url(#stone)" stroke="' + c.b + '"/>' +
      '<path d="M68 12 L62 22 L68 28 L60 34 M46 70 L52 80 L48 90 L54 100 M86 72 L80 82 L84 94" stroke="' + c.d + '" stroke-width="1.6" fill="none"/>' +
      '<ellipse cx="64" cy="84" rx="9" ry="13" fill="' + c.d + '"/>' +
      glow('<ellipse cx="64" cy="86" rx="3.5" ry="' + (f ? 7 : 5) + '" fill="' + c.e + '" opacity=".8"/>') +
      '<ellipse cx="55" cy="31" rx="6" ry="7" fill="' + c.d + '"/><ellipse cx="73" cy="31" rx="6" ry="7" fill="' + c.d + '"/>' +
      glow('<circle cx="' + (f ? 56 : 55) + '" cy="32" r="2.8" fill="' + c.e + '"/><circle cx="' + (f ? 74 : 73) + '" cy="32" r="2.8" fill="' + c.e + '"/>') +
      '<path d="M48 42 L54 46 L58 42 L64 48 L70 42 L74 46 L80 42 L76 51 L52 51Z" fill="' + c.d + '"/>' +
      '<path d="M55 38 Q54 ' + (f ? 52 : 46) + ' 56 ' + (f ? 58 : 52) + ' M73 38 Q74 ' + (f ? 48 : 44) + ' 72 ' + (f ? 54 : 50) + '" stroke="' + BLOOD + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      '<linearGradient id="stone" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#FFF6E6"/><stop offset=".35" stop-color="' + c.a + '"/><stop offset="1" stop-color="' + c.b + '"/></linearGradient>'
    );
  }

  function wallBossArt(c, f) {
    let bricks = '';
    const shades = [c.a, '#4A4066', '#62567F', '#3E3658'];
    for (let row = 0; row < 7; row++) {
      const y = 16 + row * 15;
      const offset = (row % 2) * 13;
      for (let x = 4 - offset; x < 124; x += 26) {
        bricks += '<rect x="' + x + '" y="' + y + '" width="25" height="14" rx="2" fill="' + (row === 0 ? c.a : shades[(x * 7 + row * 3) & 3]) + '" stroke="#0E0C16" stroke-width="1.5"/>';
      }
    }
    const eyes = [[34, 46, 6], [92, 42, 7], [64, 36, 5], [22, 72, 4], [106, 74, 5]];
    let sockets = '';
    let irises = '';
    let pupils = '';
    eyes.forEach(function (eye, i) {
      sockets += '<ellipse cx="' + eye[0] + '" cy="' + eye[1] + '" rx="' + (eye[2] + 2) + '" ry="' + (eye[2] + 1) + '" fill="' + VOID + '"/>';
      if (f && i % 2 === 0) return;
      irises += '<circle cx="' + eye[0] + '" cy="' + eye[1] + '" r="' + eye[2] + '" fill="' + c.e + '"/>';
      pupils += '<ellipse cx="' + eye[0] + '" cy="' + eye[1] + '" rx="1.2" ry="' + (eye[2] * 0.8).toFixed(1) + '" fill="' + VOID + '"/>';
    });
    return wrap(
      '<rect x="0" y="8" width="128" height="120" fill="' + c.e + '" opacity=".14" filter="url(#haze)"/>' +
      '<g clip-path="url(#block)">' + bricks + '<rect x="0" y="0" width="128" height="128" fill="url(#shade)"/></g>' +
      '<path d="M6 122 L6 30 L18 22 L32 28 L48 16 L64 26 L80 14 L96 26 L110 18 L122 28 L122 122Z" fill="none" stroke="#9684E8" stroke-opacity=".4" stroke-width="1.5"/>' +
      sockets + glow(irises) + pupils +
      '<path d="M18 92 L32 ' + (f ? 82 : 86) + ' L44 96 L56 ' + (f ? 82 : 86) + ' L66 98 L78 ' + (f ? 82 : 86) + ' L90 96 L106 88 L108 102 L92 ' + (f ? 114 : 108) + ' L78 100 L64 ' + (f ? 116 : 110) + ' L50 100 L36 ' + (f ? 114 : 108) + ' L20 102Z" fill="' + VOID + '"/>' +
      glow('<path d="M30 98 L64 104 L98 98" stroke="' + BLOOD + '" stroke-width="3" fill="none"/>') +
      '<path d="M34 108 L38 118 M90 106 L88 120 M60 112 L61 124" stroke="' + BLOOD + '" stroke-width="2.2" stroke-linecap="round"/>',
      '<clipPath id="block"><path d="M6 122 L6 30 L18 22 L32 28 L48 16 L64 26 L80 14 L96 26 L110 18 L122 28 L122 122Z"/></clipPath>' +
      '<linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".12"/><stop offset="1" stop-color="#000000" stop-opacity=".45"/></linearGradient>'
    );
  }

  function bishopBossArt(c, f) {
    return wrap(
      '<ellipse cx="64" cy="66" rx="52" ry="60" fill="' + c.e + '" opacity=".14" filter="url(#haze)"/>' +
      '<path d="M98 30 C98 16 114 14 116 26 C118 36 106 38 106 30" stroke="#C9B37E" stroke-width="3" fill="none"/>' +
      '<path d="M100 32 L104 124" stroke="#C9B37E" stroke-width="3"/>' +
      '<path d="M46 64 C40 80 30 100 20 124 L108 124 C98 100 88 80 82 64Z" fill="url(#robe)" stroke="' + c.a + '" stroke-opacity=".7"/>' +
      '<path d="M58 66 L54 124 L74 124 L70 66Z" fill="#8A7448" opacity=".85"/>' +
      '<path d="M64 112 L64 98 M59 108 L69 108" stroke="' + VOID + '" stroke-width="2"/>' +
      '<path d="M94 72 L102 68 L108 72 L104 76 L96 78Z" fill="#D9D2C0"/>' +
      '<ellipse cx="64" cy="63" rx="19" ry="5" fill="#C9B37E" stroke="#5A4A28"/>' +
      '<path d="M64 6 C77 18 83 30 81 44 C79 54 73 60 64 60 C55 60 49 54 47 44 C45 30 51 18 64 6Z" fill="url(#mitre)" stroke="' + c.b + '" stroke-width="1.4"/>' +
      '<circle cx="64" cy="5" r="4" fill="#C9B37E"/>' +
      '<path d="M52 20 L78 ' + (f ? 42 : 38) + ' L74 ' + (f ? 48 : 44) + ' L48 26Z" fill="' + VOID + '"/>' +
      glow('<path d="M54 25 L74 41" stroke="' + c.e + '" stroke-width="' + (f ? 2.6 : 1.6) + '"/>') +
      '<path d="M54 22 L56 28 L59 24 L61 31 L64 27 L66 34 L69 31 L71 38" stroke="#F3EEE2" stroke-width="1.3" fill="none"/>' +
      '<ellipse cx="57" cy="48" rx="4.5" ry="5" fill="' + VOID + '"/><ellipse cx="71" cy="48" rx="4.5" ry="5" fill="' + VOID + '"/>' +
      glow('<circle cx="57" cy="48.5" r="' + (f ? 1.8 : 2.4) + '" fill="' + c.e + '"/><circle cx="71" cy="48.5" r="' + (f ? 2.4 : 1.8) + '" fill="' + c.e + '"/>'),
      vertical('robe', [[0, c.a], [1, c.b]]) + '<linearGradient id="mitre" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".4" stop-color="#D9CFE6"/><stop offset="1" stop-color="#6E6280"/></linearGradient>'
    );
  }

  function rookBossArt(c, f) {
    let blocks = '';
    for (let y = 46; y < 100; y += 10) blocks += 'M' + (36 + (y - 38) * 0.07).toFixed(0) + ' ' + y + ' L' + (92 - (y - 38) * 0.07).toFixed(0) + ' ' + y + ' ';
    return wrap(
      '<ellipse cx="64" cy="20" rx="44" ry="18" fill="' + c.e + '" opacity="' + (f ? 0.45 : 0.3) + '" filter="url(#haze)"/>' +
      '<ellipse cx="64" cy="76" rx="50" ry="52" fill="' + c.e + '" opacity=".1" filter="url(#haze)"/>' +
      '<path d="M24 100 L104 100 L110 122 L18 122Z" fill="url(#slate)" stroke="' + c.b + '"/>' +
      '<path d="M34 38 L94 38 L90 100 L38 100Z" fill="url(#slate)" stroke="' + c.b + '"/>' +
      '<path d="' + blocks + '" stroke="' + c.b + '" stroke-opacity=".7" fill="none"/>' +
      '<path d="M26 14 L42 14 L42 24 L56 24 L56 14 L72 14 L72 24 L86 24 L86 14 L102 14 L102 38 L26 38Z" fill="url(#slate)" stroke="' + c.b + '"/>' +
      glow('<path d="M44 24 L54 24 M74 24 L84 24" stroke="' + c.e + '" stroke-width="2"/>') +
      '<path d="M32 48 L96 46 L96 60 L32 62Z" fill="#CFC4B4" stroke="#7A6E5E"/>' +
      '<path d="M96 50 L112 ' + (f ? 44 : 48) + ' L108 56 M96 56 L114 ' + (f ? 62 : 58) + ' L106 62" stroke="#CFC4B4" stroke-width="3.5" fill="none"/>' +
      '<path d="M50 61 Q49 ' + (f ? 76 : 70) + ' 51 ' + (f ? 86 : 78) + ' M76 61 Q77 ' + (f ? 72 : 68) + ' 75 ' + (f ? 82 : 76) + '" stroke="' + BLOOD + '" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<path d="M50 100 L50 86 C50 76 78 76 78 86 L78 100Z" fill="' + VOID + '"/>' +
      glow('<ellipse cx="64" cy="92" rx="8" ry="5" fill="' + c.e + '" opacity="' + (f ? 0.7 : 0.45) + '"/>') +
      '<path d="M55 81 L55 100 M60 78 L60 100 M64 77 L64 100 M68 78 L68 100 M73 81 L73 100 M50 90 L78 90" stroke="' + c.b + '" stroke-width="2"/>' +
      '<rect x="40" y="68" width="5" height="12" rx="2" fill="' + VOID + '"/><rect x="83" y="68" width="5" height="12" rx="2" fill="' + VOID + '"/>',
      '<linearGradient id="slate" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="#9AA0B8"/><stop offset=".4" stop-color="' + c.a + '"/><stop offset="1" stop-color="' + c.b + '"/></linearGradient>'
    );
  }

  function queenBossArt(c, f) {
    const sway = f ? 3 : -3;
    let roses = '';
    for (const rose of [[32, 116], [52, 120], [78, 118], [98, 114]]) {
      roses += '<circle cx="' + rose[0] + '" cy="' + rose[1] + '" r="4" fill="#4A0818"/><path d="M' + (rose[0] - 2) + ' ' + rose[1] + ' Q' + rose[0] + ' ' + (rose[1] - 3) + ' ' + (rose[0] + 2) + ' ' + rose[1] + '" stroke="' + BLOOD + '" fill="none"/>';
    }
    return wrap(
      '<ellipse cx="64" cy="64" rx="54" ry="62" fill="' + c.e + '" opacity=".12" filter="url(#haze)"/>' +
      '<path d="M48 28 C36 50 ' + (30 + sway) + ' 80 ' + (22 + sway) + ' 108 L40 92 C42 70 46 50 52 34Z" fill="#140A12"/>' +
      '<path d="M80 28 C92 50 ' + (98 + sway) + ' 80 ' + (106 + sway) + ' 108 L88 92 C86 70 82 50 76 34Z" fill="#140A12"/>' +
      '<path d="M44 72 C40 88 30 106 18 124 L110 124 C98 106 88 88 84 72Z" fill="url(#gown)" stroke="' + c.a + '" stroke-opacity=".7"/>' +
      '<path d="M54 76 Q50 100 42 122 M74 76 Q78 100 86 122" stroke="' + VOID + '" stroke-opacity=".45" stroke-width="2" fill="none"/>' +
      roses +
      '<path d="M36 62 L44 57 L50 66 L58 59 L64 68 L70 59 L78 66 L84 57 L92 62 L84 74 L44 74Z" fill="#3A0C1C" stroke="#B8984E"/>' +
      '<path d="M50 30 C50 22 78 22 78 30 C80 44 74 58 64 62 C54 58 48 44 50 30Z" fill="url(#face)"/>' +
      '<path d="M53 46 Q55 52 58 54 M75 46 Q73 52 70 54" stroke="#7A6A66" stroke-opacity=".6" fill="none"/>' +
      '<ellipse cx="57" cy="38" rx="5" ry="4" fill="' + VOID + '"/><ellipse cx="71" cy="38" rx="5" ry="4" fill="' + VOID + '"/>' +
      glow('<circle cx="57" cy="38" r="' + (f ? 2.4 : 1.8) + '" fill="' + c.e + '"/><circle cx="71" cy="38" r="' + (f ? 2.4 : 1.8) + '" fill="' + c.e + '"/>') +
      '<path d="M58 53 Q64 56 70 53 M60 51 L60 56 M64 52 L64 57 M68 51 L68 56" stroke="' + VOID + '" stroke-width="1.2" fill="none"/>' +
      '<path d="M40 30 L44 10 L50 24 L56 4 L64 22 L72 4 L78 24 L84 10 L88 30Z" fill="url(#crown)" stroke="#5A4A28"/>' +
      glow('<circle cx="44" cy="11" r="2" fill="' + BLOOD + '"/><circle cx="56" cy="5" r="2" fill="' + BLOOD + '"/><circle cx="72" cy="5" r="2" fill="' + BLOOD + '"/><circle cx="84" cy="11" r="2" fill="' + BLOOD + '"/>') +
      '<path d="M56 84 C58 78 70 78 72 84 C72 90 56 90 56 84Z" fill="#D8CCC4"/>' +
      '<path d="M64 80 L64 70" stroke="#3A2A1A" stroke-width="1.5"/><circle cx="64" cy="68" r="3.4" fill="#4A0818" stroke="' + BLOOD + '"/>',
      vertical('gown', [[0, c.a], [1, c.b]]) + radial('face', '#F2EAE4', '#9C8C86', '45%', '35%') +
      '<linearGradient id="crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E2B0"/><stop offset="1" stop-color="#7A6230"/></linearGradient>'
    );
  }

  const ENTRIES = [
    {
      id: 'ghost', name: 'Fantasma', art: ghostArt, palette: { a: '#7FE0D0', b: '#2E8C80', d: VOID, e: '#E9FFFB' },
      scale: 0.86, size3d: 0.62, lift: 0.3, float: true, glow: '#7FE0D0', frameMs: 420,
      stats: { hp: 1, moveEvery: 700, fastMoveEvery: 400, erratic: 0.2, from: 1, weight: 4 }
    },
    {
      id: 'crawler', name: 'Sombra Reptante', art: crawlerArt, palette: { a: '#5A3A8E', b: '#140A22', d: VOID, e: '#FF3B6B' },
      scale: 1, size3d: 0.6, lift: 0, float: false, glow: '#FF3B6B', frameMs: 160,
      stats: { hp: 1, moveEvery: 460, erratic: 0.1, from: 1, weight: 1.2 }
    },
    {
      id: 'larva', name: 'Larva Pálida', art: larvaArt, palette: { a: '#E6DAC6', b: '#9C8670', d: '#3A1020', e: BLOOD },
      scale: 0.9, size3d: 0.68, lift: 0, float: false, glow: '#E6DAC6', frameMs: 520,
      stats: { hp: 2, moveEvery: 1150, erratic: 0, from: 1, weight: 2 }
    },
    {
      id: 'crow', name: 'Cuervo Espectral', art: crowArt, palette: { a: '#7FE0D0', b: '#16122A', d: VOID, e: '#D8FFF8' },
      scale: 0.96, size3d: 0.6, lift: 0.5, float: true, glow: '#7FE0D0', frameMs: 140,
      stats: { hp: 1, moveEvery: 480, erratic: 0.45, from: 2, weight: 1.6 }
    },
    {
      id: 'spider', name: 'Araña de Hueso', art: spiderArt, palette: { a: '#DCD4C2', b: '#6E6656', d: VOID, e: '#7CFFB2' },
      scale: 1, size3d: 0.66, lift: 0, float: false, glow: '#7CFFB2', frameMs: 200,
      stats: { hp: 1, moveEvery: 600, erratic: 0.05, diagonal: true, from: 3, weight: 1.6 }
    },
    {
      id: 'hand', name: 'Mano Errante', art: handArt, palette: { a: '#D2C4DE', b: '#6E5C88', d: VOID, e: '#FF3B6B' },
      scale: 0.8, size3d: 0.45, lift: 0.4, float: true, glow: '#FF6B8E', frameMs: 260,
      stats: { hp: 1, moveEvery: 340, erratic: 0.45, from: 3, weight: 1 }
    },
    {
      id: 'wraith', name: 'Espectro', art: wraithArt, palette: { a: '#B49CFF', b: '#4B2E8F', d: '#0C0718', e: '#F0E6FF' },
      scale: 1, size3d: 0.9, lift: 0.15, float: true, glow: '#B49CFF', frameMs: 380,
      stats: { hp: 1, moveEvery: 900, erratic: 0, phase: true, from: 4, weight: 1.6 }
    },
    {
      id: 'monk', name: 'Monje sin Rostro', art: monkArt, palette: { a: '#7A1E34', b: '#24060F', d: '#0C0408', e: '#FF6B8E' },
      scale: 1, size3d: 0.95, lift: 0, float: false, glow: '#FF6B8E', frameMs: 700,
      stats: { hp: 2, moveEvery: 1300, erratic: 0, lurch: 2, from: 4, weight: 1.4 }
    },
    {
      id: 'hanged', name: 'Ahorcado', art: hangedArt, palette: { a: '#7E9180', b: '#2C362F', c: '#9A98B0', d: VOID, e: '#C8FF7A' },
      scale: 1, size3d: 0.95, lift: 0.1, float: false, glow: '#C8FF7A', frameMs: 900,
      stats: { hp: 1, moveEvery: 520, erratic: 0, ambush: 5, wakeAfterMs: 9000, from: 5, weight: 1.2 }
    },
    {
      id: 'eater', name: 'Devorador de Luz', art: eaterArt, palette: { a: '#9F7BFF', b: '#140C26', d: VOID, e: '#F2E86B' },
      scale: 1.1, size3d: 0.8, lift: 0.35, float: true, glow: '#9F7BFF', frameMs: 600,
      stats: { hp: 1, moveEvery: 1150, erratic: 0, phase: true, from: 6, weight: 1.2 }
    },
    {
      id: 'boss_pawn', bossName: 'Peón Hueco', name: 'Peón Hueco', art: pawnBossArt, palette: { a: '#D6CBB8', b: '#5E5244', d: VOID, e: '#FF3B6B' },
      scale: 1.9, size3d: 1.35, lift: 0, float: false, glow: BLOOD, frameMs: 500, boss: true,
      stats: { moveEvery: 900, summons: ['ghost', 'larva'] }
    },
    {
      id: 'boss_wall', bossName: 'El Muro', name: 'El Muro', art: wallBossArt, palette: { a: '#5A4E78', b: '#1E1B2E', d: VOID, e: '#FF5A3B' },
      scale: 2, size3d: 1.5, lift: 0, float: false, glow: '#FF5A3B', frameMs: 650, boss: true,
      stats: { moveEvery: 1000, summons: ['crawler', 'ghost'] }
    },
    {
      id: 'boss_bishop', bossName: 'Obispo Hueco', name: 'Obispo Hueco', art: bishopBossArt, palette: { a: '#6A2E80', b: '#1C0A24', d: VOID, e: '#9CFFC8' },
      scale: 2, size3d: 1.5, lift: 0, float: false, glow: '#9CFFC8', frameMs: 450, boss: true,
      stats: { moveEvery: 900, summons: ['crow', 'spider'] }
    },
    {
      id: 'boss_rook', bossName: 'Torre Ciega', name: 'Torre Ciega', art: rookBossArt, palette: { a: '#4A5068', b: '#141622', d: VOID, e: '#7FE0D0' },
      scale: 2, size3d: 1.55, lift: 0, float: false, glow: '#7FE0D0', frameMs: 550, boss: true,
      stats: { moveEvery: 950, summons: ['monk', 'wraith'] }
    },
    {
      id: 'boss_queen', bossName: 'Reina Marchita', name: 'Reina Marchita', art: queenBossArt, palette: { a: '#8A1A3A', b: '#22040E', d: VOID, e: '#FFE3A0' },
      scale: 2.1, size3d: 1.6, lift: 0, float: false, glow: '#FF5A82', frameMs: 480, boss: true,
      stats: { moveEvery: 850, summons: ['hand', 'wraith', 'eater'] }
    }
  ];

  const byId = {};
  const byBossName = {};
  for (const entry of ENTRIES) {
    entry.frames = [entry.art(entry.palette, 0), entry.art(entry.palette, 1)];
    entry.svg = entry.frames[0];
    byId[entry.id] = entry;
    if (entry.bossName) byBossName[entry.bossName] = entry;
  }

  const cache = {};
  const canRaster = typeof document !== 'undefined' && typeof Image !== 'undefined';

  function load(key, svgText) {
    const slot = { ready: null };
    cache[key] = slot;
    if (!canRaster) return slot;
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = RASTER;
      canvas.height = RASTER;
      canvas.getContext('2d').drawImage(img, 0, 0, RASTER, RASTER);
      slot.ready = canvas;
    };
    img.onerror = function () {
      slot.failed = true;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    return slot;
  }

  function image(id, tint, frame) {
    const entry = byId[id];
    if (!entry) return null;
    const index = frame ? 1 : 0;
    const key = id + '|' + (tint || '') + '|' + index;
    let slot = cache[key];
    if (!slot) {
      const svgText = tint ? entry.art(Object.assign({}, entry.palette, { a: tint }), index) : entry.frames[index];
      slot = load(key, svgText);
    }
    if (slot.ready) return slot.ready;
    return tint ? image(id, null, index) : null;
  }

  G.bestiary = {
    entries: ENTRIES,
    normals: ENTRIES.filter(function (entry) { return !entry.boss; }),
    get: function (id) {
      return byId[id] || null;
    },
    boss: function (name) {
      return byBossName[name] || null;
    },
    forEnemy: function (enemy) {
      if (!enemy) return null;
      if (enemy.kind === 'boss') return byBossName[enemy.name] || null;
      return byId[enemy.kind] || null;
    },
    frameOf: function (entry, enemy, now) {
      return Math.floor((now + enemy.id * 137) / (entry.frameMs || 400)) % 2;
    },
    image: image
  };

  if (canRaster) {
    for (const entry of ENTRIES) {
      image(entry.id, null, 0);
      image(entry.id, null, 1);
      if (entry.boss) {
        image(entry.id, '#F2B8C6', 0);
        image(entry.id, '#F2B8C6', 1);
      }
    }
  }
})();
