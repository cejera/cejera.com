(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const FONT = '"Source Code Pro", monospace';
  const KEY_FONT = '"Cambria Math", "STIX Two Math", "Source Code Pro", serif';
  const runeImages = new Map(), maskCache = new Map();
  let foreground = '#fff', background = '#000';
  function loadAssets() {
    return Promise.all(root.SigillumModel.RUNE_FILES.map(name => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => { runeImages.set(name, img); resolve(); };
      img.onerror = () => reject(new Error('Não foi possível carregar a runa ' + name + '.'));
      img.src = 'assets/runas/' + name + '.svg';
    })));
  }
  function tintedMask(cacheKey, painter) {
    const key = cacheKey + foreground;
    if (maskCache.has(key)) return maskCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 384;
    const cx = c.getContext('2d'); painter(cx, c.width);
    cx.globalCompositeOperation = 'source-in'; cx.fillStyle = foreground; cx.fillRect(0, 0, c.width, c.height);
    if (maskCache.size > 256) maskCache.clear();
    maskCache.set(key, c); return c;
  }
  function rune(ctx, node, size = 34) {
    const img = runeImages.get(node.rune); if (!img) return;
    const mask = tintedMask('rune-' + node.rune, (cx, w) => {
      const ratio = img.naturalWidth / img.naturalHeight, h = w / Math.max(1, ratio), iw = h * ratio;
      cx.drawImage(img, (w - iw) / 2, (w - h) / 2, iw, h);
    });
    ctx.drawImage(mask, node.x - size / 2, node.y - size / 2, size, size);
  }
  function glyph(ctx, char) {
    const mask = tintedMask('glyph-' + char, (cx, w) => {
      cx.font = `${w * .64}px ${KEY_FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(char, w / 2, w / 2);
    });
    ctx.drawImage(mask, -42, -42, 84, 84);
  }
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function strokeRing(ctx, radius, progress, width) {
    if (progress <= 0) return;
    ctx.lineWidth = width; ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(progress)); ctx.stroke();
  }
  function traceSegments(points) {
    const segments = [];
    if (points.length === 1) return [];
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1], to = points[i];
      if (from.number === to.number) {
        const loop = [from];
        for (let k = 1; k <= 32; k++) {
          const angle = Math.PI + TAU * k / 32;
          loop.push({ x: from.x + 18 + Math.cos(angle) * 18, y: from.y + Math.sin(angle) * 18 });
        }
        segments.push(loop);
      } else segments.push([from, to]);
    }
    return segments;
  }
  function flattenedPath(points) {
    const segments = traceSegments(points);
    const parts = [];
    for (const segment of segments) for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1], b = segment[i];
      parts.push({ a, b, length: Math.hypot(b.x - a.x, b.y - a.y) });
    }
    return parts;
  }
  function drawTrace(ctx, model, progress) {
    const parts = flattenedPath(model.points), length = parts.reduce((n, p) => n + p.length, 0);
    let remaining = length * clamp(progress);
    const origin = model.points[0];
    ctx.lineWidth = 4.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (progress > 0) {
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y);
      for (const part of parts) {
        if (remaining <= 0) break;
        const t = Math.min(1, remaining / part.length);
        ctx.lineTo(part.a.x + (part.b.x - part.a.x) * t, part.a.y + (part.b.y - part.a.y) * t);
        remaining -= part.length;
      }
      ctx.stroke();
      ctx.save(); ctx.fillStyle = background; ctx.beginPath(); ctx.arc(origin.x, origin.y, 23, 0, TAU); ctx.fill(); ctx.restore();
      rune(ctx, origin, 38);
    }
    if (progress >= 1 && parts.length) {
      const end = model.points[model.points.length - 1];
      ctx.save(); ctx.fillStyle = background; ctx.beginPath(); ctx.arc(end.x, end.y, 23, 0, TAU); ctx.fill(); ctx.restore();
      rune(ctx, end, 38);
    }
  }
  function drawMatrix(ctx, model, opacity, phase) {
    if (!opacity) return;
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.lineWidth = 1; ctx.globalAlpha = opacity * .4;
    const tips = [model.nodes[6], ...model.nodes.slice(0, 6)];
    ctx.beginPath();
    for (let i = 0; i <= 7; i++) { const node = tips[(i * 3) % 7]; if (i === 0) ctx.moveTo(node.x, node.y); else ctx.lineTo(node.x, node.y); }
    ctx.stroke();
    for (const node of model.nodes) {
      ctx.globalAlpha = opacity; ctx.lineWidth = 1;
      ctx.save(); ctx.fillStyle = background; ctx.beginPath(); ctx.arc(node.x, node.y, 23, 0, TAU); ctx.fill(); ctx.restore();
      rune(ctx, node, 34);
      if (phase >= 2) { ctx.font = `600 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(node.number), node.x + 28, node.y - 24); }
    }
    ctx.restore();
  }
  function drawKey(ctx, model, progress) {
    if (progress <= 0) return;
    const glyphs = model.key.glyphs, count = Math.ceil(7 * clamp(progress));
    const direction = model.direction === 'counterclockwise' ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + direction * TAU * i / 7;
      ctx.save(); ctx.translate(Math.cos(angle) * 321, Math.sin(angle) * 321);
      const rotation = model.facing === 'inward' ? angle - Math.PI / 2 : model.facing === 'outward' ? angle + Math.PI / 2 : 0;
      ctx.rotate(rotation); glyph(ctx, glyphs[i]); ctx.restore();
    }
  }
  function drawSequence(ctx, model, phase, progress) {
    const tokens = phase === 2 ? model.tokens.filter(t => t.kept) : model.tokens;
    const columns = Math.min(16, Math.max(7, Math.ceil(Math.sqrt(tokens.length * 2))));
    const fontSize = Math.max(12, Math.min(26, 420 / columns / 1.7));
    const cellWidth = fontSize * 1.7, cellHeight = fontSize * 2.4;
    const rows = Math.ceil(tokens.length / columns), width = Math.min(columns, tokens.length) * cellWidth;
    const height = rows * cellHeight;
    ctx.save(); ctx.fillStyle = background; ctx.fillRect(-width / 2 - 10, -height / 2 - 10, width + 20, height + 20);
    ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    tokens.forEach((token, i) => {
      const x = -width / 2 + (i % columns + .5) * cellWidth, y = -height / 2 + (Math.floor(i / columns) + .5) * cellHeight;
      const removal = clamp(progress * tokens.length - i);
      ctx.save(); ctx.translate(x, y);
      ctx.globalAlpha = phase === 1 && !token.kept ? 1 - removal * .87 : 1;
      ctx.font = `600 ${fontSize}px ${FONT}`; ctx.fillText(token.letter, 0, phase === 2 ? -fontSize * .3 : 0);
      if (phase === 1 && !token.kept && removal > 0) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-fontSize * .4, fontSize * .25); ctx.lineTo(fontSize * .4 * removal, -fontSize * .25); ctx.stroke(); }
      if (phase === 2) { ctx.globalAlpha = clamp(progress * tokens.length - i); ctx.font = `400 ${fontSize * .64}px ${FONT}`; ctx.fillText(String(token.number), 0, fontSize * .8); }
      ctx.restore();
    });
    ctx.restore();
  }
  function draw(canvas, model, state = {}, options = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const light = options.palette === 'light';
    foreground = light ? '#000' : '#fff'; background = light ? '#fff' : '#000';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = light ? '#ffffff' : '#000000'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = light ? '#000000' : '#ffffff'; ctx.strokeStyle = ctx.fillStyle;
    const scale = Math.min(width, height) / 860;
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(scale, scale);
    if (!model) {
      ctx.globalAlpha = .16; ctx.lineWidth = .7;
      strokeRing(ctx, 280, 1, .7); strokeRing(ctx, 362, 1, .7);
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke();
      ctx.restore(); return;
    }
    const phase = state.phase == null ? 8 : state.phase, t = clamp(state.progress == null ? 1 : state.progress);
    const matrixOpacity = phase < 4 ? 1 : phase === 4 ? 1 - t : 0;
    drawMatrix(ctx, model, matrixOpacity * .65, phase);
    if (phase >= 3) drawTrace(ctx, model, phase === 3 ? t : 1);
    if (phase >= 5) strokeRing(ctx, 280, phase === 5 ? t : 1, 3);
    if (phase >= 6) strokeRing(ctx, 362, phase === 6 ? t : 1, 3);
    if (phase >= 7) drawKey(ctx, model, phase === 7 ? t : 1);
    if (phase >= 0 && phase <= 2) drawSequence(ctx, model, phase, t);
    ctx.restore();
  }
  root.SigillumRenderer = Object.freeze({ draw, loadAssets, clearCache: () => maskCache.clear(), traceSegments, flattenedPath, KEY_FONT });
})(typeof window !== 'undefined' ? window : globalThis);
