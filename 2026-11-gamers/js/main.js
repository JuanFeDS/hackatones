(function () {
  const canvas = document.getElementById('game');
  const state = G.sim.create((Math.random() * 1e9) | 0);
  let audioStarted = false;

  G.activeRender = G.render;
  G.render.init(canvas);
  if (G.render3d) G.render3d.init(canvas);
  G.input.init(canvas);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyV' && G.render3d) {
      G.activeRender = G.activeRender === G.render ? G.render3d : G.render;
      G.view.free = G.activeRender === G.render3d;
      if (G.view.free) {
        const dir = state.players[0].dir;
        G.view.yaw = Math.atan2(dir.dy, dir.dx);
      }
    }
  });

  function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    G.audio.init();
  }
  window.addEventListener('keydown', startAudio);
  window.addEventListener('mousedown', startAudio);

  function frame(now) {
    const commands = G.input.drain(state, now);
    G.sim.step(state, now, commands);
    const player = state.players[0];
    const ui = {
      targets: state.phase === 'playing' && player.alive ? G.pieces.targets(state, player) : [],
      hover: G.input.hover()
    };
    G.activeRender.draw(state, now, ui);
    G.audio.update(state, now);
    state.events.length = 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.G_STATE = state;
})();
