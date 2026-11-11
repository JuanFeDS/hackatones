G.sim = (function () {
  const WHIFF_COOLDOWN_MS = 250;
  const LEVEL_CHANGE_MS = 4200;

  function create(seed) {
    const theme = G.THEMES[0];
    const maze = G.maze.generate(seed);
    return {
      now: 0,
      phase: 'title',
      seed,
      level: 1,
      theme,
      transition: null,
      nextId: 1,
      events: [],
      maze,
      props: G.props.generate(maze, seed, theme),
      players: [{
        id: 0,
        x: maze.start.x,
        y: maze.start.y,
        dir: { dx: 0, dy: -1 },
        piece: 'pawn',
        unlocked: [...G.CFG.pieceOrder],
        hp: G.CFG.playerHp,
        maxHp: G.CFG.playerHp,
        invulnUntil: 0,
        cooldownUntil: 0,
        switchUntil: 0,
        kills: 0,
        alive: true
      }],
      enemies: [],
      wave: { n: 0, boss: false, toSpawn: 0, nextSpawnAt: 0, phase: 'intermission', nextWaveAt: 0 }
    };
  }

  function hurtPlayer(state, player) {
    if (!player.alive || state.now < player.invulnUntil) return;
    player.hp--;
    player.invulnUntil = state.now + G.CFG.invulnMs;
    state.events.push({ type: 'hurt', pid: player.id, x: player.x, y: player.y });
    if (player.hp <= 0) {
      player.alive = false;
      state.events.push({ type: 'death', pid: player.id });
      if (state.players.every((other) => !other.alive)) state.phase = 'dead';
    }
  }

  function beginWave(state, n) {
    G.enemies.startWave(state, n);
  }

  function unlockNext(state, player) {
    const next = G.CFG.pieceOrder.find((piece) => !player.unlocked.includes(piece));
    if (!next) return;
    player.unlocked.push(next);
    state.events.push({ type: 'unlock', piece: next });
  }

  function resolveHit(state, player, enemy) {
    const result = G.enemies.hit(state, enemy, player, player.piece);
    if (result.killed) {
      state.enemies = state.enemies.filter((other) => other.id !== enemy.id);
      if (enemy.kind === 'boss') {
        unlockNext(state, player);
        if (state.wave.n >= G.CFG.maxWaves) {
          state.phase = 'won';
          state.events.push({ type: 'win' });
        }
      }
    }
    return result;
  }

  function applyAttack(state, player) {
    const captures = G.pieces.targets(state, player).filter((cell) => cell.capture);
    const origin = { x: player.x, y: player.y };
    if (!captures.length) {
      player.cooldownUntil = state.now + WHIFF_COOLDOWN_MS;
      state.events.push({ type: 'attack', pid: player.id, from: origin, to: null, dir: { dx: player.dir.dx, dy: player.dir.dy }, piece: player.piece });
      return;
    }
    const distance = (cell) => Math.max(Math.abs(cell.x - player.x), Math.abs(cell.y - player.y));
    captures.sort((first, second) => distance(first) - distance(second));
    const enemy = G.enemyAt(state, captures[0].x, captures[0].y);
    player.cooldownUntil = state.now + G.CFG.cooldowns[player.piece];
    state.events.push({ type: 'attack', pid: player.id, from: origin, to: { x: enemy.x, y: enemy.y }, dir: { dx: player.dir.dx, dy: player.dir.dy }, piece: player.piece });
    resolveHit(state, player, enemy);
  }

  function applyMove(state, player, target) {
    const piece = player.piece;
    const from = { x: player.x, y: player.y };
    player.cooldownUntil = state.now + G.CFG.cooldowns[piece];
    const enemy = G.enemyAt(state, target.x, target.y);
    if (enemy) {
      const result = resolveHit(state, player, enemy);
      if (result.blocked) return;
    }
    const offsetX = target.x - from.x;
    const offsetY = target.y - from.y;
    if (offsetX === 0 || offsetY === 0) {
      player.dir = { dx: Math.sign(offsetX), dy: Math.sign(offsetY) };
    }
    player.x = target.x;
    player.y = target.y;
    state.events.push({ type: 'move', pid: player.id, from, to: { x: target.x, y: target.y }, piece });
  }

  function handleCommand(state, command) {
    if (command.type === 'start') {
      if (state.phase !== 'title') return;
      state.phase = 'playing';
      beginWave(state, 1);
      return;
    }
    if (command.type === 'restart') {
      if (state.phase === 'dead' || state.phase === 'won') {
        Object.assign(state, create(state.seed + 1));
        state.phase = 'playing';
        beginWave(state, 1);
      }
      return;
    }
    if (state.phase !== 'playing') return;
    const player = state.players.find((candidate) => candidate.id === command.playerId);
    if (!player || !player.alive) return;
    if (command.type === 'switch') {
      if (player.unlocked.includes(command.piece) && player.piece !== command.piece && state.now >= player.switchUntil) {
        player.piece = command.piece;
        player.switchUntil = state.now + G.CFG.switchCooldownMs;
        state.events.push({ type: 'switch', pid: player.id, piece: command.piece });
      }
      return;
    }
    if (command.type === 'face') {
      player.dir = { dx: command.dx, dy: command.dy };
      return;
    }
    if (command.type === 'attack' &&state.now >= player.cooldownUntil) {
      applyAttack(state, player);
      return;
    }
    if (command.type === 'moveTo' && state.now >= player.cooldownUntil) {
      const target = G.pieces.targets(state, player).find((cell) => cell.x === command.x && cell.y === command.y);
      if (target) applyMove(state, player, target);
    }
  }

  function enterNextLevel(state) {
    state.level++;
    state.theme = G.THEMES[Math.min(state.level, G.THEMES.length) - 1];
    const levelSeed = state.seed * 31 + state.level;
    state.maze = G.maze.generate(levelSeed);
    state.props = G.props.generate(state.maze, levelSeed, state.theme);
    state.enemies = [];
    for (const player of state.players) {
      player.x = state.maze.start.x;
      player.y = state.maze.start.y;
      player.dir = { dx: 0, dy: -1 };
    }
    state.transition.swapped = true;
    state.events.push({ type: 'level', n: state.level, name: state.theme.name, sub: state.theme.sub });
  }

  function advanceWaves(state, now) {
    const wave = state.wave;
    if (wave.phase === 'fighting') {
      if (state.enemies.length === 0 && wave.toSpawn === 0) {
        wave.phase = 'intermission';
        if (wave.boss && wave.n < G.CFG.maxWaves) {
          wave.nextWaveAt = now + LEVEL_CHANGE_MS;
          state.transition = { start: now + LEVEL_CHANGE_MS - 1600, swapAt: wave.nextWaveAt, end: wave.nextWaveAt + 2600, swapped: false };
        } else {
          wave.nextWaveAt = now + G.CFG.intermissionMs;
        }
      }
    } else if (wave.n > 0 && now >= wave.nextWaveAt && wave.n < G.CFG.maxWaves) {
      if (state.transition && !state.transition.swapped) enterNextLevel(state);
      beginWave(state, wave.n + 1);
    }
    if (state.transition && now > state.transition.end) state.transition = null;
  }

  function step(state, now, commands) {
    state.now = now;
    for (const command of commands) handleCommand(state, command);
    if (state.phase !== 'playing') return;
    G.enemies.update(state, now);
    advanceWaves(state, now);
  }

  return { create, step, hurtPlayer };
})();
