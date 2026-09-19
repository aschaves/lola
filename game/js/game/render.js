// Drawing: parallax layers, tiles, sprites, particles and the in-game HUD.
const Render = (() => {
  const FONT = 'Fredoka, "Segoe UI", system-ui, -apple-system, sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
    ctx.bezierCurveTo(x - s / 2, y + s * 0.58, x, y + s * 0.78, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.78, x + s / 2, y + s * 0.58, x + s / 2, y + s * 0.3);
    ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function drawWorld(ctx, world, view, t) {
    const level = world.level;
    const camX = Math.round(world.camX + world.shakeX);
    const offY = Math.round(view.h - world.mapH + world.shakeY);

    ctx.fillStyle = level.bgColor || '#000';
    ctx.fillRect(0, 0, view.w, view.h);

    // Parallax layers: a layer narrower than the map scrolls slower, exactly as in the original renderer.
    for (const key of ['background', 'foreground']) {
      const img = Assets.get(level[key]);
      if (!img) continue;
      const denom = world.mapW - view.w;
      let x = 0;
      if (denom > 0 && img.width > view.w) x = -camX * (img.width - view.w) / denom;
      ctx.drawImage(img, Math.round(x), view.h - img.height + Math.round(world.shakeY));
    }

    // Tiles (only the visible columns)
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(world.cols - 1, Math.floor((camX + view.w) / TILE) + 1);
    for (let ty = 0; ty < world.rowCount; ty++) {
      const row = world.tiles[ty];
      for (let tx = tx0; tx <= tx1; tx++) {
        const img = row[tx];
        if (img) ctx.drawImage(img, tx * TILE - camX, ty * TILE + offY);
      }
    }

    // Sprites: pickups and the goal first, then creatures, then Lola on top.
    const visible = (e) => e.x + e.w > camX - 80 && e.x < camX + view.w + 80;
    for (const e of world.entities) if (e.type !== 'enemy' && visible(e)) drawEntity(ctx, e, camX, offY, t);
    for (const e of world.entities) if (e.type === 'enemy' && visible(e)) drawEntity(ctx, e, camX, offY, t);
    drawEntity(ctx, world.player, camX, offY, t);

    // Particles
    for (const pt of world.particles) {
      const a = Math.max(0, pt.life / pt.max) * (pt.a || 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      if (pt.heart) heart(ctx, pt.x - camX, pt.y + offY, pt.r * 3);
      else { ctx.beginPath(); ctx.arc(pt.x - camX, pt.y + offY, pt.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 61, 154, ${world.flash * 0.45})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function drawEntity(ctx, e, camX, offY, t) {
    const img = e.anim.image;
    if (!img) return;
    let bob = 0;
    if (e.type === 'treat' || e.type === 'music') bob = Math.sin(t * 3 + e.bobPhase) * 4;
    else if (e.type === 'goal') bob = Math.sin(t * 2 + e.bobPhase) * 5;
    const w = img.width, h = img.height;
    const cx = e.x + w / 2 - camX;
    const feetY = e.y + h + offY + bob;
    ctx.save();
    ctx.translate(cx, feetY);
    if (e.angle) { ctx.translate(0, -h / 2); ctx.rotate(e.angle); ctx.translate(0, h / 2); }
    ctx.scale(e.facing * e.sx, e.flipY ? -e.sy : e.sy);
    ctx.drawImage(img, -w / 2, e.flipY ? 0 : -h);
    ctx.restore();
  }

  function drawTexts(ctx, world, view, tr) {
    const camX = Math.round(world.camX + world.shakeX);
    const offY = Math.round(view.h - world.mapH + world.shakeY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of world.texts) {
      const a = Math.min(1, tx.life / 0.4);
      ctx.globalAlpha = a;
      const label = tx.key ? tr(tx.key) : tx.text;
      const sub = tx.key && tx.text ? tx.text : null;
      ctx.font = `700 ${sub ? 22 : 26}px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(20, 6, 14, 0.75)';
      ctx.fillStyle = tx.color || '#fff';
      const x = tx.x - camX, y = tx.y + offY;
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
      if (sub) {
        ctx.font = `700 20px ${FONT}`;
        ctx.strokeText(sub, x, y + 24);
        ctx.fillText(sub, x, y + 24);
      }
    }
    ctx.globalAlpha = 1;
  }

  function pill(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(20, 6, 14, 0.55)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
  }

  function drawHUD(ctx, game, world, view, tr, L) {
    const level = world.level;
    const pad = 20, h = 44;
    let x = pad;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Level name
    ctx.font = `600 22px ${FONT}`;
    const name = `${game.levelIndex + 1} · ${L(level.name)}`;
    let w = ctx.measureText(name).width + 32;
    pill(ctx, x, pad, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, x + 16, pad + h / 2 + 1);
    x += w + 10;

    // Treats
    const firstTreat = Object.values(level.legend).find((d) => d.type === 'treat');
    const icon = firstTreat ? Assets.get(firstTreat.frames[0][0]) : null;
    const treatsText = `${world.treats} / ${world.treatsTotal}`;
    w = ctx.measureText(treatsText).width + (icon ? 66 : 32);
    pill(ctx, x, pad, w, h);
    if (icon) ctx.drawImage(icon, x + 10, pad + 5, 34, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(treatsText, x + (icon ? 50 : 16), pad + h / 2 + 1);
    x += w + 10;

    // Time
    const timeText = fmtTime(world.time);
    w = ctx.measureText(timeText).width + 32;
    pill(ctx, x, pad, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(timeText, x + 16, pad + h / 2 + 1);

    // Score (top-right)
    ctx.textAlign = 'right';
    ctx.font = `700 26px ${FONT}`;
    const scoreText = (game.score + (world.banked ? 0 : world.score)).toLocaleString();
    w = ctx.measureText(scoreText).width + 36;
    pill(ctx, view.w - pad - w, pad, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreText, view.w - pad - 18, pad + h / 2 + 1);

    // Lives
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < game.lives ? '#ff3d9a' : 'rgba(255,255,255,0.25)';
      heart(ctx, view.w - pad - 16 - i * 34, pad + h + 12, 26);
    }

    // Level intro banner
    if (world.introTime < 3.2) {
      const it = world.introTime;
      const a = it < 0.35 ? it / 0.35 : it > 2.5 ? Math.max(0, (3.2 - it) / 0.7) : 1;
      ctx.globalAlpha = a;
      const cy = view.h * 0.36;
      ctx.fillStyle = 'rgba(20, 6, 14, 0.6)';
      ctx.fillRect(0, cy - 90, view.w, 180);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb3d9';
      ctx.font = `600 24px ${FONT}`;
      ctx.fillText(`${tr('level')} ${game.levelIndex + 1}`, view.w / 2, cy - 44);
      ctx.fillStyle = '#fff';
      ctx.font = `700 58px ${FONT}`;
      ctx.fillText(L(level.name), view.w / 2, cy + 4);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `500 24px ${FONT}`;
      ctx.fillText(L(level.subtitle), view.w / 2, cy + 54);
      ctx.globalAlpha = 1;
    }

    drawTexts(ctx, world, view, tr);
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  return { drawWorld, drawHUD, fmtTime };
})();
