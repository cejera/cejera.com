import { CONFIG } from './config.mjs';
import { validDate } from './domain.mjs';
const account = value => String(value || '').trim().toLowerCase();
export function participates(lead, email) {
  const who = account(email);
  return !!who && (who === CONFIG.ownerEmail || account(lead.responsavel) === who || account(lead.gerente) === who);
}
const searchable = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const digits = value => String(value || '').replace(/\D/g, '');
const phone = value => { const n = digits(value); return n.length === 10 || n.length === 11 ? '55' + n : n; };
export function matchesLead(lead, { query = '', type = '', owner = '', followup = '', day } = {}) {
  if (type && lead.tipo !== type || owner && ![account(lead.responsavel), account(lead.gerente)].includes(account(owner))) return false;
  const q = searchable(query), number = digits(query);
  if (q && ![lead.nome, lead.email, lead.telefone, lead.descricao].some(v => searchable(v).includes(q)) && !(number.length >= 4 && /^[\d\s()+.\-]+$/.test(query) && (digits(lead.telefone).includes(number) || phone(lead.telefone).includes(phone(query))))) return false;
  if (!followup) return true;
  if (lead.status === 'Fechado' || lead.status === 'Lixeira' || lead.excluido_em) return false;
  const date = lead.proximo_contato;
  if (followup === 'none') return !date;
  if (!validDate(date) || !validDate(day)) return false;
  return followup === 'today' ? date === day : followup === 'overdue' ? date < day : true;
}
export function duplicateContacts(leads, draft) {
  const email = account(draft.email), tel = phone(draft.telefone);
  return leads.filter(l => l.id !== draft.id && ((email && account(l.email) === email) || (tel.length >= 10 && phone(l.telefone) === tel)));
}
