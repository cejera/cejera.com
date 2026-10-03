(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  if (menu && navigation) {
    menu.hidden = false;
    const closeMenu = () => { navigation.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      navigation.classList.toggle('is-open', open);
    });
    navigation.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
    window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
  }

  const filters = document.querySelector('.news-filter');
  if (filters) {
    filters.hidden = false;
    filters.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      filters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      let count = 0;
      document.querySelectorAll('.news-card').forEach((card) => {
        card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
        if (!card.hidden) count += 1;
      });
      document.getElementById('filter-status').textContent = `${count} ${count === 1 ? 'notícia exibida' : 'notícias exibidas'}.`;
    });
  }

  const dialog = document.getElementById('admission-dialog');
  const admissionOpen = document.getElementById('admission-open');
  const form = document.getElementById('admission-form');
  if (dialog && admissionOpen && form && typeof dialog.showModal === 'function') {
    let returnFocus = null; let ticket = null;
    const error = document.getElementById('ticket-error');
    const generate = form.querySelector('button[type=submit]');
    admissionOpen.hidden = false;
    const openDialog = (trigger, program) => {
      returnFocus = trigger;
      document.getElementById('admission-form-view').hidden = false;
      document.getElementById('admission-result').hidden = true;
      error.hidden = true; form.reset();
      if(program) document.getElementById('program-choice').value = program;
      dialog.showModal();
    };
    admissionOpen.addEventListener('click', () => openDialog(admissionOpen));
    document.querySelectorAll('[data-program]').forEach(link => link.addEventListener('click', event => {event.preventDefault();openDialog(link,link.dataset.program);}));
    dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {if(returnFocus?.isConnected) returnFocus.focus();});
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if(event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if(!form.reportValidity()) return;
      generate.disabled = true; error.hidden = true;
      const program = document.getElementById('program-choice').value;
      try {
        const next = await window.CejeraTicket.create({theme:'sigma',symbol:new URL('assets/sigma-gold.svg',location.href).href,program});
        if(ticket) URL.revokeObjectURL(ticket.url); ticket = next;
        if(!dialog.open) return;
        document.getElementById('credential-code').textContent = ticket.code;
        document.getElementById('credential-program').textContent = program;
        const preview = document.getElementById('ticket-image');
        preview.src = ticket.url; preview.alt = 'Ingresso Sigma Lattice, código '+ticket.code+'. '+ticket.instruction;
        document.getElementById('admission-form-view').hidden = true;
        const result = document.getElementById('admission-result');
        result.hidden = false; result.setAttribute('tabindex','-1'); result.focus();
      } catch (failure) {
        error.textContent = 'Não foi possível gerar o ingresso. Tente novamente.'; error.hidden = false;
      } finally {generate.disabled = false;}
    });
    document.getElementById('download-credential').addEventListener('click', () => {if(ticket) window.CejeraTicket.download(ticket);});
  }
  const oldFile = new URLSearchParams(location.search).get('arquivo');
  const aliases = {'supernova':'supernova','el-nino':'el-nino-historico','continuidade':'hospedagem','rot':'rot-rastreamento'};
  if(document.body.dataset.page === 'news-archive' && Object.hasOwn(aliases,oldFile)) location.replace(aliases[oldFile]+'/');
  if (!window.matchMedia('(prefers-reduced-motion:reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}});
    },{threshold:.08});
    document.querySelectorAll('.campus-gallery figure,.campus-map,.institution-main,.methodology,.article-media').forEach(element => {element.classList.add('reveal-ready');observer.observe(element);});
  }
})();
