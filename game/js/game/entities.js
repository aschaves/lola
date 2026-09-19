// Game objects: Lola, the family members and pets that chase her, and the treats she collects.
const TILE = 64;
const GRAVITY = 2000;      // px/s² (the original used 0.002 px/ms²)
const MAX_FALL = 1500;
const ST = { NORMAL: 0, DYING: 1 };

function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

class Entity {
  constructor(type, def, anim) {
    this.type = type;
    this.def = def;
    this.name = def.name || type;
    this.anim = anim;
    this.w = anim.width;
    this.h = anim.height;
    this.box = def.box ? { ...def.box } : { ox: 0, oy: 0, w: this.w, h: this.h };
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.flipY = false;
    this.angle = 0;
    this.sx = 1; this.sy = 1;
    this.state = ST.NORMAL;
    this.stateTime = 0;
    this.remove = false;
    this.bobPhase = Math.random() * Math.PI * 2;
  }
  get left() { return this.x + this.box.ox; }
  get right() { return this.x + this.box.ox + this.box.w; }
  get top() { return this.y + this.box.oy; }
  get bottom() { return this.y + this.box.oy + this.box.h; }
  get cx() { return this.left + this.box.w / 2; }
  get cy() { return this.top + this.box.h / 2; }

  overlaps(o) {
    return this.left < o.right && o.left < this.right && this.top < o.bottom && o.top < this.bottom;
  }
  setState(s) { if (this.state !== s) { this.state = s; this.stateTime = 0; } }
  update(dt) { this.anim.update(dt); this.stateTime += dt; }
}

class Pickup extends Entity {
  constructor(def, anim) { super(def.type, def, anim); }
}

class Creature extends Entity {
  constructor(def, anim) {
    super('enemy', def, anim);
    this.maxSpeed = def.speed || 50;
    this.flying = !!def.flying;
    this.turnAtEdges = !!def.turnAtEdges;
    this.awake = false;
    this.onGround = false;
    this.landed = false;
  }
  // Like the original: a creature starts walking (to the left) the first time it is on screen.
  wakeUp() {
    if (!this.awake && this.state === ST.NORMAL) {
      this.awake = true;
      this.vx = -this.maxSpeed;
      this.facing = -1;
    }
  }
  collideHorizontal() { this.vx = -this.vx; }
  collideVertical() { this.vy = 0; }
  die() {
    this.setState(ST.DYING);
    this.vx = this.facing * 60;
    this.vy = -420;
    this.flipY = true;
    this.flying = false;
  }
  update(dt) {
    super.update(dt);
    if (this.vx > 0) this.facing = 1; else if (this.vx < 0) this.facing = -1;
    if (this.state === ST.DYING) {
      this.angle += this.facing * 2.5 * dt;
      if (this.stateTime > 1.6) this.remove = true;
    }
  }
}

class Player extends Creature {
  constructor(anims, box) {
    super({ name: 'lola', box }, anims.idle);
    this.type = 'player';
    this.anims = anims;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 0;
  }
  collideHorizontal() { this.vx = 0; }
  collideVertical() { this.vy = 0; }
  die() {
    this.setState(ST.DYING);
    this.vx = 0;
    this.vy = -720;
    this.flipY = true;
    this.squash = 0;
  }
  update(dt) {
    this.anim.update(dt);
    this.stateTime += dt;
    if (this.state === ST.DYING) { this.angle += 3.5 * dt; this.sx = this.sy = 1; return; }
    if (this.squash !== 0) this.squash = approach(this.squash, 0, 1.6 * dt);
    this.sy = 1 - this.squash;
    this.sx = 1 + this.squash * 0.7;
    let next;
    if (!this.onGround) next = this.anims.jump;
    else if (Math.abs(this.vx) > 20) next = this.anims.run;
    else next = this.anims.idle;
    if (next !== this.anim) { this.anim = next; this.anim.start(); }
  }
}
