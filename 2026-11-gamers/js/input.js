G.input = (function () {
  const HELD_AXES = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };
  const DIAGONAL_KEYS = { KeyQ: [-1, -1], KeyE: [1, -1], KeyZ: [-1, 1], KeyC: [1, 1] };
  const FIRST_PERSON_KEYS = {
    ArrowUp: [0, 1], KeyW: [0, 1],
    ArrowDown: [0, -1], KeyS: [0, -1],
    KeyA: [-1, 0], KeyD: [1, 0],
    KeyQ: [-1, 1], KeyE: [1, 1],
    KeyZ: [-1, -1], KeyC: [1, -1]
  };
  const PENDING_MS = 250;

  const held = new Set();
  let pendingDir = null;
  let pendingAt = 0;
  let pendingSwitch = null;
  let wantsStart = false;
  let wantsRestart = false;
  let clickedCell = null;
  let hoverPixel = null;
  let attackAt = -Infinity;
  let lastDrain = 0;
  let canvasRef = null;

  function firstPerson() {
    return G.view.free && G.activeRender === G.render3d;
  }

  function facing() {
    const quarter = ((Math.round(G.view.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    return [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }][quarter];
  }

  function relativeVector() {
    let right = 0;
    let forward = 0;
    for (const code of held) {
      if (FIRST_PERSON_KEYS[code]) {
        right += FIRST_PERSON_KEYS[code][0];
        forward += FIRST_PERSON_KEYS[code][1];
      }
    }
    right = Math.sign(right);
    forward = Math.sign(forward);
    if (!right && !forward) return null;
    const front = facing();
    const side = { dx: -front.dy, dy: front.dx };
    return {
      dx: Math.sign(front.dx * forward + side.dx * right),
      dy: Math.sign(front.dy * forward + side.dy * right)
    };
  }

  function heldVector() {
    if (firstPerson()) return relativeVector();
    let dx = 0;
    let dy = 0;
    for (const code of held) {
      if (HELD_AXES[code]) {
        dx += HELD_AXES[code][0];
        dy += HELD_AXES[code][1];
      } else if (DIAGONAL_KEYS[code]) {
        return { dx: DIAGONAL_KEYS[code][0], dy: DIAGONAL_KEYS[code][1] };
      }
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    return dx || dy ? { dx, dy } : null;
  }

  function isMoveKey(code) {
    return firstPerson() ? !!FIRST_PERSON_KEYS[code] : !!(HELD_AXES[code] || DIAGONAL_KEYS[code]);
  }

  function init(canvas) {
    canvasRef = canvas;
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' || event.code === 'Space') wantsStart = true;
      if (event.code === 'Space') {
        event.preventDefault();
        attackAt = performance.now();
      }
      if (event.code === 'KeyR') wantsRestart = true;
      const digit = /^Digit([1-6])$/.exec(event.code);
      if (digit) pendingSwitch = G.CFG.pieceOrder[Number(digit[1]) - 1];
      if (HELD_AXES[event.code] || DIAGONAL_KEYS[event.code]) {
        event.preventDefault();
        held.add(event.code);
        if (isMoveKey(event.code)) {
          const vector = heldVector();
          if (vector) {
            pendingDir = vector;
            pendingAt = performance.now();
          }
        }
      }
    });
    window.addEventListener('keyup', (event) => held.delete(event.code));
    window.addEventListener('blur', () => held.clear());
    document.addEventListener('mousemove', (event) => {
      if (firstPerson() && document.pointerLockElement === canvas) {
        G.view.yaw += event.movementX * G.view.sensitivity;
      }
    });
    canvas.addEventListener('mousemove', (event) => {
      hoverPixel = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('mouseleave', () => {
      hoverPixel = null;
    });
    canvas.addEventListener('mousedown', (event) => {
      wantsStart = true;
      wantsRestart = true;
      if (firstPerson()) {
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
        else attackAt = performance.now();
        return;
      }
      clickedCell = { x: event.clientX, y: event.clientY };
    });
  }

  function hover() {
    return hoverPixel ? G.activeRender.cellAt(hoverPixel.x, hoverPixel.y) : null;
  }

  function releasePointer() {
    if (document.pointerLockElement === canvasRef) document.exitPointerLock();
  }

  function drain(state, now) {
    const commands = [];
    const dt = Math.min(now - lastDrain, 100) / 1000;
    lastDrain = now;
    const consumedStart = wantsStart;
    const consumedRestart = wantsRestart;
    wantsStart = false;
    wantsRestart = false;
    if (state.phase === 'title' && consumedStart) commands.push({ type: 'start' });
    if ((state.phase === 'dead' || state.phase === 'won') && consumedRestart) commands.push({ type: 'restart' });
    if (state.phase !== 'playing') {
      clickedCell = null;
      pendingDir = null;
      pendingSwitch = null;
      return commands;
    }
    const player = state.players[0];
    if (firstPerson()) {
      const turn = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
      G.view.yaw += turn * G.view.turnRate * dt;
      const front = facing();
      if (front.dx !== player.dir.dx || front.dy !== player.dir.dy) {
        commands.push({ playerId: player.id, type: 'face', dx: front.dx, dy: front.dy });
      }
    }
    if (pendingSwitch) {
      commands.push({ playerId: player.id, type: 'switch', piece: pendingSwitch });
      pendingSwitch = null;
    }
    if (now - attackAt < PENDING_MS) {
      commands.push({ playerId: player.id, type: 'attack' });
      if (state.now >= player.cooldownUntil) attackAt = -Infinity;
    }
    if (clickedCell) {
      const cell = G.activeRender.cellAt(clickedCell.x, clickedCell.y);
      clickedCell = null;
      if (cell) commands.push({ playerId: player.id, type: 'moveTo', x: cell.x, y: cell.y });
    }
    let vector = heldVector();
    if (!vector && pendingDir && now - pendingAt < PENDING_MS) vector = pendingDir;
    if (vector) {
      const target = G.pieces.slide(state, player, vector.dx, vector.dy);
      if (target) {
        commands.push({ playerId: player.id, type: 'moveTo', x: target.x, y: target.y });
        if (!heldVector()) pendingDir = null;
      }
    }
    return commands;
  }

  return { init, drain, hover, releasePointer };
})();
