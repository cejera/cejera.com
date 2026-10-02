(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  };
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
  const menuQuery = window.matchMedia('(max-width:760px)');
  menuQuery.addEventListener('change', closeMenu);

  const points = [...document.querySelectorAll('[data-rune]')];
  const cards = [...document.querySelectorAll('.rune-card')];
  const title = document.getElementById('atlas-title');
  const description = document.getElementById('atlas-description');
  const readings = new Map(cards.map(card => [card.id.replace('runa-', ''), {
    card,
    title: card.querySelector('summary strong').textContent,
    text: card.querySelector('.rune-body > p').textContent
  }]));
  const selectRune = (id, navigate = false) => {
    const reading = readings.get(id);
    if (!reading) return;
    points.forEach(point => point.setAttribute('aria-pressed', String(point.dataset.rune === id)));
    title.textContent = reading.title;
    description.textContent = reading.text;
    if (navigate) {
      reading.card.open = true;
      const summary = reading.card.querySelector('summary');
      summary.focus({preventScroll: true});
      reading.card.scrollIntoView({block: 'start'});
    }
  };
  document.querySelector('.atlas-controls').hidden = false;
  document.querySelector('.atlas-instruction').hidden = false;
  points.forEach(point => point.addEventListener('click', () => selectRune(point.dataset.rune, true)));
  cards.forEach(card => card.addEventListener('toggle', () => {
    if (card.open) selectRune(card.id.replace('runa-', ''));
  }));
  const readHash = () => {
    const id = window.location.hash.slice(1);
    if (id.startsWith('runa-')) {
      const reading = readings.get(id.slice(5));
      if (reading) {
        reading.card.open = true;
        selectRune(id.slice(5));
      }
    }
  };
  window.addEventListener('hashchange', readHash);
  readHash();

  const questions = [...document.querySelectorAll('.question-list > li')];
  const questionControls = document.querySelector('.question-controls');
  const dots = [...document.querySelectorAll('[data-question]')];
  const previous = document.getElementById('previous-question');
  const next = document.getElementById('next-question');
  let currentQuestion = 0;
  const showQuestion = index => {
    if (!Number.isInteger(index) || index < 0 || index >= questions.length) return;
    currentQuestion = index;
    questions.forEach((question, i) => { question.hidden = i !== index; });
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.disabled = index === questions.length - 1;
  };
  previous.addEventListener('click', () => showQuestion(currentQuestion - 1));
  next.addEventListener('click', () => showQuestion(currentQuestion + 1));
  dots.forEach(dot => dot.addEventListener('click', () => showQuestion(Number(dot.dataset.question))));
  questionControls.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    showQuestion(Math.max(0, Math.min(questions.length - 1, currentQuestion + offset)));
    dots[currentQuestion].focus();
  });
  questionControls.hidden = false;
  showQuestion(0);

  const progress = document.getElementById('progress-bar');
  let scheduled = false;
  const updateProgress = () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const value = distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0;
    progress.style.width = `${value * 100}%`;
    scheduled = false;
  };
  const scheduleProgress = () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(updateProgress);
    }
  };
  window.addEventListener('scroll', scheduleProgress, {passive: true});
  window.addEventListener('resize', scheduleProgress);
  window.addEventListener('load', scheduleProgress, {once: true});
  updateProgress();
})();
