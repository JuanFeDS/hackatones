(function () {
  'use strict';

  const G = (window.G = window.G || {});

  const audio = (G.audio = {});

  let ac = null;
  let dryBus = null;
  let wetBus = null;
  let noiseBuffer = null;
  let droneGain = null;
  let droneFilter = null;
  let heartNextAt = 0;
  let heartActive = false;
  let lastMood = -1;
  let lastResumeTry = 0;

  const TICK_PITCH = { pawn: 210, knight: 260, bishop: 300, rook: 170, queen: 240, king: 190 };

  function makeNoise(seconds) {
    const length = Math.floor(ac.sampleRate * seconds);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function makeReverb() {
    const seconds = 2.6;
    const length = Math.floor(ac.sampleRate * seconds);
    const buffer = ac.createBuffer(2, length, ac.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
      }
    }
    const convolver = ac.createConvolver();
    convolver.buffer = buffer;
    return convolver;
  }

  function route(node, wet) {
    node.connect(dryBus);
    if (wet > 0) {
      const send = ac.createGain();
      send.gain.value = wet;
      node.connect(send);
      send.connect(wetBus);
    }
  }

  function envelope(gainNode, t, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone(type, freq, t, peak, attack, decay, wet) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    envelope(gain, t, peak, attack, decay);
    osc.connect(gain);
    route(gain, wet || 0);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    return osc;
  }

  function noiseBurst(t, peak, decay, filterType, freq, q, wet) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ac.createGain();
    envelope(gain, t, peak, 0.004, decay);
    src.connect(filter);
    filter.connect(gain);
    route(gain, wet || 0);
    src.start(t, Math.random() * 1.4, decay + 0.1);
  }

  function woodTick(piece) {
    const t = ac.currentTime;
    const freq = TICK_PITCH[piece] || 220;
    const osc = tone('triangle', freq, t, 0.34, 0.003, 0.1, 0.1);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.06);
    noiseBurst(t, 0.22, 0.03, 'bandpass', 1800, 3, 0.05);
  }

  function dissonantChord(boss) {
    const t = ac.currentTime;
    const root = 130.8 * (1 + Math.random() * 0.25);
    const ratios = [1, 1.0595, 1.4142, 2.1189];
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 1.1);
    const gain = ac.createGain();
    envelope(gain, t, boss ? 0.3 : 0.17, 0.012, boss ? 2.2 : 1.1);
    filter.connect(gain);
    route(gain, 0.45);
    for (let i = 0; i < ratios.length; i++) {
      const osc = ac.createOscillator();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = root * ratios[i];
      osc.detune.value = (Math.random() - 0.5) * 14;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + (boss ? 2.4 : 1.3));
    }
  }

  function thump(t, peak, freq) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.14);
    envelope(gain, t, peak, 0.008, 0.16);
    osc.connect(gain);
    route(gain, 0.08);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  function heartbeat(intensity) {
    const t = ac.currentTime;
    thump(t, 0.5 * intensity, 62);
    thump(t + 0.17, 0.34 * intensity, 54);
  }

  function bossRumble() {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    envelope(gain, t, 0.75, 0.02, 1.6);
    osc.connect(gain);
    route(gain, 0.35);
    osc.start(t);
    osc.stop(t + 1.8);
    noiseBurst(t, 0.5, 1.5, 'lowpass', 220, 0.7, 0.4);
    tone('sawtooth', 55, t, 0.18, 0.05, 1.8, 0.4);
    tone('sawtooth', 58.3, t, 0.14, 0.05, 1.8, 0.4);
  }

  function bell(base, delay, peak) {
    const t = ac.currentTime + (delay || 0);
    const partials = [
      [1, 0.34, 3.6],
      [2.0, 0.16, 2.8],
      [2.76, 0.13, 2.1],
      [5.4, 0.07, 1.4],
      [8.93, 0.04, 0.9]
    ];
    for (let i = 0; i < partials.length; i++) {
      tone('sine', base * partials[i][0], t, partials[i][1] * (peak || 1), 0.004, partials[i][2], 0.5);
    }
  }

  function clang() {
    const t = ac.currentTime;
    tone('square', 420, t, 0.08, 0.002, 0.25, 0.25);
    tone('sine', 630, t, 0.16, 0.002, 0.4, 0.3);
    tone('sine', 1040, t, 0.1, 0.002, 0.3, 0.3);
    noiseBurst(t, 0.25, 0.05, 'highpass', 2500, 1, 0.1);
  }

  function dullThud() {
    const t = ac.currentTime;
    const osc = tone('triangle', 130, t, 0.3, 0.004, 0.12, 0.05);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
  }

  function hurtSound() {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    envelope(gain, t, 0.7, 0.01, 0.55);
    osc.connect(gain);
    route(gain, 0.2);
    osc.start(t);
    osc.stop(t + 0.7);
    noiseBurst(t, 0.35, 0.35, 'lowpass', 900, 0.8, 0.3);
  }

  function deathSound() {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 2.4);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 2.4);
    envelope(gain, t, 0.35, 0.02, 2.6);
    osc.connect(filter);
    filter.connect(gain);
    route(gain, 0.5);
    osc.start(t);
    osc.stop(t + 2.8);
  }

  function waveSwell() {
    const t = ac.currentTime;
    tone('sine', 110, t, 0.12, 0.8, 1.6, 0.5);
    tone('sine', 164.8, t, 0.06, 1.0, 1.4, 0.5);
  }

  function buildDrone() {
    droneFilter = ac.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 210;
    droneFilter.Q.value = 4;
    droneGain = ac.createGain();
    droneGain.gain.value = 0.0001;
    droneFilter.connect(droneGain);
    route(droneGain, 0.3);

    const lfoA = ac.createOscillator();
    const lfoB = ac.createOscillator();
    const lfoFilter = ac.createOscillator();
    lfoA.frequency.value = 0.05;
    lfoB.frequency.value = 0.037;
    lfoFilter.frequency.value = 0.08;
    const depthA = ac.createGain();
    const depthB = ac.createGain();
    const depthFilter = ac.createGain();
    depthA.gain.value = 22;
    depthB.gain.value = -17;
    depthFilter.gain.value = 70;
    lfoA.connect(depthA);
    lfoB.connect(depthB);
    lfoFilter.connect(depthFilter);
    depthFilter.connect(droneFilter.frequency);

    const voices = [
      ['sawtooth', 55, 0.5, depthA],
      ['sawtooth', 55, 0.5, depthB],
      ['sine', 27.5, 0.9, null],
      ['sine', 77.8, 0.22, depthA]
    ];
    for (let i = 0; i < voices.length; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = voices[i][0];
      osc.frequency.value = voices[i][1];
      gain.gain.value = voices[i][2];
      if (voices[i][3]) voices[i][3].connect(osc.detune);
      osc.connect(gain);
      gain.connect(droneFilter);
      osc.start();
    }
    lfoA.start();
    lfoB.start();
    lfoFilter.start();

    const wind = ac.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    const windGain = ac.createGain();
    windGain.gain.value = 0.022;
    const windLfo = ac.createOscillator();
    const windDepth = ac.createGain();
    windLfo.frequency.value = 0.07;
    windDepth.gain.value = 0.014;
    windLfo.connect(windDepth);
    windDepth.connect(windGain.gain);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    route(windGain, 0.4);
    wind.start();
    windLfo.start();
  }

  audio.init = function () {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(function () {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ac = new Ctor();
      const compressor = ac.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 6;
      const master = ac.createGain();
      master.gain.value = 0.8;
      master.connect(compressor);
      compressor.connect(ac.destination);
      dryBus = ac.createGain();
      wetBus = ac.createGain();
      wetBus.gain.value = 0.55;
      const reverb = makeReverb();
      dryBus.connect(master);
      wetBus.connect(reverb);
      reverb.connect(master);
      noiseBuffer = makeNoise(2);
      buildDrone();
      if (ac.state === 'suspended') ac.resume().catch(function () {});
    } catch (error) {
      ac = null;
    }
  };

  function handleEvent(ev) {
    switch (ev.type) {
      case 'move': woodTick(ev.piece); break;
      case 'kill':
        dissonantChord(ev.kind === 'boss');
        if (ev.kind === 'boss') bell(392, 0.3, 0.7);
        break;
      case 'hit': clang(); break;
      case 'blocked': dullThud(); break;
      case 'hurt': hurtSound(); break;
      case 'spawn':
        if (ev.kind === 'boss') bossRumble();
        break;
      case 'unlock':
        bell(523.25, 0, 1);
        bell(784, 0.18, 0.7);
        break;
      case 'wave': waveSwell(); break;
      case 'death': deathSound(); break;
      case 'win':
        bell(392, 0, 1);
        bell(523.25, 0.2, 0.9);
        bell(659.25, 0.4, 0.8);
        break;
      default: break;
    }
  }

  function nearestEnemyDistance(state, player) {
    let best = 99;
    const enemies = state.enemies || [];
    for (let i = 0; i < enemies.length; i++) {
      const distance = Math.max(Math.abs(enemies[i].x - player.x), Math.abs(enemies[i].y - player.y));
      if (distance < best) best = distance;
    }
    return best;
  }

  function updateMood(state) {
    let mood = 0.2;
    if (state.phase === 'title') mood = 0.12;
    else if (state.phase === 'dead') mood = 0.04;
    else if (state.phase === 'won') mood = 0.1;
    else if ((state.enemies || []).some(function (enemy) { return enemy.kind === 'boss'; })) mood = 0.28;
    if (mood === lastMood) return;
    lastMood = mood;
    droneGain.gain.setTargetAtTime(mood, ac.currentTime, 1.5);
    droneFilter.frequency.setTargetAtTime(mood > 0.25 ? 320 : 210, ac.currentTime, 1.5);
  }

  audio.update = function (state, now) {
    if (!ac || !state) return;
    if (ac.state === 'suspended' && now - lastResumeTry > 1000) {
      lastResumeTry = now;
      ac.resume().catch(function () {});
    }
    if (ac.state !== 'running') return;

    const events = state.events || [];
    for (let i = 0; i < events.length; i++) handleEvent(events[i]);

    updateMood(state);

    const player = state.players && state.players[0];
    if (state.phase === 'playing' && player && player.alive !== false) {
      const distance = nearestEnemyDistance(state, player);
      if (distance <= 2) {
        if (!heartActive) {
          heartActive = true;
          heartNextAt = now;
        }
        if (now >= heartNextAt) {
          heartbeat(distance <= 1 ? 1 : 0.75);
          heartNextAt = now + (distance <= 0 ? 340 : distance === 1 ? 480 : 700);
        }
      } else {
        heartActive = false;
      }
    } else {
      heartActive = false;
    }
  };
})();
