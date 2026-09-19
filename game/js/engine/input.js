// Keyboard, touch and gamepad input mapped onto a few game actions.
const Input = (() => {
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    Escape: 'pause', KeyP: 'pause',
    Enter: 'confirm',
  };
  const sources = { kb: new Set(), touch: new Set(), gp: new Set() };
  const pressed = new Set();
  const listeners = [];
  let touchSeen = false;

  function press(src, action) {
    const set = sources[src];
    if (!set.has(action)) {
      const alreadyHeld = isDown(action);
      set.add(action);
      if (!alreadyHeld) pressed.add(action);
      listeners.forEach((fn) => fn(action));
    }
  }
  function release(src, action) { sources[src].delete(action); }
  function isDown(action) { return sources.kb.has(action) || sources.touch.has(action) || sources.gp.has(action); }
  function wasPressed(action) { return pressed.has(action); }
  function endFrame() { pressed.clear(); }
  function clear() { Object.values(sources).forEach((s) => s.clear()); pressed.clear(); }
  function onPress(fn) { listeners.push(fn); }

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
    if (action !== 'confirm') e.preventDefault();
    if (e.repeat) return;
    press('kb', action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) release('kb', action);
  });
  window.addEventListener('blur', clear);

  // Touch buttons: any element with data-key inside #touch.
  function bindTouch(root) {
    root.querySelectorAll('[data-key]').forEach((btn) => {
      const action = btn.dataset.key;
      const down = (e) => { e.preventDefault(); btn.classList.add('down'); touchSeen = true; press('touch', action); };
      const up = (e) => { e.preventDefault(); btn.classList.remove('down'); release('touch', action); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }
  window.addEventListener('touchstart', () => { touchSeen = true; }, { passive: true });

  // Gamepad: left stick / d-pad, A or B to jump, Start to pause.
  const gpState = {};
  function pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const now = { left: false, right: false, jump: false, pause: false, confirm: false };
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      now.left = now.left || ax < -0.4 || b(14);
      now.right = now.right || ax > 0.4 || b(15);
      now.jump = now.jump || b(0) || b(1);
      now.confirm = now.confirm || b(0);
      now.pause = now.pause || b(9);
    }
    for (const action of Object.keys(now)) {
      if (now[action] && !gpState[action]) press('gp', action);
      else if (!now[action] && gpState[action]) release('gp', action);
      gpState[action] = now[action];
    }
  }

  const hasTouch = () => touchSeen || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  return { isDown, wasPressed, endFrame, clear, bindTouch, pollGamepad, hasTouch, onPress };
})();
