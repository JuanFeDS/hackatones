(function () {
  const G = (window.G = window.G || {});
  const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BOSSES = {
    2: { name: 'Peón Hueco', weakTo: ['pawn'] },
    4: { name: 'El Muro', weakTo: ['knight'] },
    6: { name: 'Obispo Hueco', weakTo: ['bishop'] },
    8: { name: 'Torre Ciega', weakTo: ['rook'] },
    10: { name: 'Reina Marchita', weakTo: ['queen'] }
  };
  const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SPAWN_EVERY_MS = 380;
  const EARLY_SPAWN_EVERY_MS = 750;
  const EARLY_WAVES = 2;
  const EARLY_SLOW = 1.2;
  const BFS_EVERY_MS = 500;
  const MIN_SPAWN_DISTANCE = 7;
  const FAST_FROM_WAVE = 7;
  const FAST_FACTOR = 0.82;
  const BOSS_MOVE_MS = 900;
  const BOSS_INVULN_MS = 1500;
  const BOSS_SUMMON_MS = 4000;
  const BOSS_SUMMON_COUNT = 2;
  const HIT_INVULN_MS = 250;
  const MAX_ENEMIES = 40;

  const cache = { state: null, at: -Infinity, field: null };

  function alivePlayers(state) {
    return state.players.filter((player) => player.alive);
  }

  function playerAt(state, x, y) {
    return state.players.some((player) => player.alive && player.x === x && player.y === y);
  }

  function distanceField(state) {
    const maze = state.maze;
    const field = new Int16Array(maze.w * maze.h).fill(-1);
    const queue = [];
    for (const player of alivePlayers(state)) {
      const index = player.y * maze.w + player.x;
      field[index] = 0;
      queue.push(index);
    }
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      const x = index % maze.w;
      const y = (index - x) / maze.w;
      for (const dir of CARDINALS) {
        const nx = x + dir[0];
        const ny = y + dir[1];
        if (G.isWall(maze, nx, ny)) continue;
        const next = ny * maze.w + nx;
        if (field[next] === -1) {
          field[next] = field[index] + 1;
          queue.push(next);
        }
      }
    }
    return field;
  }

  function currentField(state, now) {
    if (cache.state !== state || now < cache.at || now - cache.at >= BFS_EVERY_MS) {
      cache.state = state;
      cache.at = now;
      cache.field = distanceField(state);
    }
    return cache.field;
  }

  function isFree(state, x, y) {
    return !G.isWall(state.maze, x, y) && !G.enemyAt(state, x, y) && !playerAt(state, x, y);
  }

  function statsOf(kind) {
    const entry = G.bestiary.get(kind);
    return entry ? entry.stats : { hp: 1, moveEvery: 700, erratic: 0.2 };
  }

  function moveEveryFor(state, kind) {
    if (kind === 'boss') return BOSS_MOVE_MS;
    const stats = statsOf(kind);
    if (!state.wave || state.wave.n <= EARLY_WAVES) return Math.round(stats.moveEvery * EARLY_SLOW);
    if (state.wave.n < FAST_FROM_WAVE) return stats.moveEvery;
    return stats.fastMoveEvery || Math.round(stats.moveEvery * FAST_FACTOR);
  }

  function pickKind(state) {
    const n = state.wave ? state.wave.n : 1;
    const pool = G.bestiary.normals.filter((entry) => entry.stats.from <= n);
    const wave = state.wave;
    if (wave) {
      wave.kinds = wave.kinds || [];
      const fresh = pool.filter((entry) => !wave.kinds.includes(entry.id));
      if (fresh.length && wave.kinds.length < 3) {
        const id = fresh[Math.floor(Math.random() * fresh.length)].id;
        wave.kinds.push(id);
        return id;
      }
    }
    let total = 0;
    for (const entry of pool) total += entry.stats.weight;
    let roll = Math.random() * total;
    for (const entry of pool) {
      roll -= entry.stats.weight;
      if (roll <= 0) return entry.id;
    }
    return pool.length ? pool[pool.length - 1].id : 'ghost';
  }

  function waveSize(n, boss) {
    return boss ? 4 + n : 6 + 2 * n;
  }

  function spawnEvery(state) {
    return state.wave.n <= EARLY_WAVES ? EARLY_SPAWN_EVERY_MS : SPAWN_EVERY_MS;
  }

  function createEnemy(state, kind, x, y, extra) {
    const moveEvery = moveEveryFor(state, kind);
    const entry = kind === 'boss' ? null : G.bestiary.get(kind);
    const hp = entry ? entry.stats.hp : 1;
    const enemy = {
      id: state.nextId++,
      kind,
      name: entry ? entry.name : kind,
      x,
      y,
      hp,
      maxHp: hp,
      nextMoveAt: state.now + moveEvery,
      moveEvery,
      invulnUntil: 0,
      weakTo: null,
      nextSummonAt: 0,
      bornAt: state.now,
      awake: !(entry && entry.stats.ambush)
    };
    Object.assign(enemy, extra || {});
    state.enemies.push(enemy);
    state.events.push({ type: 'spawn', x, y, kind });
    return enemy;
  }

  function spawnBoss(state, n) {
    const room = state.maze.bossRoom;
    const info = BOSSES[n];
    const field = distanceField(state);
    let best = null;
    let bestDistance = -2;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!isFree(state, x, y)) continue;
        const distance = field[y * state.maze.w + x];
        if (distance > bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    if (!best) return null;
    const maxHp = 3 + (n >= 6 ? 1 : 0) + (n >= 10 ? 1 : 0);
    const art = G.bestiary.boss(info.name);
    const moveEvery = art ? art.stats.moveEvery : BOSS_MOVE_MS;
    return createEnemy(state, 'boss', best.x, best.y, {
      name: info.name,
      hp: maxHp,
      maxHp,
      moveEvery,
      nextMoveAt: state.now + moveEvery,
      weakTo: info.weakTo.slice(),
      nextSummonAt: state.now + BOSS_SUMMON_MS
    });
  }

  function spawnOne(state) {
    const maze = state.maze;
    const field = distanceField(state);
    const players = alivePlayers(state);
    const far = [];
    const farManhattan = [];
    for (let y = 1; y < maze.h - 1; y++) {
      for (let x = 1; x < maze.w - 1; x++) {
        if (!isFree(state, x, y)) continue;
        const distance = field[y * maze.w + x];
        if (distance >= MIN_SPAWN_DISTANCE) far.push({ x, y });
        const manhattan = Math.min(...players.map((player) => Math.abs(player.x - x) + Math.abs(player.y - y)));
        if (manhattan >= MIN_SPAWN_DISTANCE) farManhattan.push({ x, y });
      }
    }
    const pool = far.length ? far : farManhattan;
    if (!pool.length) return false;
    const spot = pool[Math.floor(Math.random() * pool.length)];
    createEnemy(state, pickKind(state), spot.x, spot.y);
    return true;
  }

  function summonKind(boss) {
    const art = G.bestiary.boss(boss.name);
    const list = art && art.stats.summons && art.stats.summons.length ? art.stats.summons : ['ghost'];
    return list[Math.floor(Math.random() * list.length)];
  }

  function summonGhosts(state, boss) {
    const spots = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (isFree(state, boss.x + dx, boss.y + dy)) spots.push({ x: boss.x + dx, y: boss.y + dy });
      }
    }
    for (let i = 0; i < BOSS_SUMMON_COUNT && spots.length && state.enemies.length < MAX_ENEMIES; i++) {
      const pick = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      createEnemy(state, summonKind(boss), pick.x, pick.y);
    }
  }

  function stepWraith(state, enemy, players) {
    let target = players[0];
    let best = Infinity;
    for (const player of players) {
      const distance = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
      if (distance < best) {
        best = distance;
        target = player;
      }
    }
    const dx = Math.sign(target.x - enemy.x);
    const dy = Math.sign(target.y - enemy.y);
    const horizontalFirst = Math.abs(target.x - enemy.x) >= Math.abs(target.y - enemy.y);
    const options = horizontalFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const option of options) {
      if (option[0] === 0 && option[1] === 0) continue;
      const nx = enemy.x + option[0];
      const ny = enemy.y + option[1];
      if (nx < 1 || ny < 1 || nx > state.maze.w - 2 || ny > state.maze.h - 2) continue;
      if (G.enemyAt(state, nx, ny)) continue;
      enemy.x = nx;
      enemy.y = ny;
      return;
    }
  }

  function stepWalker(state, enemy, field, stats) {
    const maze = state.maze;
    const open = [];
    for (const dir of CARDINALS) {
      const nx = enemy.x + dir[0];
      const ny = enemy.y + dir[1];
      if (!G.isWall(maze, nx, ny) && !G.enemyAt(state, nx, ny)) open.push({ x: nx, y: ny, d: field[ny * maze.w + nx] });
    }
    if (stats.diagonal) {
      for (const dir of DIAGONALS) {
        const nx = enemy.x + dir[0];
        const ny = enemy.y + dir[1];
        if (G.isWall(maze, nx, ny) || G.isWall(maze, enemy.x + dir[0], enemy.y) || G.isWall(maze, enemy.x, enemy.y + dir[1])) continue;
        if (!G.enemyAt(state, nx, ny)) open.push({ x: nx, y: ny, d: field[ny * maze.w + nx] });
      }
    }
    if (!open.length) return;
    let choice = null;
    if (stats.erratic && Math.random() < stats.erratic) {
      choice = open[Math.floor(Math.random() * open.length)];
    } else {
      const here = field[enemy.y * maze.w + enemy.x];
      let bestDistance = here;
      for (const cell of open) {
        if (cell.d >= 0 && cell.d < bestDistance) {
          bestDistance = cell.d;
          choice = cell;
        }
      }
    }
    if (choice) {
      enemy.x = choice.x;
      enemy.y = choice.y;
    }
  }

  function removeEnemy(state, enemy) {
    const index = state.enemies.indexOf(enemy);
    if (index >= 0) state.enemies.splice(index, 1);
  }

  function teleportBoss(state, enemy, player) {
    const room = state.maze.bossRoom;
    const maze = state.maze;
    const roomSpots = [];
    const anySpots = [];
    for (let y = 1; y < maze.h - 1; y++) {
      for (let x = 1; x < maze.w - 1; x++) {
        if (!isFree(state, x, y)) continue;
        if (Math.abs(x - player.x) + Math.abs(y - player.y) < 6) continue;
        anySpots.push({ x, y });
        if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) roomSpots.push({ x, y });
      }
    }
    const pool = roomSpots.length ? roomSpots : anySpots;
    if (!pool.length) return;
    const spot = pool[Math.floor(Math.random() * pool.length)];
    enemy.x = spot.x;
    enemy.y = spot.y;
  }

  G.enemies = G.enemies || {};

  function isAwake(enemy, stats, players, now) {
    if (enemy.awake) return true;
    const near = players.some((player) => Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y) <= stats.ambush);
    if (near || now - (enemy.bornAt || 0) >= (stats.wakeAfterMs || 0)) enemy.awake = true;
    return enemy.awake;
  }

  function stepEnemy(state, enemy, players, field) {
    if (enemy.kind === 'boss') {
      stepWalker(state, enemy, field, {});
      return;
    }
    const stats = statsOf(enemy.kind);
    if (stats.phase) {
      stepWraith(state, enemy, players);
      return;
    }
    const steps = stats.lurch || 1;
    for (let i = 0; i < steps; i++) {
      if (playerAt(state, enemy.x, enemy.y)) return;
      stepWalker(state, enemy, field, stats);
    }
  }

  G.enemies.startWave = function (state, n) {
    const boss = n % 2 === 0 && !!BOSSES[n];
    state.wave = { n, boss, toSpawn: waveSize(n, boss), nextSpawnAt: state.now + SPAWN_EVERY_MS, phase: 'fighting', nextWaveAt: 0 };
    state.events.push({ type: 'wave', n, boss });
    if (boss) spawnBoss(state, n);
  };

  G.enemies.update = function (state, now) {
    if (state.phase !== 'playing') return;
    const wave = state.wave;
    if (wave && wave.phase === 'fighting' && wave.toSpawn > 0 && now >= wave.nextSpawnAt && state.enemies.length < MAX_ENEMIES) {
      if (alivePlayers(state).length && spawnOne(state)) wave.toSpawn--;
      wave.nextSpawnAt = now + spawnEvery(state);
    }
    const players = alivePlayers(state);
    if (!players.length) return;
    const field = currentField(state, now);
    for (const enemy of state.enemies.slice()) {
      if (enemy.kind === 'boss' && now >= enemy.nextSummonAt) {
        enemy.nextSummonAt = now + BOSS_SUMMON_MS;
        summonGhosts(state, enemy);
      }
      if (now < enemy.nextMoveAt) continue;
      enemy.nextMoveAt = now + enemy.moveEvery;
      if (enemy.kind !== 'boss' && !isAwake(enemy, statsOf(enemy.kind), players, now)) continue;
      stepEnemy(state, enemy, players, field);
      for (const player of players) {
        if (player.alive && player.x === enemy.x && player.y === enemy.y) G.sim.hurtPlayer(state, player);
      }
    }
  };

  G.enemies.hit = function (state, enemy, player, piece) {
    if (enemy.kind !== 'boss') {
      if (state.now < enemy.invulnUntil) {
        state.events.push({ type: 'blocked', x: enemy.x, y: enemy.y });
        return { killed: false, blocked: true };
      }
      enemy.hp--;
      if (enemy.hp > 0) {
        enemy.invulnUntil = state.now + HIT_INVULN_MS;
        state.events.push({ type: 'hit', x: enemy.x, y: enemy.y, enemyId: enemy.id });
        return { killed: false, blocked: true };
      }
      removeEnemy(state, enemy);
      player.kills++;
      state.events.push({ type: 'kill', x: enemy.x, y: enemy.y, kind: enemy.kind, pid: player.id });
      return { killed: true, blocked: false };
    }
    if ((enemy.weakTo && !enemy.weakTo.includes(piece)) || state.now < enemy.invulnUntil) {
      state.events.push({ type: 'blocked', x: enemy.x, y: enemy.y });
      return { killed: false, blocked: true };
    }
    enemy.hp--;
    if (enemy.hp <= 0) {
      removeEnemy(state, enemy);
      player.kills++;
      state.events.push({ type: 'kill', x: enemy.x, y: enemy.y, kind: 'boss', pid: player.id });
      return { killed: true, blocked: false };
    }
    state.events.push({ type: 'hit', x: enemy.x, y: enemy.y, enemyId: enemy.id });
    enemy.invulnUntil = state.now + BOSS_INVULN_MS;
    teleportBoss(state, enemy, player);
    return { killed: false, blocked: false };
  };
})();
