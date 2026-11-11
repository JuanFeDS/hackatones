(function () {
  const G = (window.G = window.G || {});
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BOSS_ROOM = { x: 12, y: 12, w: 7, h: 7 };
  const BRAID_RATE = 1;
  const EXTRA_WALL_RATE = 0.3;

  function floorNeighbors(grid, w, x, y) {
    let count = 0;
    for (const dir of DIRS) if (grid[(y + dir[1]) * w + x + dir[0]] === 0) count++;
    return count;
  }

  function carveMaze(grid, w, h, rand) {
    const stack = [[1, 1]];
    grid[w + 1] = 0;
    while (stack.length) {
      const cell = stack[stack.length - 1];
      const options = [];
      for (const dir of DIRS) {
        const nx = cell[0] + dir[0] * 2;
        const ny = cell[1] + dir[1] * 2;
        if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && grid[ny * w + nx] === 1) options.push(dir);
      }
      if (!options.length) {
        stack.pop();
        continue;
      }
      const dir = options[Math.floor(rand() * options.length)];
      grid[(cell[1] + dir[1]) * w + cell[0] + dir[0]] = 0;
      grid[(cell[1] + dir[1] * 2) * w + cell[0] + dir[0] * 2] = 0;
      stack.push([cell[0] + dir[0] * 2, cell[1] + dir[1] * 2]);
    }
  }

  function braid(grid, w, h, rand) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y * w + x] !== 0 || floorNeighbors(grid, w, x, y) !== 1) continue;
        if (rand() >= BRAID_RATE) continue;
        const options = [];
        for (const dir of DIRS) {
          const wx = x + dir[0];
          const wy = y + dir[1];
          const fx = x + dir[0] * 2;
          const fy = y + dir[1] * 2;
          if (wx < 1 || wy < 1 || wx > w - 2 || wy > h - 2) continue;
          if (fx < 1 || fy < 1 || fx > w - 2 || fy > h - 2) continue;
          if (grid[wy * w + wx] === 1 && grid[fy * w + fx] === 0) options.push(dir);
        }
        if (!options.length) continue;
        const dir = options[Math.floor(rand() * options.length)];
        grid[(y + dir[1]) * w + x + dir[0]] = 0;
      }
    }
  }

  function countReachable(grid, w, h, originIndex) {
    const seen = new Uint8Array(w * h);
    const queue = [originIndex];
    seen[originIndex] = 1;
    let reached = 0;
    while (queue.length) {
      const index = queue.pop();
      reached++;
      const x = index % w;
      const y = (index - x) / w;
      for (const dir of DIRS) {
        const nx = x + dir[0];
        const ny = y + dir[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = ny * w + nx;
        if (grid[next] === 0 && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return reached;
  }

  function addExtraWalls(grid, w, h, rand) {
    let floors = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === 0) floors++;
    const candidates = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) if (grid[y * w + x] === 0) candidates.push(y * w + x);
    }
    for (const index of candidates) {
      if (rand() >= EXTRA_WALL_RATE) continue;
      grid[index] = 1;
      const origin = grid.indexOf(0);
      if (countReachable(grid, w, h, origin) === floors - 1) floors--;
      else grid[index] = 0;
    }
  }

  function overlaps(a, b, margin) {
    return a.x - margin < b.x + b.w && a.x + a.w + margin > b.x && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y;
  }

  function placeRooms(w, h, rand) {
    const wanted = 9 + Math.floor(rand() * 4);
    const rooms = [];
    for (let attempt = 0; attempt < 1500 && rooms.length < wanted; attempt++) {
      const roomW = 3 + Math.floor(rand() * 4);
      const roomH = 3 + Math.floor(rand() * 4);
      const room = {
        x: 1 + Math.floor(rand() * (w - 2 - roomW)),
        y: 1 + Math.floor(rand() * (h - 2 - roomH)),
        w: roomW,
        h: roomH
      };
      if (overlaps(room, BOSS_ROOM, 1)) continue;
      if (rooms.some((other) => overlaps(room, other, 1))) continue;
      rooms.push(room);
    }
    return rooms;
  }

  function carveRoom(grid, w, room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) grid[y * w + x] = 0;
    }
  }

  function farthestRoomFromCenter(rooms, w, h) {
    const centerX = (w - 1) / 2;
    const centerY = (h - 1) / 2;
    let best = rooms[0];
    let bestDistance = -1;
    for (const room of rooms) {
      const distance = Math.abs(room.x + room.w / 2 - centerX) + Math.abs(room.y + room.h / 2 - centerY);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = room;
      }
    }
    return best;
  }

  G.maze = G.maze || {};

  G.maze.generate = function (seed) {
    const w = G.CFG.mazeW;
    const h = G.CFG.mazeH;
    const rand = G.rng(seed);
    const grid = new Array(w * h).fill(1);
    carveMaze(grid, w, h, rand);
    braid(grid, w, h, rand);
    addExtraWalls(grid, w, h, rand);
    const rooms = placeRooms(w, h, rand);
    for (const room of rooms) carveRoom(grid, w, room);
    const bossRoom = { x: BOSS_ROOM.x, y: BOSS_ROOM.y, w: BOSS_ROOM.w, h: BOSS_ROOM.h };
    carveRoom(grid, w, bossRoom);
    const startRoom = farthestRoomFromCenter(rooms, w, h);
    const start = { x: startRoom.x + Math.floor(startRoom.w / 2), y: startRoom.y + Math.floor(startRoom.h / 2) };
    return { w, h, grid, rooms, start, bossRoom };
  };
})();
