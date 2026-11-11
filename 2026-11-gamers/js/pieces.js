G.pieces = (function () {
  const SLIDE_LIMIT = 1;
  const LIMITED_SLIDERS = ['rook', 'bishop', 'queen'];
  const CARDINALS =[[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  function diagonalOpen(maze, x, y, dx, dy) {
    return !(G.isWall(maze, x + dx, y) && G.isWall(maze, x, y + dy));
  }

  function stepAllowed(maze, x, y, dx, dy) {
    if (G.isWall(maze, x + dx, y + dy)) return false;
    return dx === 0 || dy === 0 || diagonalOpen(maze, x, y, dx, dy);
  }

  function ray(state, player, dx, dy, maxSteps, out) {
    let x = player.x;
    let y = player.y;
    for (let step = 0; step < maxSteps; step++) {
      if (!stepAllowed(state.maze, x, y, dx, dy)) return;
      x += dx;
      y += dy;
      const enemy = G.enemyAt(state, x, y);
      if (enemy) {
        out.push({ x, y, capture: true });
        return;
      }
      out.push({ x, y, capture: false });
    }
  }

  function targets(state, player) {
    const out = [];
    const maze = state.maze;
    switch (player.piece) {
      case 'pawn': {
        for (const [dx, dy] of CARDINALS) {
          if (stepAllowed(maze, player.x, player.y, dx, dy) && !G.enemyAt(state, player.x + dx, player.y + dy)) {
            out.push({ x: player.x + dx, y: player.y + dy, capture: false });
          }
        }
        const fx = player.dir.dx;
        const fy = player.dir.dy;
        for (const side of [1, -1]) {
          const dx = fx - fy * side;
          const dy = fy + fx * side;
          if (stepAllowed(maze, player.x, player.y, dx, dy) && G.enemyAt(state, player.x + dx, player.y + dy)) {
            out.push({ x: player.x + dx, y: player.y + dy, capture: true });
          }
        }
        break;
      }
      case 'knight':
        for (const [dx, dy] of KNIGHT) {
          const x = player.x + dx;
          const y = player.y + dy;
          if (G.isWall(maze, x, y)) continue;
          out.push({ x, y, capture: !!G.enemyAt(state, x, y) });
        }
        break;
      case 'bishop':
        for (const [dx, dy] of DIAGONALS) ray(state, player, dx, dy, 99, out);
        break;
      case 'rook':
        for (const [dx, dy] of CARDINALS) ray(state, player, dx, dy, 99, out);
        break;
      case 'queen':
        for (const [dx, dy] of CARDINALS) ray(state, player, dx, dy, 99, out);
        for (const [dx, dy] of DIAGONALS) ray(state, player, dx, dy, 99, out);
        break;
      case 'king':
        for (const [dx, dy] of CARDINALS.concat(DIAGONALS)) ray(state, player, dx, dy, 1, out);
        break;
    }
    return out;
  }

  function slide(state, player, dx, dy, full) {
    const options = targets(state, player);
    if (player.piece === 'knight') {
      if (dx !== 0 && dy !== 0) return null;
      const side = dx === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      const candidates = side
        .map(([sx, sy]) => ({ x: player.x + dx * 2 + sx, y: player.y + dy * 2 + sy }))
        .map((cell) => options.find((option) => option.x === cell.x && option.y === cell.y))
        .filter(Boolean);
      return candidates.find((option) => option.capture) || candidates[0] || null;
    }
    let best = null;
    let bestDistance = 0;
    const limit = !full && LIMITED_SLIDERS.includes(player.piece) ? SLIDE_LIMIT : Infinity;
    for (const option of options) {
      const offsetX = option.x - player.x;
      const offsetY = option.y - player.y;
      const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
      if (distance > limit) continue;
      if (offsetX === dx * distance && offsetY === dy * distance && distance > bestDistance) {
        best = option;
        bestDistance = distance;
      }
    }
    return best;
  }

  return { targets, slide };
})();
