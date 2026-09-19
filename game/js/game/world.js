// The level simulation: tile collisions, Lola's movement, the creatures, pickups, camera and effects.
// Movement follows the original engine (sweep one axis at a time and snap to the tile edge), with a
// few modern touches: acceleration, variable jump height, coyote time and jump buffering.
const PHYS = {
  speed: 500,        // Lola's top speed, px/s (original: 0.5 px/ms)
  accel: 4500,
  airAccel: 2800,
  friction: 5500,
  airFriction: 1200,
  jump: 950,         // original jump speed (0.95 px/ms) -> about 3.5 tiles high
  shortHop: 2.4,     // extra gravity while the jump button is released on the way up
  coyote: 0.1,
  buffer: 0.14,
  stompBounce: 620,
};

class World {
  constructor(level, view) {
    this.level = level;
    this.view = view;
    this.rows = level.rows;
    this.cols = level.rows[0].length;
    this.rowCount = level.rows.length;
    this.mapW = this.cols * TILE;
    this.mapH = this.rowCount * TILE;
    this.tiles = this.rows.map((r) => [...r].map((ch) => (level.tiles[ch] ? Assets.get(level.tiles[ch]) : null)));

    this.entities = [];
    this.particles = [];
    this.texts = [];
    this.events = [];
    this.time = 0;
    this.introTime = 0;
    this.treats = 0;
    this.treatsTotal = 0;
    this.score = 0;
    this.stomps = 0;
    this.status = 'playing';   // playing | dying | won
    this.statusTime = 0;
    this.reported = false;
    this.shake = 0; this.shakeX = 0; this.shakeY = 0;
    this.flash = 0;
    this.camX = 0;
    this.goal = null;

    this.rows.forEach((row, ty) => { [...row].forEach((ch, tx) => this.spawn(ch, tx, ty)); });
    (level.extras || []).forEach((e) => this.spawn(e.ch, e.col, e.row));

    const anims = { run: Anim.fromList(PLAYER.run), idle: Anim.fromList(PLAYER.idle), jump: Anim.fromList(PLAYER.jump) };
    this.player = new Player(anims, PLAYER.box);
    const col = (level.spawn && level.spawn.col) || 3;
    this.player.x = col * TILE + (TILE - this.player.box.w) / 2 - this.player.box.ox;
    this.player.y = -this.player.h - 40;
    this.updateCamera(0, true);
  }

  spawn(ch, tx, ty) {
    const def = this.level.legend[ch];
    if (!def) return;
    const anim = Anim.fromList(def.frames);
    const e = def.type === 'enemy' ? new Creature(def, anim) : new Pickup(def, anim);
    e.x = tx * TILE + (TILE - e.w) / 2;   // centred in its cell
    e.y = (ty + 1) * TILE - e.h;          // standing on the cell's floor
    if (def.type === 'treat' || def.type === 'music') this.treatsTotal++;
    if (def.type === 'goal') this.goal = e;
    this.entities.push(e);
  }

  // ---- simulation ----

  step(dt, inp) {
    this.time += dt;
    this.statusTime += dt;
    this.introTime += dt;
    this.stepPlayer(dt, inp);
    for (const e of this.entities) {
      if (e.remove) continue;
      if (e.type === 'enemy') this.stepEnemy(e, dt);
      e.update(dt);
    }
    if (this.entities.some((e) => e.remove)) this.entities = this.entities.filter((e) => !e.remove);
    this.updateCamera(dt, false);
    this.stepEffects(dt);
  }

  stepPlayer(dt, inp) {
    const p = this.player;

    if (p.state === ST.DYING) {
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.update(dt);
      if (p.stateTime > 1.5 && !this.reported) { this.reported = true; this.events.push({ type: 'died' }); }
      return;
    }

    if (this.status === 'won') {
      // Happy little hops next to the family member.
      p.vx = 0;
      if (p.onGround) { p.vy = -430; p.onGround = false; p.squash = -0.12; }
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
      this.moveY(p, dt);
      p.update(dt);
      if (this.statusTime > 1.7 && !this.reported) { this.reported = true; this.events.push({ type: 'won' }); }
      return;
    }

    const want = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (want !== 0) {
      p.vx = approach(p.vx, want * PHYS.speed, (p.onGround ? PHYS.accel : PHYS.airAccel) * dt);
      p.facing = want;
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? PHYS.friction : PHYS.airFriction) * dt);
    }

    p.jumpBuffer = inp.jumpPressed ? PHYS.buffer : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
    if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = -PHYS.jump;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.squash = -0.14;
      this.dust(p.cx, p.bottom, 6);
      this.events.push({ type: 'sfx', name: 'jump' });
    }

    let g = GRAVITY;
    if (p.vy < 0 && !inp.jump) g *= PHYS.shortHop;
    p.vy = Math.min(p.vy + g * dt, MAX_FALL);

    const wasOnGround = p.onGround;
    this.moveX(p, dt);
    this.moveY(p, dt);
    if (p.onGround && !wasOnGround) {
      p.squash = 0.16;
      this.dust(p.cx, p.bottom, 8);
      this.events.push({ type: 'sfx', name: 'land' });
    }
    p.update(dt);
    this.checkPlayerCollisions(p, inp);
    if (p.top > this.mapH + 240) this.killPlayer();
  }

  stepEnemy(e, dt) {
    if (e.state === ST.DYING) {
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      return;
    }
    if (!e.awake) {
      const visible = e.right > this.camX - 120 && e.left < this.camX + this.view.w + 120;
      if (visible) e.wakeUp();
    }
    if (!e.flying) e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
    if (e.vx !== 0) this.moveX(e, dt);
    if (!e.flying) this.moveY(e, dt);
    if (e.turnAtEdges && e.onGround && e.vx !== 0) {
      const frontX = e.vx > 0 ? e.right + 2 : e.left - 2;
      const tx = Math.floor(frontX / TILE);
      const ty = Math.floor((e.bottom + 2) / TILE);
      const solid = ty >= 0 && ty < this.rowCount && tx >= 0 && tx < this.cols && this.tiles[ty][tx];
      if (tx >= 0 && tx < this.cols && !solid) e.vx = -e.vx;
    }
  }

  // ---- tile collisions (ported from the original getTileCollision) ----

  // Returns the first solid tile the entity's box touches while moving from its position to (nx, ny),
  // or null. The map's left and right edges count as walls.
  sweep(e, nx, ny) {
    const x0 = Math.min(e.x, nx) + e.box.ox;
    const x1 = Math.max(e.x, nx) + e.box.ox + e.box.w;
    const y0 = Math.min(e.y, ny) + e.box.oy;
    const y1 = Math.max(e.y, ny) + e.box.oy + e.box.h;
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor((Math.ceil(x1) - 1) / TILE);
    const ty0 = Math.floor(y0 / TILE), ty1 = Math.floor((Math.ceil(y1) - 1) / TILE);
    const dirX = nx >= e.x ? 1 : -1, dirY = ny >= e.y ? 1 : -1;
    for (let i = 0; i <= tx1 - tx0; i++) {
      const tx = dirX > 0 ? tx0 + i : tx1 - i;
      for (let j = 0; j <= ty1 - ty0; j++) {
        const ty = dirY > 0 ? ty0 + j : ty1 - j;
        if (tx < 0 || tx >= this.cols) return { tx, ty };
        if (ty >= 0 && ty < this.rowCount && this.tiles[ty][tx]) return { tx, ty };
      }
    }
    return null;
  }

  moveX(e, dt) {
    const nx = e.x + e.vx * dt;
    const hit = this.sweep(e, nx, e.y);
    if (!hit) { e.x = nx; return; }
    if (e.vx > 0) e.x = hit.tx * TILE - e.box.ox - e.box.w;
    else if (e.vx < 0) e.x = (hit.tx + 1) * TILE - e.box.ox;
    e.collideHorizontal();
  }

  moveY(e, dt) {
    const ny = e.y + e.vy * dt;
    const hit = this.sweep(e, e.x, ny);
    if (!hit) {
      e.y = ny;
      if (e.vy > 0) e.onGround = false;
      return;
    }
    if (e.vy > 0) {
      e.y = hit.ty * TILE - e.box.oy - e.box.h;
      e.onGround = true;
    } else if (e.vy < 0) {
      e.y = (hit.ty + 1) * TILE - e.box.oy;
    }
    e.collideVertical();
  }

  // ---- interactions ----

  checkPlayerCollisions(p, inp) {
    for (const e of this.entities) {
      if (e.remove || e.state !== ST.NORMAL || !p.overlaps(e)) continue;
      if (e.type === 'treat' || e.type === 'music') this.collect(e);
      else if (e.type === 'goal') this.reachGoal(e);
      else if (e.type === 'enemy') {
        const stomp = p.vy > 0 && p.bottom < e.top + e.box.h * 0.5;
        if (stomp) this.stomp(p, e, inp);
        else { this.killPlayer(); return; }
      }
    }
  }

  collect(e) {
    e.remove = true;
    const value = e.def.score || 0;
    this.score += value;
    this.treats++;
    const color = e.type === 'music' ? '#ffd166' : '#ffffff';
    this.texts.push({ x: e.cx, y: e.top, text: '+' + value, key: e.name === 'poop' ? 'yuck' : null, life: 1.1, color });
    this.burst(e.cx, e.cy, e.type === 'music' ? '#ffd166' : '#ffb3d9', 12);
    this.events.push({ type: 'sfx', name: 'prize' });
    if (e.type === 'music') this.events.push({ type: 'music' });
  }

  stomp(p, e, inp) {
    e.die();
    this.stomps++;
    this.score += 200;
    p.y = e.top - p.box.h - p.box.oy;
    p.vy = inp.jump ? -PHYS.jump : -PHYS.stompBounce;
    p.onGround = false;
    p.squash = -0.14;
    this.texts.push({ x: e.cx, y: e.top, text: '+200', life: 1.1, color: '#ffffff' });
    this.burst(e.cx, e.top, '#ffffff', 10);
    this.events.push({ type: 'sfx', name: 'boop' });
  }

  killPlayer() {
    const p = this.player;
    if (p.state !== ST.NORMAL || this.status !== 'playing') return;
    p.die();
    this.status = 'dying';
    this.statusTime = 0;
    this.shake = 14;
    this.flash = 0.7;
    this.texts.push({ x: p.cx, y: p.top - 10, key: 'caught', life: 1.4, color: '#ff3d9a' });
    this.events.push({ type: 'sfx', name: 'hurt' });
  }

  reachGoal(g) {
    if (this.status !== 'playing') return;
    this.status = 'won';
    this.statusTime = 0;
    this.player.vx = 0;
    this.burst(g.cx, g.top + 20, '#ff3d9a', 26, { heart: true });
    this.events.push({ type: 'sfx', name: 'win' });
  }

  // ---- camera & effects ----

  updateCamera(dt, snap) {
    const p = this.player;
    const maxX = Math.max(0, this.mapW - this.view.w);
    const target = clamp(p.cx - this.view.w / 2 + p.facing * 70, 0, maxX);
    if (snap) this.camX = target;
    else this.camX += (target - this.camX) * Math.min(1, dt * 5);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - 40 * dt);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake;
    } else { this.shakeX = 0; this.shakeY = 0; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 1.6 * dt);
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + (Math.random() - 0.5) * 40, y: y - 4, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 90, life: 0.45, max: 0.45, r: 4 + Math.random() * 5, color: '#ffffff', g: 200, a: 0.55 });
    }
  }

  burst(x, y, color, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, life: 0.9, max: 0.9, r: 3 + Math.random() * 5, color, g: 700, a: 1, heart: !!opts.heart });
    }
  }

  stepEffects(dt) {
    for (const pt of this.particles) {
      pt.vy += pt.g * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    if (this.particles.some((pt) => pt.life <= 0)) this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const tx of this.texts) { tx.y -= 45 * dt; tx.life -= dt; }
    if (this.texts.some((tx) => tx.life <= 0)) this.texts = this.texts.filter((tx) => tx.life > 0);
  }
}
