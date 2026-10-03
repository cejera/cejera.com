(function () {
  'use strict';
  const M = window.SigillumModel, R = window.SigillumRenderer;
  const $ = id => document.getElementById(id);
  const ui = {
    form: $('sigil-form'), intention: $('intention'), keyword: $('keyword'), error: $('form-error'),
    canvas: $('sigil-canvas'), empty: $('empty-caption'), state: $('result-state'), phase: $('phase-label'),
    count: $('phase-count'), progress: $('progress-fill'), track: $('progress-track'), pause: $('pause'),
    skip: $('skip'), replay: $('replay'), download: $('download'), note: $('export-note'),
    audit: $('audit'), tokens: $('letter-tokens'), facing: $('key-facing'), direction: $('key-direction')
  };
  const stages = [...document.querySelectorAll('.stages li')];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let model = null, state = { phase: -1, progress: 0, totalProgress: 0 }, animation = 0;
  let elapsed = 0, origin = 0, paused = false, ready = false, busy = false;
  let tokenElements = [], lastPhase = -2, lastTokenProgress = -1, operation = 0;
  let palette = 'dark', fontsReady;
  function stop() { cancelAnimationFrame(animation); animation = 0; }
  function render() { R.draw(ui.canvas, model, state, { palette }); }
  function resize() {
    const size = Math.round(ui.canvas.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2));
    if (size > 0 && ui.canvas.width !== size) { ui.canvas.width = size; ui.canvas.height = size; }
    render();
  }
  function controls() {
    const running = model && state.phase >= 0 && state.phase < 8;
    ui.pause.disabled = !running; ui.skip.disabled = !running;
    ui.replay.disabled = !model || running || busy; ui.download.disabled = !model || state.phase !== 8 || busy;
    ui.pause.textContent = paused ? 'Continuar' : 'Pausar';
  }
  function updateTokens() {
    const step = Math.floor(state.progress * (model?.tokens.length || 1));
    if (state.phase === lastPhase && step === lastTokenProgress) return;
    lastTokenProgress = step;
    tokenElements.forEach((element, index) => {
      const token = model.tokens[index];
      const removed = !token.kept && (state.phase > 1 || state.phase === 1 && index <= step);
      element.classList.toggle('removed', removed);
      element.classList.toggle('numbered', state.phase >= 2);
      const activeNumber = state.phase === 3 ? Math.min(model.numbers.length - 1, Math.floor(state.progress * model.numbers.length)) : -1;
      element.classList.toggle('active', token.kept && model.letters.indexOf(token.letter) === activeNumber);
    });
  }
  function update() {
    updateTokens();
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      ui.phase.textContent = state.phase === 8 ? 'Inscrição concluída. A forma permanece.' : M.PHASES[state.phase]?.title || 'Aguardando formulação.';
      ui.count.textContent = state.phase < 0 ? '00 / 08' : `${String(Math.min(8, state.phase + 1)).padStart(2, '0')} / 08`;
      ui.state.textContent = state.phase === 8 ? 'INSCRITO / NÃO ATIVADO' : state.phase < 0 ? 'EM ESPERA' : 'EM CONSTRUÇÃO';
      stages.forEach((element, i) => { element.classList.toggle('is-current', i === state.phase); element.classList.toggle('is-complete', i < state.phase); });
    }
    const value = Math.round((state.totalProgress || 0) * 100);
    ui.progress.style.width = value + '%'; ui.track.setAttribute('aria-valuenow', String(value));
    controls(); render();
  }
  function complete() {
    stop(); elapsed = M.totalDuration(); paused = false;
    state = M.timeline(elapsed); update();
    const begin = model.points[0], end = model.points[model.points.length - 1];
    $('result-description').textContent = `Sigilo com ${model.letters.length} letras reduzidas; início em ${begin.name}, fim em ${end.name}. Chave ${model.key.text}, em sete posições. ${model.direction === 'clockwise' ? 'Leitura horária' : 'Leitura anti-horária'}, ${ui.facing.selectedOptions[0].textContent.toLowerCase()}.`;
    ui.note.textContent = 'Só o sigilo será exportado. Sua intenção não aparece no PNG.';
  }
  function frame(now) {
    elapsed = now - origin;
    if (elapsed >= M.totalDuration()) { complete(); return; }
    state = M.timeline(elapsed); update(); animation = requestAnimationFrame(frame);
  }
  function play() { paused = false; origin = performance.now() - elapsed; ui.phase.textContent = M.PHASES[state.phase].title; controls(); animation = requestAnimationFrame(frame); }
  function begin() {
    stop(); elapsed = 0; state = M.timeline(0); lastPhase = -2; lastTokenProgress = -1;
    ui.empty.hidden = true; ui.audit.hidden = false;
    ui.note.textContent = 'A imagem estará disponível ao concluir o traçado.';
    update();
    if ($('instant-mode').checked || motionPreference.matches) complete(); else play();
  }
  function resetResult() {
    operation++; stop(); model = null; elapsed = 0; paused = false; busy = false;
    state = { phase: -1, progress: 0, totalProgress: 0 }; lastPhase = -2; tokenElements = [];
    ui.empty.hidden = false; ui.audit.hidden = true; ui.tokens.replaceChildren();
    $('normalized-text').textContent = ''; $('audit-note').textContent = '';
    ui.error.hidden = true; ui.intention.removeAttribute('aria-invalid'); ui.keyword.removeAttribute('aria-invalid');
    ui.note.textContent = 'A imagem estará disponível ao concluir o traçado.';
    $('result-description').textContent = 'Informe uma intenção e uma palavra-chave para acompanhar a construção.';
    update();
  }
  function counts() {
    $('character-count').textContent = `${ui.intention.value.length} / 240`;
    const glyphs = M.graphemes(ui.keyword.value), valid = glyphs.length === 7 && !/\s|\p{Cc}/u.test(ui.keyword.value);
    $('key-count').textContent = `${glyphs.length} / 7`;
    $('key-count').classList.toggle('invalid', glyphs.length > 0 && !valid);
    $('glyph-preview').textContent = glyphs.length ? glyphs.slice(0, 7).join(' ') : '—';
    $('key-meaning').textContent = valid ? 'Sete caracteres. Um por ponta.' : glyphs.length ? 'A chave precisa de sete caracteres visíveis.' : 'Uma inscrição decorativa, não uma tradução.';
  }
  function audit() {
    $('normalized-text').textContent = model.normalized; ui.tokens.replaceChildren();
    tokenElements = model.tokens.map(token => {
      const span = document.createElement('span'); span.className = 'letter-token';
      span.append(document.createTextNode(token.letter));
      const n = document.createElement('small'); n.textContent = String(token.number); span.append(n);
      span.title = token.duplicate ? `${token.letter}: repetida` : token.vowel ? `${token.letter}: vogal removida` : `${token.letter} → ${token.number} / ${model.nodes[token.number - 1].name}`;
      ui.tokens.append(span); return span;
    });
    const first = model.points[0], last = model.points[model.points.length - 1];
    $('audit-note').textContent = `Sequência: ${model.letters.join('')} → ${model.numbers.join(' · ')}. Início: ${first.number}/${first.name}. Fim: ${last.number}/${last.name}.`;
  }
  async function submit(event) {
    event.preventDefault(); if (!ready) return;
    resetResult();
    try {
      model = M.build(ui.intention.value, ui.keyword.value, { removeVowels: $('remove-vowels').checked, direction: ui.direction.value, facing: ui.facing.value });
      audit(); begin();
      if (innerWidth <= 760) ui.canvas.scrollIntoView({ block: 'start', behavior: motionPreference.matches ? 'auto' : 'smooth' });
    } catch (error) {
      model = null; ui.error.textContent = error.message; ui.error.hidden = false;
      const field = /chave|caractere/.test(error.message) ? ui.keyword : ui.intention;
      field.setAttribute('aria-invalid', 'true'); field.focus(); controls();
    }
  }
  ui.form.addEventListener('submit', submit);
  for (const element of [ui.intention, ui.keyword, $('remove-vowels'), ui.facing, ui.direction]) element.addEventListener('input', () => { resetResult(); counts(); });
  $('clear').addEventListener('click', () => { ui.form.reset(); resetResult(); R.clearCache(); counts(); ui.intention.focus(); });
  ui.pause.addEventListener('click', () => {
    if (paused) { play(); return; }
    stop(); paused = true; controls(); ui.phase.textContent = M.PHASES[state.phase].title + ' [pausa]';
  });
  ui.skip.addEventListener('click', complete);
  ui.replay.addEventListener('click', begin);
  motionPreference.addEventListener('change', event => { if (event.matches && model && state.phase < 8) complete(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animation) { stop(); paused = true; controls(); ui.phase.textContent = M.PHASES[state.phase].title + ' [pausa]'; }
  });
  document.querySelectorAll('input[name="palette"]').forEach(element => element.addEventListener('change', () => { palette = element.value; render(); }));
  ui.download.addEventListener('click', async () => {
    if (!model || state.phase !== 8 || busy) return;
    const current = operation, snapshot = model, currentPalette = palette;
    const ratio = document.querySelector('input[name="ratio"]:checked').value;
    busy = true; controls(); ui.note.textContent = 'Preparando a imagem…';
    let objectURL;
    try {
      await fontsReady;
      const [width, height] = M.FORMATS[ratio], canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      R.draw(canvas, snapshot, { phase: 8, progress: 1 }, { palette: currentPalette });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('O navegador não conseguiu gerar o PNG.');
      if (current !== operation) return;
      objectURL = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = objectURL; link.download = `SOA-Sigillum-${width}x${height}-${currentPalette === 'light' ? 'preto-no-branco' : 'branco-no-preto'}.png`;
      document.body.append(link); link.click(); link.remove();
      ui.note.textContent = `PNG preparado: ${width} × ${height}. Só o sigilo, sem a intenção.`;
      const releasedURL = objectURL; setTimeout(() => URL.revokeObjectURL(releasedURL), 10000); objectURL = null;
    } catch (error) { if (current === operation) ui.note.textContent = error.message; }
    finally { if (objectURL) URL.revokeObjectURL(objectURL); if (current === operation) { busy = false; controls(); } }
  });
  fontsReady = Promise.all([document.fonts.load('600 16px "Source Code Pro"'), document.fonts.load('16px "STIX Two Math"'), document.fonts.ready]);
  $('generate').disabled = true; ui.phase.textContent = 'Preparando a matriz…';
  new ResizeObserver(resize).observe(ui.canvas); counts(); resize();
  Promise.all([fontsReady, R.loadAssets()]).then(() => { ready = true; $('generate').disabled = false; resetResult(); })
    .catch(error => { ui.error.textContent = error.message + ' Verifique se a pasta assets foi enviada junto do HTML.'; ui.error.hidden = false; ui.phase.textContent = 'Matriz indisponível.'; });
})();
