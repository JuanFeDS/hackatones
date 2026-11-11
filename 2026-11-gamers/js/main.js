(function () {
  const canvas = document.getElementById('game');
  const state = G.sim.create((Math.random() * 1e9) | 0);
  let audioStarted = false;

  G.render.init(canvas);
  G.input.init(canvas);

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
    G.render.draw(state, now, ui);
    G.audio.update(state, now);
    state.events.length = 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.G_STATE = state;
})();
