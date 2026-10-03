(() => {
  'use strict';
  const entry = document.querySelector('.initiation-entry');
  const launch = document.getElementById('initiation-launch');
  const dialog = document.getElementById('initiation-dialog');
  const image = document.getElementById('initiation-image');
  const code = document.getElementById('initiation-code');
  const error = document.getElementById('initiation-error');
  const download = document.getElementById('initiation-download');
  const regenerate = document.getElementById('initiation-regenerate');
  let ticket = null;
  let busy = false;
  let opener = launch;
  const generate = async () => {
    if (busy) return;
    busy = true;
    error.hidden = true;
    download.disabled = true;
    launch.disabled = true;
    regenerate.disabled = true;
    code.textContent = 'Preparando o ingresso…';
    try {
      const next = await window.CejeraTicket.create({theme:'soa',symbol:new URL('assets/soa.svg',location.href).href});
      if (ticket) URL.revokeObjectURL(ticket.url);
      ticket = next;
      image.src = ticket.url;
      image.hidden = false;
      code.textContent = ticket.code;
      download.disabled = false;
    } catch (failure) {
      code.textContent = 'Emissão não concluída';
      error.textContent = failure.message || 'Não foi possível gerar o ingresso. Tente novamente.';
      error.hidden = false;
    } finally {
      launch.disabled = false;
      regenerate.disabled = false;
      busy = false;
    }
  };
  if (window.CejeraTicket && dialog.showModal) {
    entry.hidden = false;
    launch.addEventListener('click', () => {
      opener = document.activeElement;
      dialog.showModal();
      generate();
    });
    download.addEventListener('click', () => {if(ticket) window.CejeraTicket.download(ticket);});
    regenerate.addEventListener('click', generate);
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  }
  const surfaces = document.querySelectorAll('.hero-seal,.atlas');
  const motion = matchMedia('(prefers-reduced-motion:reduce)');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(items => {
      items.forEach(item => item.target.classList.toggle('motion-visible', item.isIntersecting && !motion.matches));
    }, {threshold:.05});
    surfaces.forEach(surface => observer.observe(surface));
    motion.addEventListener('change', () => surfaces.forEach(surface => {
      surface.classList.remove('motion-visible');
      observer.unobserve(surface); observer.observe(surface);
    }));
  }
})();
