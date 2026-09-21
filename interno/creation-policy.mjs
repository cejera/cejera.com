import { CONFIG } from './config.mjs';
import { validateLead } from './domain.mjs';
import { roleFor } from './permissions.mjs';
import { commissionSplit } from './commissions.mjs';
export function prepareNewLead(input, email, team, editorEmails, now = new Date().toISOString()) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input?.id || '')) throw new Error('Reabra o cadastro para gerar um identificador válido.');
  const manager = ['Admin', 'Gerente'].includes(roleFor(email, team));
  const lead = validateLead({ ...input, criado_por: email, criado_em: now, atualizado_em: now,
    excluido_em: '', valor_anterior: '', status_anterior: '', fechamento_anterior: '',
    ...(!manager ? { responsavel: email, gerente: CONFIG.ownerEmail, status: 'Lead novo', fechado_em: '' } : {}) });
  if (!editorEmails.includes(lead.responsavel) || !editorEmails.includes(lead.gerente)) throw new Error('O vendedor e o gerente precisam ter acesso de editor à planilha, compartilhado diretamente com o e-mail de cada um.');
  if (!['Admin', 'Gerente'].includes(roleFor(lead.gerente, team))) throw new Error('O gerente precisa ter cargo Admin ou Gerente.');
  commissionSplit(lead, team);
  return lead;
}
