G.sim = (function () {
  function create(seed) {
    const maze = G.maze.generate(seed);
    return {
      now: 0,
      phase: 'title',
      seed,
      nextId: 1,
      events: [],
      maze,
      players: [{
        id: 0,
        x: maze.start.x,
        y: maze.start.y,
        dir: { dx: 0, dy: -1 },
        piece: 'pawn',
        unlocked: ['pawn'],
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
    state.events.push({ type: 'wave', n, boss: !!state.wave.boss });
  }

  function unlockNext(state, player) {
    const next = G.CFG.pieceOrder.find((piece) => !player.unlocked.includes(piece));
    if (!next) return;
    player.unlocked.push(next);
    state.events.push({ type: 'unlock', piece: next });
  }

  function applyMove(state, player, target) {
    const piece = player.piece;
    const from = { x: player.x, y: player.y };
    player.cooldownUntil = state.now + G.CFG.cooldowns[piece];
    const enemy = G.enemyAt(state, target.x, target.y);
    if (enemy) {
      const result = G.enemies.hit(state, enemy, player, piece);
      if (result.blocked) return;
      if (result.killed) {
        state.enemies = state.enemies.filter((other) => other.id !== enemy.id);
        player.kills++;
        if (enemy.kind === 'boss') {
          unlockNext(state, player);
          if (state.wave.n >= G.CFG.maxWaves) {
            state.phase = 'won';
            state.events.push({ type: 'win' });
          }
        }
      }
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
    if (command.type === 'moveTo' && state.now >= player.cooldownUntil) {
      const target = G.pieces.targets(state, player).find((cell) => cell.x === command.x && cell.y === command.y);
      if (target) applyMove(state, player, target);
    }
  }

  function advanceWaves(state, now) {
    const wave = state.wave;
    if (wave.phase === 'fighting') {
      if (state.enemies.length === 0 && wave.toSpawn === 0) {
        wave.phase = 'intermission';
        wave.nextWaveAt = now + G.CFG.intermissionMs;
      }
    } else if (wave.n > 0 && now >= wave.nextWaveAt && wave.n < G.CFG.maxWaves) {
      beginWave(state, wave.n + 1);
    }
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
