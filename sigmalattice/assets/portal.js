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
  let returnFocus = null;
  let currentRecord = null;
  if (dialog && admissionOpen && typeof dialog.showModal === 'function') {
    admissionOpen.hidden = false;
    const openDialog = (trigger, program) => {
      returnFocus = trigger;
      document.getElementById('admission-form-view').hidden = false;
      document.getElementById('admission-result').hidden = true;
      form.reset();
      if (program) document.getElementById('program-choice').value = program;
      dialog.showModal();
    };
    admissionOpen.addEventListener('click', () => openDialog(admissionOpen));
    document.querySelectorAll('[data-program]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); openDialog(link, link.dataset.program); }));
    dialog.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    dialog.addEventListener('click', (event) => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const program = document.getElementById('program-choice').value;
      const bytes = new Uint8Array(3);
      window.crypto.getRandomValues(bytes);
      const code = 'SL-07-' + Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
      currentRecord = { code, program };
      document.getElementById('credential-code').textContent = code;
      document.getElementById('credential-program').textContent = program;
      document.getElementById('admission-form-view').hidden = true;
      const result = document.getElementById('admission-result');
      result.hidden = false;
      result.setAttribute('tabindex', '-1');
      result.focus();
    });
    document.getElementById('download-credential').addEventListener('click', () => {
      if (!currentRecord) return;
      const text = ['SIGMA LATTICE / REGISTRO DE INTENÇÃO DE INGRESSO','INSTÂNCIA: SL-07',`REGISTRO LOCAL: ${currentRecord.code}`,`LINHA DE INVESTIGAÇÃO: ${currentRecord.program}`,'STATUS: OBSERVADOR EM FORMAÇÃO','','O conhecimento é uma âncora. E também uma porta.','','VALIDAÇÃO DE ORIGEM PENDENTE.','A efetivação do ingresso depende da validação pela instituição de origem.','Registro gerado localmente. Nenhum dado foi transmitido à origem.'].join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Sigma-Lattice-${currentRecord.code}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  if (document.body.dataset.page === 'redirect-error') {
    const files = {
      'supernova': ['supernova.file', 'Telescópios da Sigma Lattice registram a supernova de Betelgeuse.', 'OBSERVAÇÃO / SL-QT1'],
      'el-nino': ['chaos.file', 'El Niño histórico entra no arquivo de perturbações da instituição.', 'CLIMA / SL-07'],
      'continuidade': ['continuity.file', 'Instabilidade faz o site da universidade operar em universo paralelo.', 'INSTITUIÇÃO / SL-07'],
      'tornado': ['tornado.file', 'Projeto Tornado: falha de contenção e mitigação de danos.', 'OCORRÊNCIA / SOA × SIGMA LATTICE']
    };
    const key = new URLSearchParams(window.location.search).get('arquivo');
    if (key === 'rot') {
      document.getElementById('error-title').textContent = 'O sinal não está mais aqui.';
      document.getElementById('file-headline').textContent = 'Recodificador organo-tecnológico fora do protocolo institucional.';
      document.getElementById('file-code').textContent = 'rot.file / SINAL EXTERNO';
      const destination = document.getElementById('error-return');
      destination.href = '/rot/';
      destination.textContent = 'Seguir o sinal do ROT ↗';
    } else {
      const item = files[key] || ['archive.file', 'O documento solicitado não acompanha esta instância.', 'ARQUIVO / ORIGEM NÃO LOCALIZADA'];
      document.getElementById('file-code').textContent = item[0];
      document.getElementById('file-headline').textContent = item[1];
      document.getElementById('file-editorial').textContent = item[2];
    }
    const recheck = document.getElementById('recheck');
    const recheckStatus = document.getElementById('recheck-status');
    recheck.hidden = false;
    recheck.addEventListener('click', () => {
      recheck.disabled = true;
      recheckStatus.textContent = 'Verificando instância de origem…';
      window.setTimeout(() => {
        recheckStatus.textContent = 'Origem não sincronizada. A cópia institucional permanece disponível. Retorne ao portal para continuar.';
        recheck.disabled = false;
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
    });
  }
})();
