G.input = (function () {
  const HELD_AXES = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };
  const DIAGONAL_KEYS = { KeyQ: [-1, -1], KeyE: [1, -1], KeyZ: [-1, 1], KeyC: [1, 1] };
  const PENDING_MS = 250;

  const held = new Set();
  let pendingDir = null;
  let pendingAt = 0;
  let pendingSwitch = null;
  let wantsStart = false;
  let wantsRestart = false;
  let clickedCell = null;
  let hoverPixel = null;

  function heldVector() {
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

  function init(canvas) {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' || event.code === 'Space') wantsStart = true;
      if (event.code === 'KeyR') wantsRestart = true;
      const digit = /^Digit([1-6])$/.exec(event.code);
      if (digit) pendingSwitch = G.CFG.pieceOrder[Number(digit[1]) - 1];
      if (HELD_AXES[event.code] || DIAGONAL_KEYS[event.code]) {
        event.preventDefault();
        held.add(event.code);
        const vector = heldVector();
        if (vector) {
          pendingDir = vector;
          pendingAt = performance.now();
        }
      }
    });
    window.addEventListener('keyup', (event) => held.delete(event.code));
    window.addEventListener('blur', () => held.clear());
    canvas.addEventListener('mousemove', (event) => {
      hoverPixel = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('mouseleave', () => {
      hoverPixel = null;
    });
    canvas.addEventListener('mousedown', (event) => {
      wantsStart = true;
      wantsRestart = true;
      clickedCell = { x: event.clientX, y: event.clientY };
    });
  }

  function hover() {
    return hoverPixel ? G.activeRender.cellAt(hoverPixel.x, hoverPixel.y) : null;
  }

  function drain(state, now) {
    const commands = [];
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
    if (pendingSwitch) {
      commands.push({ playerId: player.id, type: 'switch', piece: pendingSwitch });
      pendingSwitch = null;
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

  return { init, drain, hover };
})();
