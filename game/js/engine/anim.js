// A looping frame animation, ported from the original Animation class.
class Anim {
  constructor(frames) {
    // frames: [{ img, dur }] with dur in seconds
    this.frames = frames || [];
    this.total = this.frames.reduce((s, f) => s + f.dur, 0);
    this.time = 0;
    this.index = 0;
  }

  static fromList(list) {
    return new Anim(list.map(([path, ms]) => ({ img: Assets.get(path), dur: ms / 1000 })));
  }

  start() { this.time = 0; this.index = 0; }

  update(dt) {
    if (this.frames.length < 2) return;
    this.time = (this.time + dt) % this.total;
    let acc = 0;
    for (let i = 0; i < this.frames.length; i++) {
      acc += this.frames[i].dur;
      if (this.time < acc) { this.index = i; return; }
    }
    this.index = this.frames.length - 1;
  }

  get image() { return this.frames.length ? this.frames[this.index].img : null; }
  get width() { const f = this.frames[0]; return f && f.img ? f.img.width : 64; }
  get height() { const f = this.frames[0]; return f && f.img ? f.img.height : 64; }

  clone() { return new Anim(this.frames); }
}
