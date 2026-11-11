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

  const helpPanel = document.getElementById('help');
  const HELP_TOP_DOWN = [
    [['W', 'A', 'S', 'D'], 'Mover'],
    [['Q', 'E', 'Z', 'C'], 'Diagonales'],
    [['Espacio'], 'Atacar'],
    [['1', '–', '6'], 'Cambiar de ficha'],
    [['Shift'], 'Deslizar completo'],
    [['Clic'], 'Ir a casilla roja'],
    [['V'], 'Vista 1ª persona'],
    [['H'], 'Ocultar guía']
  ];
  const HELP_FIRST_PERSON = [
    [['W', 'S'], 'Avanzar / retroceder'],
    [['A', 'D'], 'Paso lateral'],
    [['←', '→'], 'Girar la cámara'],
    [['↑'], 'Atacar'],
    [['Z', 'C'], 'Diagonales atrás'],
    [['1', '–', '6'], 'Cambiar de ficha'],
    [['Shift'], 'Deslizar completo'],
    [['V'], 'Vista cenital'],
    [['H'], 'Ocultar guía']
  ];
  const HELP_AUTO_COLLAPSE_MS = 12000;
  let helpCollapsed = window.innerHeight < 520;
  let helpMode = null;
  let helpShownAt = null;

  function buildHelp(rows, title) {
    helpPanel.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = title;
    helpPanel.append(heading);
    for (const [keys, label] of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const keyBox = document.createElement('span');
      keyBox.className = 'keys';
      for (const key of keys) {
        const cap = document.createElement('kbd');
        cap.textContent = key;
        keyBox.append(cap);
      }
      const text = document.createElement('span');
      text.className = 'label';
      text.textContent = label;
      row.append(keyBox, text);
      helpPanel.append(row);
    }
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = 'H · controles';
    helpPanel.append(chip);
  }

  function updateHelp(now) {
    const show = state.phase === 'playing';
    if (helpPanel.hidden === show) helpPanel.hidden = !show;
    if (!show) return;
    if (helpShownAt === null) helpShownAt = now;
    else if (helpShownAt >= 0 && now - helpShownAt > HELP_AUTO_COLLAPSE_MS) {
      helpCollapsed = true;
      helpShownAt = -1;
    }
    const mode = G.activeRender === G.render3d ? 'pov' : 'top';
    if (mode !== helpMode) {
      helpMode = mode;
      if (mode === 'pov') buildHelp(HELP_FIRST_PERSON, 'Controles · 1ª persona');
      else buildHelp(HELP_TOP_DOWN, 'Controles · vista cenital');
    }
    helpPanel.classList.toggle('collapsed', helpCollapsed);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && !event.repeat) {
      helpCollapsed = !helpCollapsed;
      helpShownAt = -1;
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
    updateHelp(now);
    state.events.length = 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.G_STATE = state;
})();
