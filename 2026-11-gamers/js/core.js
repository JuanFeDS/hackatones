window.G = window.G || {};

G.CFG = {
  mazeW: 31,
  mazeH: 31,
  lightRadius: 3,
  maxWaves: 10,
  playerHp: 3,
  invulnMs: 1500,
  switchCooldownMs: 1000,
  intermissionMs: 3000,
  pieceOrder: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'],
  cooldowns: { pawn: 300, knight: 400, bishop: 330, rook: 330, queen: 330, king: 250 },
  colors: {
    void: '#07060B',
    wall: '#1E1B2E',
    player: '#C9B37E',
    ghost: '#7FE0D0',
    blood: '#B3123A'
  }
};

G.PIECE_GLYPH = { pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚' };

G.view = { free: false, yaw: -Math.PI / 2, pitch: 0, turnSmoothMs: 130, turnRepeatMs: 420 };

G.rng = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

G.isWall = function (maze, x, y) {
  if (x < 0 || y < 0 || x >= maze.w || y >= maze.h) return true;
  return maze.grid[y * maze.w + x] === 1;
};

G.enemyAt = function (state, x, y) {
  for (const enemy of state.enemies) if (enemy.x === x && enemy.y === y) return enemy;
  return null;
};
