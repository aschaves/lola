// Game flow: loading, title, playing, pause, level complete, game over, the end.
(() => {
  const VIEW_H = 800, MIN_W = 1000, MAX_W = 1440, STEP = 1 / 120;
  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const frame = $('#frame');
  const view = { w: 1280, h: VIEW_H };

  const game = {
    state: 'loading',
    levelIndex: 0,
    lives: 3,
    score: 0,
    world: null,
    lang: 'en',
    scale: { x: 1, y: 1 },
    settings: { sfx: true, music: true, lang: null },
    progress: { unlocked: 1, best: {} },
  };

  const t = (key) => (STRINGS[game.lang] && STRINGS[game.lang][key]) || STRINGS.en[key] || key;
  const L = (obj) => (obj && (obj[game.lang] || obj.en)) || '';
  const fmt = (n) => Math.round(n).toLocaleString();

  // ---- persistence ----
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem('lola.settings'));
      if (s) Object.assign(game.settings, s);
      const p = JSON.parse(localStorage.getItem('lola.progress'));
      if (p) Object.assign(game.progress, p);
    } catch (e) { /* storage unavailable */ }
  }
  function saveStore() {
    try {
      localStorage.setItem('lola.settings', JSON.stringify(game.settings));
      localStorage.setItem('lola.progress', JSON.stringify(game.progress));
    } catch (e) { /* storage unavailable */ }
  }

  // ---- layout ----
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    view.w = Math.round(Math.min(MAX_W, Math.max(MIN_W, (W / H) * VIEW_H)));
    const scale = Math.min(W / view.w, H / VIEW_H);
    const cssW = Math.floor(view.w * scale), cssH = Math.floor(VIEW_H * scale);
    frame.style.width = cssW + 'px';
    frame.style.height = cssH + 'px';
    frame.style.setProperty('--u', scale + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    game.scale = { x: canvas.width / view.w, y: canvas.height / VIEW_H };
  }

  // ---- screens ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    updateTouchVisibility();
  }
  function showTitlePanel(name) {
    $('#title-menu').classList.toggle('hidden', !!name);
    $('#panel-levels').classList.toggle('hidden', name !== 'levels');
    $('#panel-options').classList.toggle('hidden', name !== 'options');
    game.titlePanel = name;
  }
  function applyStrings() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.documentElement.lang = game.lang === 'pt' ? 'pt-BR' : 'en';
  }
  function fade(fn) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 380);
  }
  function updateTouchVisibility() {
    $('#touch').classList.toggle('hidden', !(game.state === 'playing' && Input.hasTouch()));
  }

  function buildLevelList() {
    const list = $('#level-list');
    list.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i + 1 > game.progress.unlocked;
      const best = game.progress.best[lv.id];
      const b = document.createElement('button');
      b.className = 'btn level-btn';
      b.disabled = locked;
      const label = document.createElement('span');
      const num = document.createElement('span');
      num.className = 'lvl-num';
      num.textContent = String(i + 1);
      label.appendChild(num);
      label.appendChild(document.createTextNode(locked ? t('locked') : L(lv.name)));
      const bestEl = document.createElement('span');
      bestEl.className = 'lvl-best';
      bestEl.textContent = best ? `${t('best')} ${fmt(best)}` : '';
      b.appendChild(label);
      b.appendChild(bestEl);
      b.addEventListener('click', () => { Sound.init(); Sound.synth('click'); fade(() => startRun(i)); });
      list.appendChild(b);
    });
  }

  // ---- game flow ----
  function startRun(index) {
    game.lives = 3;
    game.score = 0;
    loadLevel(index);
  }
  function loadLevel(index) {
    game.levelIndex = index;
    game.world = new World(LEVELS[index], view);
    game.state = 'playing';
    Input.clear();
    showScreen(null);
    Sound.init();
    Sound.setPaused(false);
    Sound.setDrums(false);
    Sound.startMusic();
  }
  function pause() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    Sound.setPaused(true);
    showScreen('screen-pause');
  }
  function resume() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    Sound.setPaused(false);
    Input.clear();
    showScreen(null);
  }
  function quitToTitle() {
    Sound.stopMusic();
    Sound.setPaused(false);
    stopFinalAnim();
    game.world = null;
    game.state = 'title';
    showTitlePanel(null);
    showScreen('screen-title');
  }
  function onDied() {
    game.lives--;
    if (game.lives > 0) {
      fade(() => loadLevel(game.levelIndex));
    } else {
      game.state = 'gameover';
      Sound.stopMusic();
      Sound.synth('lose');
      showScreen('screen-gameover');
    }
  }
  function onWon() {
    const w = game.world;
    const level = LEVELS[game.levelIndex];
    const timeBonus = Math.max(0, 2000 - Math.floor(w.time) * 20);
    const perfect = w.treatsTotal > 0 && w.treats === w.treatsTotal ? 1000 : 0;
    const levelScore = w.score + timeBonus + perfect;
    game.score += levelScore;
    w.banked = true; // the HUD stops adding the level score once it is in the total

    game.progress.unlocked = Math.max(game.progress.unlocked, Math.min(LEVELS.length, game.levelIndex + 2));
    game.progress.best[level.id] = Math.max(game.progress.best[level.id] || 0, levelScore);
    saveStore();

    $('#stat-treats').textContent = `${w.treats} / ${w.treatsTotal}${perfect ? ' ★' : ''}`;
    $('#stat-time').textContent = Render.fmtTime(w.time);
    $('#stat-bonus').textContent = `+${fmt(timeBonus + perfect)}${perfect ? ` · ${t('perfect')}` : ''}`;
    $('#stat-score').textContent = fmt(game.score);
    $('#final-name').textContent = t(level.found);
    $('[data-action=next]').textContent = game.levelIndex + 1 < LEVELS.length ? t('next') : t('finish');
    startFinalAnim(level.final);

    game.state = 'levelcomplete';
    Sound.stopMusic();
    showScreen('screen-complete');
  }
  function nextLevel() {
    stopFinalAnim();
    if (game.levelIndex + 1 < LEVELS.length) fade(() => loadLevel(game.levelIndex + 1));
    else fade(showEnd);
  }
  function showEnd() {
    game.world = null;
    game.state = 'end';
    $('#end-score').textContent = fmt(game.score);
    showScreen('screen-end');
    Sound.synth('win');
  }

  // The "final" photos (the family member holding Lola) were in the 2011 assets but never shown; they animate here.
  let finalTimer = null;
  function startFinalAnim(framesList) {
    stopFinalAnim();
    const img = $('#final-img');
    let i = 0;
    const show = () => { img.src = framesList[i % framesList.length][0]; i++; };
    show();
    finalTimer = setInterval(show, framesList[0][1] || 450);
  }
  function stopFinalAnim() { if (finalTimer) { clearInterval(finalTimer); finalTimer = null; } }

  // ---- actions ----
  function act(action) {
    Sound.init();
    if (action !== 'fullscreen') Sound.synth('click');
    switch (action) {
      case 'play': fade(() => startRun(0)); break;
      case 'levels': buildLevelList(); showTitlePanel('levels'); break;
      case 'options': showTitlePanel('options'); break;
      case 'back': showTitlePanel(null); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'resume': resume(); break;
      case 'restart': fade(() => { game.state = 'playing'; Sound.setPaused(false); loadLevel(game.levelIndex); }); break;
      case 'quit': fade(quitToTitle); break;
      case 'next': nextLevel(); break;
      case 'retry': fade(() => { game.lives = 3; loadLevel(game.levelIndex); }); break;
      case 'again': fade(() => startRun(0)); break;
      default: break;
    }
  }
  function toggleFullscreen() {
    const doc = document;
    const el = doc.documentElement;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    } else if (el.requestFullscreen || el.webkitRequestFullscreen) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) act(btn.dataset.action);
  });

  $('#opt-sfx').addEventListener('change', (e) => { game.settings.sfx = e.target.checked; Sound.setSfxEnabled(e.target.checked); saveStore(); });
  $('#opt-music').addEventListener('change', (e) => { game.settings.music = e.target.checked; Sound.setMusicEnabled(e.target.checked); saveStore(); });
  $('#opt-lang').addEventListener('change', (e) => { game.lang = e.target.value; game.settings.lang = game.lang; applyStrings(); saveStore(); });

  // Menu navigation with keyboard / gamepad
  function handleMenuKeys() {
    const confirm = Input.wasPressed('confirm') || Input.wasPressed('jump');
    const back = Input.wasPressed('pause');
    switch (game.state) {
      case 'title':
        if (game.titlePanel) { if (back) act('back'); }
        else if (confirm) act('play');
        break;
      case 'playing':
        if (back) pause();
        break;
      case 'paused':
        if (back || confirm) resume();
        break;
      case 'levelcomplete':
        if (confirm) act('next');
        break;
      case 'gameover':
        if (confirm) act('retry');
        break;
      case 'end':
        if (confirm) act('again');
        break;
      default: break;
    }
  }

  Input.onPress(() => { Sound.init(); });
  // Auto-pause when the tab is hidden (add ?nopause to the URL to disable, useful for automated testing).
  const autoPause = !/[?&]nopause/.test(location.search);
  document.addEventListener('visibilitychange', () => { if (document.hidden && autoPause) pause(); });
  window.addEventListener('resize', resize);

  // ---- main loop ----
  let last = performance.now(), acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    Input.pollGamepad();
    handleMenuKeys();
    if (game.state === 'playing' && game.world) {
      const inp = { left: Input.isDown('left'), right: Input.isDown('right'), jump: Input.isDown('jump'), jumpPressed: Input.wasPressed('jump') };
      acc += dt;
      while (acc >= STEP) {
        game.world.step(STEP, inp);
        inp.jumpPressed = false;
        acc -= STEP;
      }
      processEvents();
    } else {
      acc = 0;
    }
    draw(now / 1000);
    Input.endFrame();
  }

  function processEvents() {
    const w = game.world;
    for (const ev of w.events) {
      switch (ev.type) {
        case 'sfx':
          if (ev.name === 'prize' || ev.name === 'boop') Sound.play(ev.name);
          else Sound.synth(ev.name);
          break;
        case 'music': {
          const on = Sound.toggleDrums();
          w.texts.push({ x: w.player.cx, y: w.player.top - 30, key: on ? 'drumsOn' : 'drumsOff', life: 1.4, color: '#ffd166' });
          break;
        }
        case 'died': onDied(); break;
        case 'won': onWon(); break;
        default: break;
      }
      if (game.world !== w) break;
    }
    w.events.length = 0;
  }

  function draw(now) {
    ctx.setTransform(game.scale.x, 0, 0, game.scale.y, 0, 0);
    if (game.world) {
      Render.drawWorld(ctx, game.world, view, now);
      Render.drawHUD(ctx, game, game.world, view, t, L);
    } else {
      ctx.fillStyle = '#0d0509';
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  // ---- boot ----
  function collectImages() {
    const paths = [...UI_IMAGES];
    for (const lv of LEVELS) {
      paths.push(lv.background, lv.foreground);
      paths.push(...Object.values(lv.tiles));
      for (const def of Object.values(lv.legend)) def.frames.forEach((f) => paths.push(f[0]));
      lv.final.forEach((f) => paths.push(f[0]));
    }
    [PLAYER.run, PLAYER.idle, PLAYER.jump].forEach((fr) => fr.forEach((f) => paths.push(f[0])));
    return paths;
  }

  async function boot() {
    loadStore();
    game.lang = game.settings.lang || 'pt'; // Portuguese by default; players can switch in Options
    $('#opt-lang').value = game.lang;
    $('#opt-sfx').checked = game.settings.sfx;
    $('#opt-music').checked = game.settings.music;
    Sound.setSfxEnabled(game.settings.sfx);
    Sound.setMusicEnabled(game.settings.music);
    applyStrings();
    resize();
    showScreen('screen-loading');
    Input.bindTouch($('#touch'));

    await Assets.load(collectImages(), (p) => { $('#progress-bar').style.width = `${Math.round(p * 100)}%`; });

    game.state = 'title';
    showTitlePanel(null);
    showScreen('screen-title');
    requestAnimationFrame(loop);
  }

  // Developer hook (add ?debug to the URL): window.LolaDebug exposes the game state for testing.
  if (/[?&]debug/.test(location.search)) {
    window.LolaDebug = {
      game, view,
      loadLevel,
      teleport(col) { const w = game.world; if (w) { w.player.x = col * TILE; w.player.y = 0; w.updateCamera(0, true); } },
    };
  }

  boot();
})();
