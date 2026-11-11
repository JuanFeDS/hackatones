# Gambito de Sombras — contrato de módulos

Reto 2026-11-gamers: juego de navegador en 45 min. Laberinto de terror en cuadrícula; el jugador es una ficha de ajedrez en tiempo real (cooldown por pieza) que solo ataca como esa pieza.

Scripts clásicos (sin módulos ES, abre desde `file://`). Todo cuelga de `window.G`. Cada archivo en `js/` tiene un único dueño.

## Reglas cerradas

- Cuadrícula 31x31. `maze.grid[y*w+x]`: 1 = pared, 0 = suelo.
- Piezas (orden de desbloqueo, un jefe derrotado desbloquea la siguiente): pawn → knight → bishop → rook → queen → king. Teclas 1-6 cambian de pieza (cooldown de cambio 1 s). Cooldowns de movimiento en `G.CFG.cooldowns`.
- Peón: "adelante" = última dirección cardinal de movimiento (`player.dir`). Se mueve 1 casilla cardinal libre; ataca solo en las 2 diagonales frontales.
- Torre/alfil/dama deslizan hasta pared o enemigo (el enemigo muere). Alfil/rey/dama en diagonal: un paso diagonal se bloquea si las dos casillas ortogonales adyacentes son pared. Caballo salta en L ignorando paredes (destino libre).
- Fantasmas (`ghost`): 1 casilla cada 700 ms (400 ms en oleadas tardías), BFS al jugador cada 500 ms, 20% errático, no atraviesan paredes. Espectro (`wraith`, desde oleada 4): atraviesa paredes, 900 ms. Si entra en la casilla del jugador: -1 corazón + 1,5 s invulnerabilidad.
- Oleada n: 2+n fantasmas en bordes/lejos del jugador. Jefe en oleadas pares (2,4,6,8,10). Victoria al matar el jefe de la oleada 10 (`CFG.maxWaves`).
- Jefe: 1 casilla, 3-5 PV, cada golpe válido lo teletransporta y le da 1,5 s de invulnerabilidad; invoca 2 fantasmas cada 4 s. `weakTo`: lista de piezas que sí le hacen daño (la pieza recién desbloqueada, p. ej.); con otra pieza el golpe rebota (`blocked`).

## Estado (`G.state`, creado por `G.sim.create(seed)`)

```
state = {
  now, phase: 'title'|'playing'|'dead'|'won', nextId, events: [],
  maze: { w, h, grid, rooms: [{x,y,w,h}], start:{x,y}, bossRoom:{x,y,w,h} },
  players: [ { id, x, y, dir:{dx,dy}, piece, unlocked:[...], hp, maxHp,
               invulnUntil, cooldownUntil, switchUntil, kills, alive } ],
  enemies: [ { id, kind:'ghost'|'wraith'|'boss', name, x, y, hp, maxHp,
               nextMoveAt, moveEvery, invulnUntil, weakTo:null|[piece], nextSummonAt } ],
  wave: { n, boss:boolean, toSpawn, nextSpawnAt, phase:'fighting'|'intermission', nextWaveAt }
}
```
`players` siempre es array (multijugador futuro). Eventos transitorios en `state.events` (limpiados por main tras renderizar), forma `{type, ...}`:
`move{pid,from:{x,y},to:{x,y},piece}`, `kill{x,y,kind,pid}`, `hit{x,y,enemyId}` (jefe herido), `blocked{x,y}`, `hurt{pid,x,y}`, `spawn{x,y,kind}`, `wave{n,boss}`, `unlock{piece}`, `switch{pid,piece}`, `death{pid}`, `win{}`.

## Comandos (entrada → sim), objetos `{playerId, type, ...}`

- `{type:'moveTo', x, y}`: validado por `G.pieces.targets`.
- `{type:'switch', piece}`.
- `{type:'start'}` / `{type:'restart'}`.
Input traduce teclas/clic a comandos; el sim nunca ve teclas. (Para online: otra fuente de comandos.)

## APIs por módulo

- `maze.js` → `G.maze.generate(seed) : maze`. DFS recursive backtracker impar 31x31, braid (quitar 70% de callejones), 5-7 salas 3x3 a 5x5 + sala central 7x7 (`bossRoom`), 8% paredes internas extra. Borde exterior siempre pared. `start` en una sala lejos del centro.
- `enemies.js` → `G.enemies.startWave(state, n)` (rellena `state.wave`), `G.enemies.update(state, now)` (spawn gradual, movimiento/BFS, invocaciones del jefe, daño al jugador vía `G.sim.hurtPlayer(state, player)`), `G.enemies.hit(state, enemy, player, piece) : {killed:boolean, blocked:boolean}` (aplica reglas de jefe: `weakTo`, invulnerabilidad, teletransporte, PV; emite `hit`/`kill`/`blocked`; no desbloquea piezas, eso lo hace sim). Nombres de jefes sugeridos: Obispo Hueco (bishop), El Muro (knight), Torre Ciega (rook), Reina Marchita (queen), Rey Sin Corona (king).
- `pieces.js` → `G.pieces.targets(state, player) : [{x,y,capture}]`, `G.pieces.slide(state, player, dx, dy) : {x,y}|null` (destino para un atajo de teclado).
- `sim.js` → `G.sim.create(seed)`, `G.sim.step(state, now, commands)`, `G.sim.hurtPlayer(state, player)`.
- `render.js` → `G.render.init(canvas)`, `G.render.draw(state, now, ui)` con `ui = {targets:[...], hover:{x,y}|null}`, `G.render.cellAt(px, py) : {x,y}`. Dibuja mundo, niebla (radio `CFG.lightRadius`, casillas atacables teñidas de `blood` con pulso), enemigos fuera de luz al 15%, HUD (corazones, barra de piezas 1-6 con candados y cooldown, oleada), pantallas title/dead/won. Pantalla title: "clic o Enter para empezar".
- `fx.js` → `G.fx.ingest(events)`, `G.fx.update(dtMs)`, `G.fx.draw(ctx, camera)`, `G.fx.shake` (px actuales), partículas de ectoplasma, glitch. Lo invoca render.
- `audio.js` → `G.audio.init()` (tras primer gesto), `G.audio.update(state, now)` (drone 55 Hz + detune lento, tic de madera al mover, acorde disonante al matar, latido que acelera si un fantasma está a ≤2 casillas), consume eventos.
- `input.js` / `main.js` / `core.js` / `pieces.js` / `sim.js`: Claude principal.

## Bucle (main.js)

`commands = G.input.drain(state)` → `G.sim.step(state, now, commands)` → `G.render.draw(...)` → `G.audio.update` → `state.events.length = 0`.
