import { validDate, money, TYPES } from './domain.mjs';
export const RARITIES = ['Básico','Comum','Cinza','Verde','Azul','Roxo','Lendário','Mítico'];
export const METRICS = {
  vendas: 'Vendas fechadas', leads: 'Leads sob responsabilidade', leads_completos: 'Leads com descrição e contato',
  leads_5cerejas: 'Leads com 5 cerejas', vendas_5cerejas: 'Vendas de leads com 5 cerejas',
  vendas_dj: 'Vendas para DJs', vendas_marca: 'Vendas para marcas', vendas_influenciador: 'Vendas para influenciadores',
  vendas_pessoa: 'Vendas para pessoas', vendas_grande_empresa: 'Vendas para grandes empresas', vendas_pequena_empresa: 'Vendas para pequenas empresas',
  tipos_convertidos: 'Tipos de cliente convertidos', maior_venda: 'Maior venda (R$)', faturamento: 'Faturamento acumulado (R$)',
  vendas_mes: 'Mais vendas em um mês', faturamento_mes: 'Maior faturamento em um mês (R$)', meses_meta: 'Meses com metas atingidas'
};
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
export function achievementStats(leads, goals, email) {
  const own = leads.filter(l => l.responsavel === email && !l.excluido_em && l.status !== 'Lixeira');
  const won = own.filter(l => l.status === 'Fechado' && validDate(l.fechado_em) && positive(l.valor));
  const monthly = new Map();
  for (const lead of won) {
    const month = lead.fechado_em.slice(0,7), current = monthly.get(month) || { revenue: 0, count: 0 };
    current.revenue += Math.round(positive(lead.valor) * 100); current.count++; monthly.set(month,current);
  }
  const met = new Set(goals.filter(g => {
    if (g.email !== email || !/^\d{4}-(0[1-9]|1[0-2])$/.test(g.mes)) return false;
    const revenue = positive(g.faturamento), count = positive(g.vendas), actual = monthly.get(g.mes);
    return actual && (revenue > 0 || count > 0) && (!revenue || actual.revenue >= Math.round(revenue * 100)) && (!count || actual.count >= count);
  }).map(g => g.mes));
  const result = {
    vendas: won.length, leads: own.length,
    leads_completos: own.filter(l => String(l.nome||'').trim() && String(l.descricao||'').trim() && (String(l.telefone||'').trim() || String(l.email||'').trim())).length,
    leads_5cerejas: own.filter(l => Number(l.qualidade) === 5).length, vendas_5cerejas: won.filter(l => Number(l.qualidade) === 5).length,
    tipos_convertidos: new Set(won.filter(l => TYPES.includes(l.tipo)).map(l => l.tipo)).size,
    maior_venda: Math.max(0,...won.map(l => positive(l.valor))), faturamento: [...monthly.values()].reduce((sum,m) => sum + m.revenue,0)/100,
    vendas_mes: Math.max(0,...[...monthly.values()].map(m => m.count)), faturamento_mes: Math.max(0,...[...monthly.values()].map(m => m.revenue))/100,
    meses_meta: met.size
  };
  for (const [suffix,type] of Object.entries({dj:'DJ',marca:'Marca',influenciador:'Influenciador',pessoa:'Pessoa',grande_empresa:'Grande empresa',pequena_empresa:'Pequena empresa'})) result['vendas_'+suffix] = won.filter(l => l.tipo === type).length;
  return result;
}
export function badgeProgress(badge, stats) {
  const target = positive(badge.objetivo), current = positive(stats[badge.metrica]), valid = Object.hasOwn(METRICS,badge.metrica) && target > 0;
  return { current, target, valid, eligible: valid && current >= target, percentage: valid ? Math.min(100,Math.round(current/target*100)) : 0 };
}
export function metricValue(metric,value) { return ['maior_venda','faturamento','faturamento_mes'].includes(metric) ? money(value) : new Intl.NumberFormat('pt-BR').format(Number(value)||0); }
export function validateBadge(input) {
  const badge = { ...input, nome: String(input.nome||'').trim(), objetivo: Number(input.objetivo) };
  if (!badge.nome || badge.nome.length > 100 || !RARITIES.includes(badge.raridade) || !Object.hasOwn(METRICS,badge.metrica) || !Number.isFinite(badge.objetivo) || badge.objetivo <= 0 || badge.objetivo > 1e12) throw new Error('Confira nome, raridade, estatística e objetivo da conquista.');
  if (!['maior_venda','faturamento','faturamento_mes'].includes(badge.metrica) && !Number.isInteger(badge.objetivo)) throw new Error('Este objetivo precisa ser um número inteiro.');
  return badge;
}
