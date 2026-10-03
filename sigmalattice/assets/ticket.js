(() => {
  'use strict';
  const createCode = prefix => {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `${prefix}-${value.match(/.{5}/g).join('-')}`;
  };
  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar o símbolo do ingresso.'));
    image.src = src;
  });
  const tint = (image, color, width, height) => {
    const mask = document.createElement('canvas');
    mask.width = width; mask.height = height;
    const context = mask.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    return mask;
  };
  const create = async ({theme, symbol, program = ''}) => {
    await Promise.all([400,600,900].map(weight => document.fonts.load(`${weight} 32px "Source Code Pro"`)));
    await document.fonts.ready;
    const image = await loadImage(symbol);
    const soa = theme === 'soa';
    const code = createCode(soa ? 'SOA' : 'SL');
    const canvas = document.createElement('canvas');
    canvas.width = 1800; canvas.height = 1000;
    const c = canvas.getContext('2d');
    const bg = soa ? '#080808' : '#2b1019';
    const ink = soa ? '#f4f4f4' : '#d4b98b';
    const paper = soa ? '#f4f4f4' : '#f4f1e9';
    const line = soa ? '#555555' : '#72515a';
    const text = (value, x, y, size, weight = 400, color = ink) => {
      c.fillStyle = color; c.font = `${weight} ${size}px "Source Code Pro", monospace`;
      c.fillText(value, x, y);
    };
    const wrap = (value, x, y, size, max, leading, color = paper) => {
      c.font = `400 ${size}px "Source Code Pro", monospace`;
      const words = value.split(/\s+/); let row = '';
      for (const word of words) {
        const candidate = row ? `${row} ${word}` : word;
        if (row && c.measureText(candidate).width > max) {text(row, x, y, size, 400, color);y += leading;row = word;}
        else row = candidate;
      }
      if (row) text(row, x, y, size, 400, color);
      return y;
    };
    c.fillStyle = bg; c.beginPath(); c.roundRect(30, 30, 1740, 940, 24); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(56, 56, 1688, 888);
    c.strokeStyle = line; c.lineWidth = 1; c.strokeRect(68, 68, 1664, 864);
    const logoWidth = soa ? 120 : 72;
    const logoHeight = soa ? 102 : 180;
    c.drawImage(tint(image, ink, logoWidth * 2, logoHeight * 2), 112, 107, logoWidth, logoHeight);
    text(soa ? 'SUPREMA ORDEM DE ALETEIA' : 'SIGMA LATTICE', soa ? 264 : 224, 153, soa ? 35 : 48, 600);
    text(soa ? 'O ARQUIVO PERMANECE ABERTO.' : 'UNIVERSIDADE E PESQUISA AVANÇADA', soa ? 264 : 224, 198, 19, 400);
    c.save(); c.globalAlpha = soa ? .045 : .05;
    const watermarkWidth = soa ? 670 : 240;
    c.drawImage(tint(image, ink, watermarkWidth, soa ? 566 : 600), soa ? 632 : 982, 270);
    c.restore();
    text(soa ? 'INGRESSO À ORDEM' : 'PROCESSO SELETIVO', 112, 346, 64, 900, paper);
    text(soa ? 'SOLICITAÇÃO DE VALIDAÇÃO INICIÁTICA' : 'SOLICITAÇÃO DE INGRESSO', 112, 393, 22);
    c.strokeStyle = line; c.beginPath(); c.moveTo(112, 425); c.lineTo(1300, 425); c.stroke();
    text(soa ? 'PERCURSO' : 'LINHA DE FORMAÇÃO', 112, 479, 17);
    wrap(soa ? 'Grau Zero / O limiar' : program, 112, 525, 30, 1150, 42);
    const instruction = soa ? 'Envie este ingresso a um M.S. para validar a iniciação na Ordem.' : 'Envie este ingresso à Universidade Sigma Lattice para dar início ao processo seletivo.';
    wrap(instruction, 112, 640, 25, 1125, 38);
    text(soa ? 'A emissão não substitui a validação de um M.S.' : 'A emissão não confirma matrícula ou aprovação.', 112, 775, 18);
    text(code, 112, 858, 33, 600, paper);
    text(soa ? 'AUTONOMIA / LIMITES / DISCERNIMENTO' : 'A SIMBIOSE É SUPERIOR AO CONTROLE.', 112, 897, 16);
    c.strokeStyle = line; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(1360, 68); c.lineTo(1360, 932); c.stroke(); c.setLineDash([]);
    text(soa ? 'S.O.A' : 'SL', 1420, 178, 80, 900);
    text('INGRESSO', 1420, 235, 21, 600);
    text('REFERÊNCIA', 1420, 370, 16);
    const groups = code.split('-');
    text(groups.shift(), 1420, 419, 26, 600, paper);
    groups.forEach((group, i) => text(group, 1420, 469 + i * 48, 34, 600, paper));
    const date = new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    text('EMISSÃO', 1420, 756, 16);
    text(date, 1420, 791, 20, 400, paper);
    text('VALIDAÇÃO', 1420, 859, 16);
    text('MANUAL', 1420, 896, 25, 600);
    c.globalCompositeOperation = 'destination-out';
    for (const y of [30, 970]) {c.beginPath();c.arc(1360, y, 25, 0, Math.PI * 2);c.fill();}
    c.globalCompositeOperation = 'source-over';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Não foi possível gerar a imagem do ingresso.');
    return {code, blob, url:URL.createObjectURL(blob), filename:`${soa ? 'SOA' : 'Sigma-Lattice'}-Ingresso-${code}.png`, instruction};
  };
  const download = ticket => {
    const link = document.createElement('a'); link.href = ticket.url; link.download = ticket.filename;
    document.body.append(link); link.click(); link.remove();
  };
  window.CejeraTicket = Object.freeze({create, download});
})();
