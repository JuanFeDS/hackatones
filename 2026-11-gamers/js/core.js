window.G = window.G || {};

G.CFG = {
  mazeW: 21,
  mazeH: 21,
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

G.THEMES = [
  {
    id: 'sotanos', name: 'LOS SÓTANOS', sub: 'Donde empieza el juego',
    texture: 'brick', wall: '#1E1B2E', wallEdge: '#6C5BD0', floorDark: '#1B1626', floorLight: '#2E2740',
    glow: '#C9B37E', fog: '#07060B', propWeights: {}
  },
  {
    id: 'criptas', name: 'LAS CRIPTAS', sub: 'La humedad guarda a los muertos',
    texture: 'moss', wall: '#14262A', wallEdge: '#3FA69B', floorDark: '#0F1C1F', floorLight: '#1D3236',
    glow: '#7FE0D0', fog: '#04100F',
    propWeights: { moss_crack: 3, ectoplasm: 3, coffin: 3, wall_hands: 2, cobweb: 2, torch: 0.5 }
  },
  {
    id: 'osario', name: 'EL OSARIO', sub: 'Huesos apilados hasta el techo',
    texture: 'bone', wall: '#3A3226', wallEdge: '#D8C9A0', floorDark: '#2A241B', floorLight: '#4A4132',
    glow: '#E0B070', fog: '#0D0A06',
    propWeights: { bones: 4, urn: 3, broken_piece: 2, cage: 3, hanging_chains: 3, blood_pool: 1.5 }
  },
  {
    id: 'biblioteca', name: 'LA BIBLIOTECA HUNDIDA', sub: 'Nadie volvió a leer sus libros',
    texture: 'shelves', wall: '#2B1D14', wallEdge: '#C9863A', floorDark: '#1E130D', floorLight: '#3A2616',
    glow: '#FFB060', fog: '#0B0604',
    propWeights: { candelabra: 3, candle_niche: 3, clock: 3, torn_banner: 3, offering: 2, urn: 1.5 }
  },
  {
    id: 'salon', name: 'EL SALÓN DEL TABLERO', sub: 'La última partida',
    texture: 'marble', wall: '#0F0F16', wallEdge: '#B3123A', floorDark: '#0A0A10', floorLight: '#5F5B70',
    glow: '#FF4060', fog: '#050308',
    propWeights: { statue: 3, giant_board: 3, blood_runes: 3, rune_circle: 2, blood_pool: 2, broken_column: 2 }
  }
];

G.PIECE_GLYPH ={ pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚' };

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
