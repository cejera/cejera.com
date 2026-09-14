export const STATUSES = ['Lead novo', 'Primeiro contato', 'Em andamento', 'Fechado', 'Aberto para remarketing'];
export const TYPES = ['DJ', 'Marca', 'Influenciador', 'Pessoa', 'Grande empresa', 'Pequena empresa', 'Outro'];
export const SCHEMA = {
  Leads: ['id', 'nome', 'telefone', 'email', 'descricao', 'qualidade', 'tipo', 'status', 'responsavel', 'valor', 'fechado_em', 'proximo_contato', 'criado_em', 'atualizado_em', 'gerente', 'ordem', 'excluido_em', 'valor_anterior', 'status_anterior', 'fechamento_anterior', 'criado_por'],
  Equipe: ['email', 'nome', 'comissao', 'nivel', 'permissao'],
  Metas: ['id', 'email', 'mes', 'faturamento', 'vendas'],
  Badges: ['id', 'nome', 'descricao', 'imagem', 'raridade', 'metrica', 'objetivo'],
  Conquistas: ['id', 'email', 'badge_id', 'concedido_em', 'mensagem'],
};
export const BADGE_CODES = ['118','147','194','208','239','264','275','317','352','382','431','436','468','491','519','563','590','612','637','674','723','775','777','785','806','809','854','901','941','984'];
export const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
export const percent = value => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 }).format(value);
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function isoDate(value) {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  const text = String(value).trim();
  const pt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return pt ? `${pt[3]}-${pt[2]}-${pt[1]}` : text.slice(0, 10);
}
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function sheetValue(key, value) {
  if (['fechado_em', 'proximo_contato', 'concedido_em'].includes(key) && value) return Date.parse(value + 'T00:00:00Z') / 86400000 + 25569;
  return value ?? '';
}
export function parseRows(name, matrix) {
  const headers = (matrix[0] || []).map(String);
  if (SCHEMA[name].some(h => !headers.includes(h)) || new Set(headers).size !== headers.length) throw new Error(`Os cabeçalhos da aba ${name} foram alterados. Restaure os nomes para continuar.`);
  const keys = new Set();
  return matrix.slice(1).flatMap((row, index) => {
    if (!row.some(v => v !== '' && v != null)) return [];
    const record = Object.fromEntries(headers.map((key, col) => [key, row[col] ?? '']));
    for (const key of ['id','badge_id','nome','telefone','descricao','tipo','status','criado_em','atualizado_em','mes','imagem','mensagem']) if (key in record) record[key] = String(record[key]);
    if (name === 'Leads' && !record.nome) return [];
    if (['Equipe','Metas','Conquistas'].includes(name) && !record.email) return [];
    for (const key of ['email','responsavel','gerente','criado_por']) if (key in record) record[key] = String(record[key]).trim().toLowerCase();
    for (const key of ['fechado_em','proximo_contato','concedido_em']) if (key in record) record[key] = isoDate(record[key]);
    const id = name === 'Equipe' ? record.email : record.id;
    if (id && keys.has(id)) throw new Error(`Há um identificador duplicado na aba ${name}. Corrija a duplicação na planilha.`);
    if (id) keys.add(id);
    return [{ ...record, _row: index + 2, _headers: headers }];
  });
}
export function validateLead(input) {
  const lead = Object.fromEntries(SCHEMA.Leads.map(k => [k, ['qualidade','valor','valor_anterior','ordem'].includes(k) ? (input[k] ?? '') : String(input[k] ?? '').trim()]));
  if (!lead.nome || lead.nome.length > 200) throw new Error('Informe um nome com até 200 caracteres.');
  for (const key of ['email','responsavel','gerente']) { lead[key] = lead[key].toLowerCase(); if (lead[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead[key])) throw new Error('Confira os endereços de e-mail.'); }
  if (lead.descricao.length > 10000 || lead.telefone.length > 60) throw new Error('Descrição ou telefone muito longo.');
  lead.qualidade = Number(lead.qualidade); lead.valor = Number(lead.valor || 0);
  if (!Number.isInteger(lead.qualidade) || lead.qualidade < 1 || lead.qualidade > 5) throw new Error('A qualidade precisa ter de 1 a 5 cerejas.');
  if (!Number.isFinite(lead.valor) || lead.valor < 0 || lead.valor > 1e12) throw new Error('Informe um valor de venda válido.');
  lead.valor = Math.round(lead.valor * 100) / 100;
  if (!(STATUSES.includes(lead.status) || (lead.status === 'Lixeira' && lead.excluido_em)) || !TYPES.includes(lead.tipo)) throw new Error('Escolha um tipo e um status válidos.');
  if (lead.ordem !== '') { lead.ordem = Number(lead.ordem); if (!Number.isFinite(lead.ordem)) throw new Error('A ordem do lead é inválida.'); }
  if (lead.excluido_em) { lead.valor = 0; lead.status = 'Lixeira'; lead.fechado_em = ''; }
  if (lead.status === 'Fechado') {
    if (!lead.responsavel || !lead.gerente) throw new Error('Defina o vendedor e o gerente da venda.');
    lead.fechado_em ||= today();
  } else lead.fechado_em = '';
  for (const key of ['fechado_em','proximo_contato']) if (lead[key] && !validDate(lead[key])) throw new Error('Confira as datas do lead.');
  return lead;
}
export function mergeChanges(base, fresh, patch) {
  const conflicts = Object.keys(patch).filter(key => key !== 'atualizado_em' && String(fresh[key] ?? '') !== String(base[key] ?? '') && String(fresh[key] ?? '') !== String(patch[key] ?? ''));
  if (conflicts.length) throw new Error(`Este registro mudou enquanto você editava (${conflicts.join(', ')}). Feche e abra novamente para conferir a versão atual. Seu formulário foi preservado.`);
  return { ...fresh, ...patch };
}
export function memberStats(leads, member, month, defaultRate = .04) {
  const own = leads.filter(l => l.responsavel === member.email);
  const won = own.filter(l => l.status === 'Fechado' && l.fechado_em.startsWith(month));
  const revenue = won.reduce((sum,l) => sum + Math.round(Number(l.valor || 0) * 100), 0) / 100;
  const rate = member.comissao === '' || member.comissao == null ? defaultRate : Number(member.comissao);
  const commission = won.reduce((sum,l) => sum + Math.round(Number(l.valor || 0) * rate * 100), 0) / 100;
  return { leads: own.length, won: won.length, revenue, commission, rate };
}
export function badgeAsset(value) { const code = String(value).replace(/\.png$/, ''); return BADGE_CODES.includes(code) ? `./assets/${code}.png` : './assets/mark.svg'; }
