// Sound: the two original WAV effects, a few synthesized effects, and the original MIDI theme
// re-played through a small Web Audio sequencer (with the drum track that bonbons toggle on and off).
const Sound = (() => {
  let ctx = null;
  let master, sfxGain, musicGain, noiseBuffer;
  const buffers = {};
  const prefs = { sfx: true, music: true };
  const music = { events: [], loopLen: 0, loopStart: 0, idx: 0, timer: null, playing: false, drums: false };

  const mtof = (p) => 440 * Math.pow(2, (p - 69) / 12);

  function b64ToBuffer(uri) {
    const bin = atob(uri.split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function init() {
    if (ctx) { resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = prefs.sfx ? 0.8 : 0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = prefs.music ? 0.45 : 0; musicGain.connect(master);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    for (const [name, uri] of Object.entries(SFX_DATA)) {
      const raw = b64ToBuffer(uri);
      new Promise((res, rej) => ctx.decodeAudioData(raw, res, rej))
        .then((buf) => { buffers[name] = buf; })
        .catch((err) => console.warn('Could not decode sound', name, err));
    }
    buildMusic();
    return ctx;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setPaused(paused) {
    if (!ctx) return;
    if (paused && ctx.state === 'running') ctx.suspend();
    else if (!paused && ctx.state === 'suspended') ctx.resume();
  }

  // ---- sound effects ----
  function play(name, opts = {}) {
    if (!ctx || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = opts.rate || 1;
    const g = ctx.createGain();
    g.gain.value = opts.vol == null ? 1 : opts.vol;
    src.connect(g).connect(sfxGain);
    src.start();
  }

  function tone({ type = 'sine', from, to, dur, vol = 0.3, at, dest }) {
    const t = at == null ? ctx.currentTime : at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest || sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function synth(name) {
    if (!ctx) return;
    switch (name) {
      case 'jump': tone({ type: 'triangle', from: 320, to: 720, dur: 0.16, vol: 0.22 }); break;
      case 'land': noiseHit(0.05, 600, 0.12); break;
      case 'hurt':
        tone({ type: 'sawtooth', from: 420, to: 70, dur: 0.45, vol: 0.25 });
        tone({ type: 'square', from: 300, to: 60, dur: 0.4, vol: 0.12 });
        break;
      case 'win': {
        const notes = [74, 78, 81, 86, 90];
        notes.forEach((p, i) => tone({ type: 'triangle', from: mtof(p), dur: 0.35, vol: 0.22, at: ctx.currentTime + i * 0.11 }));
        break;
      }
      case 'click': tone({ type: 'sine', from: 900, to: 700, dur: 0.06, vol: 0.12 }); break;
      case 'lose': [66, 62, 58, 50].forEach((p, i) => tone({ type: 'triangle', from: mtof(p), dur: 0.4, vol: 0.2, at: ctx.currentTime + i * 0.22 })); break;
      default: break;
    }
  }

  function noiseHit(dur, freq, vol, at, dest) {
    const t = at == null ? ctx.currentTime : at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(dest || sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- music sequencer ----
  function buildMusic() {
    const secPerTick = MUSIC.tempoUs / 1e6 / MUSIC.division;
    music.events = [];
    for (const track of MUSIC.tracks) {
      for (const [start, dur, pitch, vel] of track.notes) {
        music.events.push({ t: start * secPerTick, d: dur * secPerTick, pitch, vel: vel / 127, ch: track.channel, track: track.index });
      }
    }
    music.events.sort((a, b) => a.t - b.t);
    music.loopLen = MUSIC.length * secPerTick;
  }

  function playNote(ev, when) {
    if (ev.ch === 9) { drum(ev.pitch, when, ev.vel); return; }
    if (ev.ch === 0) {
      // Vibraphone-like melody. The file's melody is written very low; raise it four octaves.
      const f = mtof(ev.pitch + 48);
      const dur = Math.max(0.45, ev.d);
      tone({ type: 'sine', from: f, dur, vol: 0.22 * ev.vel, at: when, dest: musicGain });
      tone({ type: 'sine', from: f * 4, dur: dur * 0.5, vol: 0.04 * ev.vel, at: when, dest: musicGain });
      return;
    }
    // Bass
    const f = mtof(ev.pitch);
    const t = when;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = f;
    sub.type = 'sine'; sub.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32 * ev.vel, t + 0.015);
    g.gain.setValueAtTime(0.32 * ev.vel, t + Math.max(0.05, ev.d * 0.85));
    g.gain.exponentialRampToValueAtTime(0.0001, t + ev.d + 0.08);
    osc.connect(g); sub.connect(g); g.connect(musicGain);
    osc.start(t); sub.start(t);
    osc.stop(t + ev.d + 0.1); sub.stop(t + ev.d + 0.1);
  }

  function drum(pitch, when, vel) {
    const v = 0.9 * vel;
    if (pitch === 35 || pitch === 36) { // kick
      tone({ type: 'sine', from: 160, to: 45, dur: 0.22, vol: 0.9 * v, at: when, dest: musicGain });
    } else if (pitch === 38 || pitch === 40) { // snare
      noiseHit(0.16, 1700, 0.5 * v, when, musicGain);
      tone({ type: 'sine', from: 210, to: 120, dur: 0.09, vol: 0.3 * v, at: when, dest: musicGain });
    } else if (pitch >= 60 && pitch <= 66) { // congas / bongos / timbales
      const freqs = { 60: 420, 61: 330, 62: 340, 63: 300, 64: 225, 65: 390, 66: 310 };
      const f = freqs[pitch];
      const dur = pitch === 62 ? 0.07 : 0.14;
      tone({ type: 'sine', from: f, to: f * 0.8, dur, vol: 0.42 * v, at: when, dest: musicGain });
    } else {
      noiseHit(0.05, 6000, 0.2 * v, when, musicGain);
    }
  }

  function scheduler() {
    if (!music.playing || !music.events.length) return;
    const ahead = ctx.currentTime + 0.18;
    let guard = 0;
    while (guard++ < 500) {
      if (music.idx >= music.events.length) { music.idx = 0; music.loopStart += music.loopLen; }
      const ev = music.events[music.idx];
      const when = music.loopStart + ev.t;
      if (when > ahead) break;
      if (!(ev.track === 1 && !music.drums) && when >= ctx.currentTime - 0.05) playNote(ev, when);
      music.idx++;
    }
  }

  function startMusic() {
    if (!ctx || music.playing) return;
    music.playing = true;
    music.loopStart = ctx.currentTime + 0.1;
    music.idx = 0;
    scheduler();
    music.timer = setInterval(scheduler, 50);
  }
  function stopMusic() {
    music.playing = false;
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
  }
  function setDrums(on) { music.drums = !!on; }
  function toggleDrums() { music.drums = !music.drums; return music.drums; }

  function setSfxEnabled(on) { prefs.sfx = !!on; if (sfxGain) sfxGain.gain.value = on ? 0.8 : 0; }
  function setMusicEnabled(on) { prefs.music = !!on; if (musicGain) musicGain.gain.value = on ? 0.45 : 0; }

  return { init, resume, setPaused, play, synth, startMusic, stopMusic, setDrums, toggleDrums, setSfxEnabled, setMusicEnabled, get drums() { return music.drums; } };
})();
